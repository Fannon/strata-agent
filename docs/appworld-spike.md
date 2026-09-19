# AppWorld offline-compatibility spike (issue037)

Status: **task-solving replay delivered and repeated from reset; 040 resolved and live-verified.**
The handwritten solver completed development task `82e2fac_1` twice from fresh worlds (completed=true, 2 passes / 0 failures both runs). No comparative gains are established. The subsequent [042 pilot](../.work/issues/042-matched-application-comparison.md) observed worse typed results, but the September 19 review found the typed Pi entry point ignores the compatibility setting used by direct tools. Manual replay success did not establish model-facing parity. [045](../.work/issues/045-pilot-entrypoint-validation-parity.md) now proposes that offline regression and fix; no new campaign is selected.

## Pins and environment

- Upstream AppWorld pin: `42b5bcf3cd334fee33f0c37c02070a9f5807add5`
- AppWorld package: `0.2.0.dev0`; data bundle: `0.2.0`
- Python: `3.11`; MCP SDK: `2.2.0`
- Installed under `.work/appworld` (venv at `.work/appworld/venv`,
  interpreter `.work/appworld/venv/bin/python`).
- Protected bundles, generated schemas, and task programs stay local
  under `.work/appworld`; nothing AppWorld-derived is committed.

## What this spike owns

- `examples/appworld/controller.py` — Python controller: parses CLI
  options, creates a fresh upstream world per run with a unique
  experiment name, writes local `config.json`, launches the bun replay
  harness (`replay.ts`), always calls `world.save()` after replay so
  `world.evaluate()` sees replay effects, and serializes only aggregate
  grader counts (`len(tracker.passes)`, `len(tracker.failures)`,
  `completed=world.task_completed()`, replay exit, mode, task, pins).
  Never serializes ground truth or direct DB state.
- `examples/appworld/replay.ts` — bun harness: validates the controller
  config, connects to the upstream AppWorld MCP server over stdio,
  preserves real schemas exactly, writes manifest/declarations/summary
  locally, and in run mode executes a LOCAL user-supplied TS module
  exporting `main` via the existing session on default QuickJS.
- Nothing else in the repo was touched; no framework or core changes.

## Commands (for the supervisor to run)

Inspect (schema/session check only, unsolved task may still grade-fail):

```sh
.work/appworld/venv/bin/python examples/appworld/controller.py \
  --task <task_id> --inspect \
  --out .work/appworld/out-inspect-<unique> \
  --apps supervisor,spotify
```

Run (requires a local TS program exporting `main`):

```sh
.work/appworld/venv/bin/python examples/appworld/controller.py \
  --task <task_id> --program /absolute/path/to/local-program.ts \
  --out .work/appworld/out-run-<unique> \
  --apps supervisor,spotify
```

Notes:

- `--out` must be a new directory under `.work/appworld`; the
  controller refuses to overwrite existing output dirs.
- `--experiment` is optional; when omitted a unique name is generated.
  Every run gets a fresh world and a unique experiment.
- `--root` defaults to the absolute `.work/appworld`.
- Inspect exit 0 requires replay/schema inspection success even when
  the grader fails; normal run exit 0 requires replay exit 0 AND task
  completion AND zero grader failures.
- Existing connector uses stdio; the AppWorld API backend is a
  loopback HTTP server managed by upstream (`AppWorldServers`).
  No new TS HTTP adapter was added.

## Task-selection caution

- First selected train task `82e2fac_1` is development-only: an earlier
  author inspected the supervisor DB, so no model score may be claimed
  on it. Later trials must use uninspected tasks.

## Connection path (exercised by the recorded smoke)

- Controller starts `AppWorldServers(experiment_name=..., remote_apis_port="{port}")`
  and opens `AppWorld(task_id=..., **servers.defaults)`; ports are auto-assigned.
- Replay spawns the stdio MCP server with the venv Python:
  `python -m appworld.cli serve mcp stdio --app-names <csv> --output-type both
  --remote-apis-url <loopback-url> --root <appworld-root>` — the same argv
  upstream's own `build_mcp_config` emits for stdio, with `APPWORLD_ROOT` and
  `APPWORLD_CACHE` set in the child environment. No HTTP transport added.
- Tool names are `{app}__{api}` (upstream splits on the first `__`); the replay
  allows exactly the discovered manifest names and invents none.
- With `--output-type both`, each call returns JSON text plus structured data;
  Strata's existing stdio connector passes input/output schemas through
  untouched (`outputSchema` may be absent per tool and is counted, not faked).
  If `declarations()` cannot express a construct it throws and the replay
  records `schemaError` and exits nonzero instead of substituting `any`.

## Save/evaluate behavior

- `world.save()` runs after every replay (success or failure) so `evaluate()`
  observes replay effects; a save failure is recorded as `save_error.txt`
  without skipping grading.
- Grading is only upstream `world.evaluate()` → `TestTracker` plus
  `world.task_completed()`; `result.json` keeps aggregates only (pass/failure
  counts, completion flag, replay exit, versions, paths) — never expected
  answers or DB state. Run-mode exit 0 requires replay exit 0 AND completion
  AND zero grader failures; inspect-mode exit 0 requires only replay/schema
  success. Timeouts, spawn failures and nonzero exits are distinct artifacts.

