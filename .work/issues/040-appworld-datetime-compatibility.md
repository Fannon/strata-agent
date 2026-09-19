# 040 — Resolve AppWorld date-time compatibility before comparison

Status: adaptation implemented, live-verified 2026-09-16; investigation closed, replay acceptance under 037
Dependencies: existing AppWorld replay code and reported response examples; prerequisite for 037 task-solving acceptance and 042 comparison

2026-09-19 scope correction: this delivered the validator/broker option and manual replay compatibility, not model-facing configuration parity. The typed Pi MCP entry point fails to forward the option; the direct extension applies it. [045](045-pilot-entrypoint-validation-parity.md) owns the proposed regression/fix. Preserve this issue's successful manual results without treating them as evidence that both pilot arms used identical validation.

## Evidence and hypothesis

[The spike report](../../docs/appworld-spike.md) records output rejection of timezone-free timestamps in the paid development trajectory. `src/capabilities/schemas.ts` installs standard AJV formats. Schema generation succeeded, but that did not establish response compatibility. This is a confirmed interoperability gap; its contribution to final task failure is not a controlled causal result.

## Decision (2026-09-16, gates 0-2 assignment)

Boundary-scoped opt-in implemented — strict global default kept, no
timezone invented, original values and schemas preserved:

- `validator(schema, { acceptNaiveDateTime })` in
  `src/capabilities/schemas.ts` (default strict). Opt-in replaces the
  `date-time` format with a lexical gate accepting strict RFC 3339
  (offset/`Z`) plus naive `YYYY-MM-DDTHH:MM:SS[.fraction]`; bounded
  ranges keep malformed values rejected. Validation-only: the string
  passes through verbatim.
- `CapabilityBroker`/`addModule` take `BrokerOptions.acceptNaiveDateTime`
  and apply it to **output validators only** — agent-supplied inputs stay
  strict (pinned 98-op manifest has zero `date-time` input fields, so no
  legitimate input is affected). Loaded modules inherit the session policy.
- `SessionOptions.validation` threads the setting through `createSession`;
  `examples/appworld/replay.ts` opts in with a provenance comment and
  records `outputCompatibility` (policy/scope/globalDefault/provenance) in
  every `summary.json`. Original schemas stay untouched in `manifest.json`
  and `declarations.d.ts`. Both 042 arms must share the setting.

## Evidence

- Root cause (pinned `42b5bcf`): Pydantic `datetime` fields declare strict
  `date-time`, but `orm.py` serializes naive datetimes via `isoformat()`
  (`"2019-01-01T00:00:00"`, no offset) — the same naive form appears in
  upstream's own API docstring examples, and upstream's `parse_datetime`
  accepts `%Y-%m-%dT%H:%M:%S`. Schema and behavior disagree upstream.
- Real affected response (paid dev trajectory, local `run.jsonl`):
  `appworld.spotify__show_playlist_library: output:
  value/response/0/created_at must match format "date-time"` — a ~4 KB
  data-bearing payload discarded by our validation. 26 of 98 inspected
  operations carry `date-time` in output schemas.
- Synthetic fixture: `test/integration/datetime-compatibility.test.ts`
  (no protected data) covers strict accept/reject, opt-in naive acceptance
  verbatim, malformed rejection (garbage, month 13, date-only, space
  separator, hour 24, empty), input-strictness under opt-in, and session
  wiring. Windows run 2026-09-16: **4 pass, 1 environment-gated skip, 0
  fail** (session test skips where the 041 compiler-stdlib bug bites;
  `bun run check` clean). Local pre-fix repro:
  `.work/appworld/repro-040-datetime.ts` (ignored).

## Remaining

- [x] Verify real affected responses through replay (2026-09-16:
  verified live on a Windows platform venv, Python 3.14.7 — two fresh
  worlds, 0 validation failures across 2 x 70 capability calls while
  accepting naive `created_at`/`release_date` from
  `show_playlist_library`/`show_playlist`/`show_song`; strict-mode
  rejection of the same shapes is documented in the paid trajectory and
  synthetic tests). See 037 for the task-solving replay acceptance.

## Completion criteria

Recommended approach: reproduce first, then inspect the pinned upstream schema and response semantics. Prefer an explicit AppWorld-boundary adaptation only if it preserves the original value and has defensible semantics. Keep global defaults strict, document original versus effective schemas, and apply the same policy in both comparison arms. Never guess a timezone. If no sound adaptation exists, document the unsupported case and recommend a compatible task/backend under 037. Routine choices within an assigned fix should be resolved from this evidence; a broader semantic change needs a concrete recommendation.

- Reproduce accepted/rejected timestamp cases with a small synthetic fixture containing no protected task data.
- Document the selected semantics and affected operations; cover valid, timezone-free and malformed values with deterministic checks.
- Verify actual affected responses through replay, or document a reproducible unsupported result. The task-solving replay belongs to 037; closing this investigation with an unsupported finding does not imply pilot readiness.
- Preserve the inspected task as development-only and keep raw artifacts local. Any new model campaign needs a frozen matrix and spend cap.
