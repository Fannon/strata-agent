# AppWorld offline-compatibility spike (issue037)

Status: **implementation awaiting supervisor verification.**
No successful runs have been observed by this author; do not treat the
commands below as tested. Do not claim any benchmark or model gains.

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

## Connection path (verified against upstream source, not yet run)

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
- Unsupported schema constructs encountered: none (all 98 ops generated
  declarations without `any` fallbacks or errors).
- Lifecycle gaps found and fixed during the spike (setup, not framework):
  the venv needed `appworld install` to unpack its test bundle before
  servers start, and the controller must not resolve the venv-python
  symlink (a resolved path boots a bare interpreter and kills the MCP
  child instantly).

## Go / no-go for a matched lazy-direct versus typed pilot

- Technical readiness: **GO**. The full path (fresh world → stdio MCP →
  typed program → save → upstream grade) is proven end-to-end with
  artifacts a supervisor can re-inspect.
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
- Harness signal (the point of the spend): the typed path worked throughout —
  38 programs, 33 `ok`, 83 broker calls, zero direct-tool attempts. Agent
  strategy failed, not the harness: correct setup (active task → profile →
  passwords → `spotify__login`, which it then repeated defensively in most
  programs) followed by wandering — `search_songs` ×11, queue/play/add calls,
  `show_*_privates` ×15 looking at likes — without ever converging on the
  most-liked computation or submitting.
- Side effect note: the agent issued state-changing calls (`add_song_to_playlist`
  ×4, queue/play calls) it was never asked to make. No task authorized
  modification; future pilots should track unauthorized effects as 037
  requires ( today: observed, not fenced).
- Reading: at 40 requests the agent explored rather than exploited; success
  needs tighter prompting (submit-what-you-have rules), a longer budget, or
  task families where the answer computation is more scaffolded. No framework
  change is indicated by this run; do not tune prompts against `82e2fac_1`
  (development-only) — any prompt revision must prove out on uninspected tasks.
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
