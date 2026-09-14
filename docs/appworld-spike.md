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

## Status: not yet executed

- `bun run check`, `--inspect`, and the typed replay have NOT been run by this
  author; the commands above are written but unverified. No benchmark score,
  no many-tool gain, and no task success has been demonstrated.
- Open before any graded replay: confirm inspect `summary.json`
  (operation count/names, missing output schemas, declaration bytes), then
  re-verify `.work/appworld/dev-smoke.ts` argument shapes against it.
- Go/no-go for a matched lazy-direct versus typed pilot: **pending** — due
  only after one typed replay is completed and independently graded.
