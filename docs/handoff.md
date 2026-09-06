# Next-agent handoff

Reviewed 2026-09-06 at `807562a`. Read [AGENTS.md](../AGENTS.md), [README](../README.md), [ACD](../ACD.md), [trial report](repo-trials.md) and the tracked [issue board](../.work/issues/index.md). `.work/issues/` is checked in; other `.work/` artifacts are ignored. This pass reconciles documentation and proposes next work; it does not start implementation or paid trials. Existing explicit task/spend authorization remains authoritative within its scope.

## Current implementation

- Pi extension: `typed_program`, capability search/load, `program_details`; schema-derived declarations, static checking, runtime broker validation and operation grants.
- Repository reads: `readText` line ranges, `searchText` include/exclude globs and narrowing hints, `listFiles`, `gitStatus`, `gitLog` per-commit paths, `gitDiff`, `gitShow`. Best-effort root checks and bounded outputs; no mutation approvals or edits/checks capability.
- Default QuickJS and opt-in Bun (`STRATA_EXECUTOR=bun`) share contracts, checking and fresh execution. Bun has ambient host authority. Disabling direct Pi tools does not make Bun API-exclusive.
- Correlated local tracing and quiet success/on-demand details (026/031) are implemented. Full reports live outside model-facing success content. Policy-aware catalog search (029), load/shutdown race (025), memory (030) and configurable caps (034) remain open.
- Hardened fixture and repo-2 runners, original seeded R-EXPORT/R-LOG/R-LOC families, four reference repository workflows and model-free executor probes are implemented.

## Latest evidence and decision

Four repository rounds contain 120 cells: 116 exact answers, 114 overall successes, with policy failures separate. One model, two repetitions per task/profile, evolving prompts/tasks and reused held-out instances limit generalization. Dev+held-out typed profiles used fewer Pi tool calls but about 2–2.2× estimated cost and 2.35–2.72× total tokens relative to stock. No stable latency or correctness advantage is established. See the [report and sanitized artifacts](repo-trials.md) for per-stage results and accounting discrepancies.

The typed capability layer remains the architectural commitment; engine choice is not the next bottleneck to optimize. The recommended next selected slice is **004 context-cost attribution and compact declarations**, followed by a bounded independent-work check. Do not repeat completed 016/011/026/027/031 or path-prefix close-out work. Do not infer that aggregation-only or hybrid wins from these trials.

## Concrete next slice

1. Inventory effective system prompts, declaration bytes, generated source, result/error sizes, model responses and token/cache categories from existing artifacts. Establish what is measured versus estimated; do not call declarations the proven cause yet.
2. Keep the complete operation surface and semantic validation fixed. Compare baseline declarations with one concise presentation on a fixed executor; retain critical path, bounds, completeness and error semantics. No oracle-selected operation subset. An operation-discovery experiment is separate.
3. Validate deterministic declaration/contract parity and reference workflows. Predeclare a small paired development matrix and remaining spend cap before calling a model. Count all attempts and failures, and report policy flags separately.
4. Confirm on new, uninspected task families/repos if promising; previously inspected -3/-4 instances are regression data now. A second model tests portability after the first result. Limit tuning and decide retain/revert/narrow/stop.

Coverage sampling (013/033 under 032) is optional independent input. Statistical/semantic ambiguity is not a target: use realistic distractors with a clear oracle. Broad editing/checks, persistence, unrestricted Bun, supersession and sandbox development are separately selected experiments.

## Verification and practical commands

Use `bun run check`, `bun test`, `bun examples/repo-workflows.ts` and the offline default of `bun examples/repo-pilot.ts`. Tests require local subprocess and loopback access; sandbox failures are not automatically implementation regressions. See the current verification entry in the issue board. No live run is authorized merely by a command example. Preserve private requests/profiles and publish only sanitized evidence.
