# 027 — Replaceable executor and direct Bun comparison

Status: delivered; deterministic comparison and four repository model-trial stages complete, broader generalization unproven
Dependencies: existing capability contracts and useful repository tasks; minimal 026 tracing accompanies this slice. Full observability and proof of QuickJS overhead are not prerequisites.

## Decision

The typed capability layer is enduring; execution is replaceable. Keep QuickJS as the working baseline and evaluate direct Bun for native ergonomics, maintenance cost and performance. Do not couple MCP, APIs or repository contracts to interpreter details. Preserve checking, validation, permission-aware functions and observability across engines.

## Implementation plan

- [x] Define the smallest executor contract needed by the two real implementations: checked emitted code/bindings, result/errors, cancellation and trace events. Avoid a plugin framework or speculative engine integrations.
- [x] Implement opt-in direct Bun in a disposable worker/process; keep Pi's host context separate. Preserve fresh execution and semantic checking. Retain QuickJS selection and existing tests.
- [x] Route supplied capability functions through shared validation, grants and instrumentation. Record that ambient Bun access can bypass wrappers; import checks and declarations do not establish containment.
- [x] Label cooperative/API-adherence mode separately from enforced API exclusivity. Record external restrictions and match the shell baseline where possible. An externally confined variant requires a concrete supported mechanism, not a worker-only claim.
- [x] Add minimal 026 correlation/timings; measure no-op startup, trivial calls, sequential/parallel calls, payload scaling and identical computation, then useful repository tasks. Report compiler time separately, memory, end-to-end latency and maintenance complexity.
- [x] Test cancellation/recovery, result/error parity, casts/unknown operations and ambient-access attempts. Use independent effect counters; wrapper logs cannot establish absence of bypasses.
- [x] Run matched task comparisons only within selected budget; preserve contracts, checker, model and task data. Persistence/checking ablations remain separate.

## Delivery (2026-09-06)

`executeWith` in `src/runtime/executor.ts` is the contract; `src/runtime/bun-runner.ts`
runs rewritten programs in a disposable worker (per-run temp-file import — Bun
does not evaluate `data:` URLs as modules), `src/runtime/capability-imports.ts`
owns the import rewrite. Selection via `STRATA_EXECUTOR=bun` or per-run option;
`metrics.engine` and trace events record the engine. Tests:
`test/integration/executor-bun.test.ts` (11 tests: rewrite units, invocation/
composition/sequential/parallel parity, error-category parity, fresh state,
result caps, timeout/cancellation + recovery, repo parity, ambient-globals
difference, host-write canary proving non-containment) plus a
`sessionFromConfig` executor test. Full suite 87 pass.

Deterministic comparison (`examples/executor-compare.ts --repeats 3`, offline,
model-free, alternating engine order, compiler warmup; raw JSON local-only in
`.work/executor-compare.json`): identical results and byte-identical broker
errors on both engines; matching cancellation/timeout/recovery and repo
read/denial behavior; Bun tens of ms faster per run (21→7 ms startup, 95→36 ms
at 10k records, fib 29→8 ms) — real but noise against model latency, and no
QuickJS bottleneck was found or required; tracing overhead within noise on both
engines; ambient probe shows QuickJS contained (`undefined`/canary absent) and
Bun ambient (`object/object/function`/canary `effect`). Write-up:
`docs/executors.md`. Recommendation: keep both — QuickJS default, Bun opt-in.

Repository model comparisons are delivered; see [reviewed trial report](../../docs/repo-trials.md). Keep both engines, QuickJS default/Bun opt-in. There is no stable task-level engine advantage established and no need for another engine-only campaign before 004. Earlier “no paid runs” statements refer to the deterministic delivery, not the current project state.

Acceptance: two explicitly selectable execution modes with shared capability semantics, tested lifecycle behavior and honest enforcement labels; evidence supports retaining, changing or offering both engines. No requirement that Bun wins, and no prerequisite sandbox project.