## Status: replay completed, graded, not a benchmark

- Inspect (free, no model): 98 operations (92 spotify + 6 supervisor),
  0 missing output schemas, 215 KB declarations, exit 0.
  Artifacts: `.work/appworld/inspect-20260914T071502Z/`.
- Typed replay (free, handwritten dev program, no model): outcome `ok`,
  2 capability calls through default QuickJS (~0.3 s compile, ~0.1 s exec),
  749 raw bytes reduced to 128 exposed. Returned real data: instruction
  present, 10 genres (`EDM`, `R&B`, `indie`, ...).
  Artifacts: `.work/appworld/run-20260914T074208Z/`.
- Independent grading: upstream `evaluate()` ran on the replayed world and
  correctly reports the task incomplete (the smoke program answers nothing).
  Aggregates only; no expected answers serialized anywhere.
- Output-envelope lesson: call payloads nest under a `response` key
  (success/failure `anyOf` envelope). Programs must unwrap it; the dev
  program's first version read top-level fields and got empty results with
  outcome `ok`. Fixed in the local program — no framework change needed.
- Declaration generation succeeded for all 98 operations without `any` fallbacks or errors. Later real responses exposed date-time incompatibility; generation success does not establish runtime compatibility.
- Lifecycle gaps found and fixed during the spike (setup, not framework):
  the venv needed `appworld install` to unpack its test bundle before
  servers start, and the controller must not resolve the venv-python
  symlink (a resolved path boots a bare interpreter and kills the MCP
  child instantly).

## Go / no-go for a matched lazy-direct versus typed pilot

GO for gate-3 offline preparation (2026-09-16): gates 0–2 delivered —
verified environment, resolved + live-verified data contract, real task
solved twice from reset. Gate 4 (paid pilot) still needs a frozen
matrix and spend-cap approval.

- Transport/replay readiness: demonstrated for the smoke path (fresh world → stdio MCP → typed program → save → upstream grade). Matched-pilot readiness remains blocked on the date-time compatibility decision and a task-solving replay; see 040.
- Conditions before any pilot spend: use uninspected tasks only
  (`82e2fac_1` is development-only — its database was inspected by an
  earlier author, so it can never be evidence); build the lazy direct-tool
  reference arm first with identical discovery, backend and policy;
  predeclare matrix, budget, repetitions, model, executor and declarations.
- No benchmark score and no many-tool gain has been demonstrated. Nothing
  in this spike compares typed programs against anything.

## Paid development run (author-paid, dev-only, not evidence)

- Command: `examples/appworld/paid_driver.py` (committed generic scaffold;
  per-run outputs stay local) holds servers + world open, points a typed-only
  (`STRATA_STRICT=1`) Pi agent at the live world via Strata's MCP extension
  path with the inspected 98-name allowlist, then saves and grades upstream.
  Model `meta/muse-spark-1.3-contributor`, medium reasoning, 40-request / $5
  guard cap. Artifacts: `.work/appworld/paid-20260914T080724Z/`.
- Cost: 40/40 requests used, guard stopped cleanly at the cap; ~361 K in-tokens
  + ~39 K out-tokens ≈ **$0.044 actual** (key-delta reconciliation pending).
- Outcome: task NOT solved (0 passes / 2 failures, grader correctly
  incomplete). The agent never called `supervisor__complete_task`.
- Initial trajectory observation (superseded by the validation diagnosis below):
  38 programs, 33 `ok`, 83 broker calls, zero direct-tool attempts. Agent
  failure was initially attributed to agent strategy: correct setup (active task → profile →
  passwords → `spotify__login`, which it then repeated defensively in most
  programs) followed by wandering — `search_songs` ×11, queue/play/add calls,
  `show_*_privates` ×15 looking at likes — without ever converging on the
  most-liked computation or submitting.
- Side effect note: the agent issued state-changing calls (`add_song_to_playlist`
  ×4, queue/play calls) it was never asked to make. No task authorized
  modification; future pilots should track unauthorized effects as 037
  requires ( today: observed, not fenced).
- The initial prompt/strategy interpretation is superseded by the output-validation finding below. Do not infer that longer budgets or prompt tuning would fix this run. The inspected `82e2fac_1` remains development-only.
- Root cause found on trajectory review (2026-09-14, local artifacts only):
  the agent's strategy was largely correct — login succeeded, then the very
  data it needed arrived (3,958 bytes from `show_playlist_library`) and OUR
  broker's output validation threw it away: AppWorld emits datetimes as
  `"2019-01-01T00:00:00"` (no timezone; see upstream API docstrings) while
  our schemas enforce strict RFC 3339 `date-time`. Same failure on
  `show_song_library`/`show_liked_songs` (`added_at`, `liked_at`). The
  "wandering" above was mostly fallback attempts after data-bearing calls
  kept erroring. This is a harness gap, not an agent gap: date-time format
  semantics are the first confirmed unsupported-schema-construct instance
  for 037. Fix direction (supervisor decision, not implemented): relax or
  extend `date-time` handling in validation versus documenting the
  construct as unsupported. No prompt tuning implication.
