# 025 — Catalog load vs session shutdown race

Status: done (2026-09-13)
Kind: robustness follow-up from 016
Source: 016 acceptance item "inspect search/load cancellation separately".

## Original observation (before this fix)

`load_capability` does not take Pi's abort signal, and `session.load()` has no
abort/shutdown guard: `broker.addModule` + `connectors.push` run unconditionally.
If shutdown interleaves between `buildEntryConnector` and `load()` (or during
`load()`), the module registers on a discarded session and its connector misses
the close loop's `Promise.allSettled` pass — a connector/process leak. `search`
is synchronous and has no cancellation point; nothing to do there.

`load()` after `close()` previously did not throw; the workspace/broker accept the
module silently.

## Options

- Guard `load()` against post-shutdown registration (throw + caller closes the
  built connector), and/or forward the tool abort signal into the connector
  build so a cancelled load closes its subprocess.
- At minimum assert current behavior with a test so the race is characterized.

Not on the critical path for the 011 slice; fix when catalog loads happen
during real long-running sessions.

## Delivered (2026-09-13)

Ownership rule: `session.load()` owns the connector only on success (it is
closed by `session.close()`). On any throw — shutdown, abort, declaration or
broker error — ownership stays with the caller, which must close the built
connector. Both `load_capability` and the `sessionFromConfig` preload loop
already close on `load()` failure; `load()` itself never closes.

- `src/session.ts`: `load()` takes an optional `{ signal }`, rejects fast
  when already closed or pre-aborted, re-checks `closed`/both signals after
  the `declarations()` await (the interleave window), and only then runs
  `broker.addModule` + `connectors.push`. Loads are tracked in the `active`
  set so `close()` (which now sets `closed = true` first, then aborts, then
  settles `active` before closing connectors) waits for in-flight loads and
  late loads throw instead of registering on a discarded session.
- `src/session.ts`: `close()` is idempotent and concurrent-safe via a cached
  close promise, so every owned connector is closed exactly once. Connectors
  and the sink close via `Promise.allSettled` with each invocation wrapped
  in `Promise.resolve().then(...)`, so all are attempted even when one
  rejects or throws synchronously; the single error (or an `AggregateError`
  for several) is rethrown to preserve error reporting.
- `src/pi/extension.ts`: `load_capability` captures the live session before
  the `buildEntryConnector` await, checks the Pi abort signal before/after
  the build, and forwards it into `session.load()`. A shutdown interleaved
  with the build now surfaces as a `load()` shutdown rejection on the
  captured (closed) session, and the caller closes the built connector — no
  registration on a discarded session, no missed close. On success ownership
  has transferred to the captured session, so the post-load session-identity
  check (`session !== current` → discard) runs outside the caller-owned
  cleanup catch: it never closes the transferred connector and never mutates
  `loaded`/`loadedTexts` for a replaced/shutdown session.
- `search` confirmed sync with no cancellation point; unchanged.

## Validation

- `bun run check` clean.
- New deterministic `test/integration/load-shutdown.test.ts` (10 tests, no
  timers/subprocesses): load-after-close throws with caller-owned connector
  and unchanged declarations; pre-aborted load throws without registering;
  mid-load abort (aborted after the sync pre-checks, during the
  `declarations()` await) throws without registering; close-during-pending-load
  aborts registration without a leak (close started before the load resumes
  from `declarations()`); successful load transfers ownership to `close()`;
  concurrent + repeated `close()` closes each connector exactly once
  (close-count regression); a rejecting connector does not stop the other
  closes and its error is preserved (cached outcome reused on re-close); a
  synchronously-throwing close does not skip the remaining closes;
  real Pi `session_shutdown` handlers fired during a `load_capability` flight
  reject the load and a restarted session reloads cleanly with no stale
  `loaded` bookkeeping; an in-flight aborted `load_capability` rejects and
  leaves the session usable for a retry.
- Existing suites still pass: `catalog` + `pi-catalog` (8), `pi-cancellation`
  + `trace` + `pi-config` (14), `pi` (1).
- Runner note: attach rejection handlers before awaiting other work; the
  race test awaits the rejects assertion immediately, matching the existing
  016 test pattern.

Remaining limitations (explicit; no general lifecycle redesign): an abort
racing inside `buildEntryConnector` itself (dynamic import + `connectCli`
construction, no subprocess spawn for cli-twin) is only observed via the
post-build signal check; connector construction is not itself abortable,
which is fine while builds spawn nothing. Likewise out of scope: startup
races (`session_start` replacing a live session without closing it; the
`sessionFromConfig` preload loop) and transport connection cancellation
(`connectMcp` spawn and similar connection setup cannot be preempted).
