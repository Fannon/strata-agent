# Next-agent handoff

Reviewed 2026-09-14 from `4e04e94`. Read [AGENTS.md](../AGENTS.md), [README](../README.md), [ACD](../ACD.md), [trial report](repo-trials.md) and the tracked [issue board](../.work/issues/index.md). Issues are tracked; raw local artifacts remain ignored. The user authorized issue 037's recommended sequence, with most work delegated to Pi (`openrouter/meta/muse-spark-1.3-contributor`, medium); the supervisor scopes tasks, reviews changes and verifies results. New comparative model campaigns still need a concrete matrix and spend cap.

## Current implementation

- Pi extension: `typed_program`, capability search/load, `program_details`; schema-derived declarations, static checking, runtime broker validation and operation grants.
- Repository reads: `readText` line ranges, `searchText` include/exclude globs and narrowing hints, `listFiles`, `gitStatus`, `gitLog` per-commit paths, `gitDiff`, `gitShow`. Best-effort root checks and bounded outputs; no mutation approvals or edits/checks capability.
- Default QuickJS and opt-in Bun (`STRATA_EXECUTOR=bun`) share contracts, checking and fresh execution. Bun has ambient host authority. Disabling direct Pi tools does not make Bun API-exclusive.
- Correlated local tracing and quiet success/on-demand details (026/031) are implemented. Full reports live outside model-facing success content. 025 load/shutdown guards (explicit connector ownership, idempotent cleanup) and 029 policy-aware catalog search (deny-first filtering, fail-closed, full declarations alongside grant-filtered operation lists) are delivered. Fixture fingerprints for reproducible manifests are delivered under 009. Memory (030) and configurable caps (034) remain open.
- Hardened fixture and repo-2 runners, original seeded R-EXPORT/R-LOG/R-LOC/R-CALL families, four reference repository workflows and model-free executor probes are implemented.

## Latest evidence and decision

Four repository rounds contain 120 cells: 116 exact answers, 114 overall successes, with policy failures separate. One model, two repetitions per task/profile, evolving prompts/tasks and reused held-out instances limit generalization. Dev+held-out typed profiles used fewer Pi tool calls but about 2–2.2× estimated cost and 2.35–2.72× total tokens relative to stock. No stable latency or correctness advantage is established. See the [report and sanitized artifacts](repo-trials.md) for per-stage results and accounting discrepancies.

The typed capability layer remains the architectural commitment; engine choice is not the next bottleneck to optimize. **004 attribution and compact development testing are delivered; the 2026-09-13 R-CALL confirmation (12 cells: stock 4/4, full 3/4, compact 2/4) is negative/inconclusive** — all three typed misses returned correct answers but failed policy/harness checks, and compact cost/success ran ~16% above full, failing the predeclared ≥15%-below bar. Compact achieved 12/12 successes versus full 12/12 and reduced estimated cost per success by 26.4% in the earlier 36-cell paired development run; it remains opt-in, with full declarations the default. This is development evidence only, not independent confirmation or a win over stock. Do not repeat completed 016/011/026/027/031 or path-prefix close-out work. Do not infer that aggregation-only or hybrid wins from these trials.

## Concrete next steps

1. The selected 037 AppWorld offline spike is in progress: pin revision and terms, start one disposable world, run one handwritten typed program with upstream grading, add an equally lazy direct-tool reference, and predeclare a small development selection before any paid calls. This is the authorized next sequence; it is not delivered.
2. Before reusing the affected repository evaluator, diagnose the missing reports tracked in [038](../.work/issues/038-missing-typed-program-reports.md). Further independent confirmation under 009 would need a separately frozen experiment: freeze fresh task families, artifact provenance, model/settings, full versus compact versus stock, success margin and cost threshold before inspecting answers or spending. Previously inspected -3/-4 instances and the now-used R-CALL family are regression material.
3. Keep prompt wording (036), engine changes and discovery policy experiments separate from the compact presentation comparison. A second model follows positive independent confirmation; negative results may justify narrowing or stopping.

Coverage sampling (013/033 under 032) is optional independent input. Statistical/semantic ambiguity is not a target: use realistic distractors with a clear oracle. Broad editing/checks, persistence, unrestricted Bun, supersession and sandbox development are separately selected experiments.

## Verification and practical commands

Use `bun run check`, `bun test`, `bun examples/repo-workflows.ts` and the offline default of `bun examples/repo-pilot.ts`. Tests require local subprocess and loopback access; sandbox failures are not automatically implementation regressions. See the current verification entry in the issue board. No live run is authorized merely by a command example. Preserve private requests/profiles and publish only sanitized evidence.
