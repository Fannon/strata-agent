# 004 — Attribute and reduce typed-context cost

Status: ready for selection; recommended next slice (2026-09-06)
Dependencies: delivered 026/031 instrumentation and 028 repo-2 artifacts; no new tool or executor required.

## Evidence and hypothesis

Dev+held-out: typed profiles made fewer tool calls but cost about 2–2.2× stock with 2.35–2.72× total tokens. Prompts include 17–17.5 KB declarations. This is a correlation: source, other instructions, cache behavior, repair turns and output also contribute. See [reviewed report](../../docs/repo-trials.md). Quiet success is already implemented; do not rebuild 031.

Hypothesis: a concise presentation of the same capability contract reduces total cost without worsening task success or repair burden. Goal is a fair test, not making Strata win.

## Slice A — offline attribution

- [ ] Summarize exact effective request components: declarations, fixed instructions, generated programs, prior results/errors and model-response counts. Record bytes separately from estimated tokens; retain actual input/output/cache usage. Repeated context is not necessarily uncached billing.
- [ ] Inspect why stock uses fewer tokens: classify composition and output selection from a bounded sanitized sample. Count Pi tool calls separately from model responses and broker calls.
- [ ] Account for declaration generation and prompt injection in one place; distinguish source schemas, compiler declarations and model-facing docs. Propose one compact model-facing presentation retaining every operation, input/output type, enum and critical semantic constraint.
- [ ] Produce an offline size report and declaration/type-contract parity checks. Preserve grants, runtime schemas, task access and error behavior. Do not select operations using hidden answers. Per-task subsets or on-demand loading change a different factor and require a separate labeled experiment.

## Slice B — bounded paired development trial

- [ ] Use one fixed executor/model and baseline versus compact presentation on existing development tasks. Match backend, checker, caps, policy and fresh-run state. Include stock as the reference, without restricting its scripting.
- [ ] Predeclare matrix, budget, ordering and practical improvement threshold using docs/evaluation.md. Use existing explicit authorization only within remaining scope; otherwise obtain a concrete spend selection. Preserve all attempts, policy flags, missing usage and cost discrepancies.
- [ ] Compare task correctness, overall success, estimated cost per success, model responses, context categories and median/tail latency. Report uncertainty and regressions; do not optimize bytes alone.
- [ ] At most two coherent development revisions. Retain/revert with evidence. If promising, confirm on new uninspected repository/workflow families; the original held-out -3/-4 instances were inspected and rerun and are now regression material. Add a second model after the initial development signal.

## Decision

If full-surface compact presentation helps, retain it and test independent work. If it does not, do not keep shrinking semantics or inventing harder tasks until a win appears. Consider a separately measured hybrid/structured-service niche or keep the project as a learning harness. Aggregation superiority is unproven. No new engines, persistence, configurable caps or arbitrary Bun access in this ablation.

Acceptance: reproducible attribution and a versioned, bounded retain/revert/narrow decision, with complete API semantics preserved. An inconclusive or negative result completes the experiment honestly.
