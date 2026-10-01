# 054 — Broader composition benchmark with complete efficiency reporting

Status: SELECTED 2026-10-01 — implement and run after committing/pushing the current documentation checkpoint
Dependencies: 049/051 (development evidence), 009 (independent tasks and accounting), 048 (native Pi); 052/053 only if separately selected changes are included

## User direction and problem

The user questioned conclusions from six attempts and requested turns, tokens, elapsed time and cost in every comparison. We recorded those measurements in 049/051; the [combined report](../../docs/checking-policy-comparison.md) and [sanitized data](../../docs/evaluations/checking-policy-2026-10-01.json) now publish them. Reporting requirements are added to AGENTS.md and the evaluation plan. This small reporting work does not select another benchmark.

Each natural policy sample had **two distinct tasks repeated three times on the same world**. More repeats alone cannot establish breadth. Native Pi and Strata both composed these easy workflows correctly; seeded mistakes tested checking behavior but did not estimate its natural benefit or include native Pi's recovery.

Subsequent authorization: the user requested that, once README/documentation updates are pushed, we focus on the benchmark improvements/extensions, run again and report what we learned. This selects the broader comparison below after publication. It does not select production fixes under 052/053; compare the current implementation and retain the existing working €5 allowance with simple usage accounting. Freeze actual tasks, limits and scoring before paid cells. No new benchmark call occurred during the publication preparation.

## Proposed next scope, only if selected

1. Use **20 distinct workflow definitions**, distributed across five useful families with four definitions each: multi-service joins; paginated/large-data aggregation; stateful updates with independent verification; unfamiliar but accurately described API contracts; recovery from controlled service failures. Definitions must differ in workflow structure, not only invoice amounts or names. Include straightforward cases as well as demanding ones; do not engineer a suite solely to favor checking.
2. Freeze a small disjoint development set for setup before freezing untouched evaluation tasks. The old invoice tasks remain regression material. If 052/053 or prompts are changed, select that change separately, tune only on development tasks and freeze a new version before evaluation.
3. Focus the primary question on **native Pi Codemode versus current Strata always-check**, rather than multiplying every task by all checking policies. Use both selected model families, with one fixed supported reasoning setting per model across approaches. **20 tasks × 3 fresh repetitions × 2 approaches × 2 models = 240 evaluation cells**, plus explicitly accounted development work. This is a proposed breadth increase, not a statistical-power guarantee or an authorized spend forecast.
4. Give both approaches the same underlying service operations, schemas/descriptions, data, grants, runtime validation, reset state and observable recovery evidence. Native Pi keeps its actual composition capabilities. Record interface differences rather than pretending the prompts/runtimes are identical. Compare critical effects only under equivalent permissions and backend constraints.
5. Rotate/randomize approach order within task/model/repetition blocks. Reset independently; specify cold-start versus warm infrastructure and cache policy. Pin versions, model settings, source/task hashes and limits before any paid cell.
6. Freeze separate business-result/effect correctness and final-answer-format scores. A correct-looking answer cannot override wrong state. State grading must count missing, duplicate and unintended effects. Preserve old strict grading; do not retroactively turn fence failures into passes. A structured-output setup, if chosen, must apply fairly to both approaches.
7. Run a separate, clearly labeled recovery diagnostic with matched erroneous prior attempts for native Pi and Strata if prevention/recovery is the question. Keep controller-authored mistakes separate from natural model mistakes. Do not interpret the injected failure rate as a production error frequency.

## Required comparison output

- Attempt count, distinct task definitions, repetitions, family/model/effort and uncertainty.
- Strict completion, business answer/effect correctness, output compliance and omission/duplicate/unintended-effect counts.
- Model requests (turns), tool calls, capability invocations, diagnostics and repairs separately.
- Input, output, cache reads/writes and reasoning where reported; complete accounting without double-counting.
- Estimated total model cost, mean per attempt and total cost divided by successes, including failed work; pricing provenance and missing usage explicit.
- Median and P90 wall time for all attempts, successful-attempt timing as a supplementary view, and available setup/compiler/runtime breakdowns. Do not claim a faster incomplete run is a faster successful workflow.
- Paired differences on the same tasks, and task-block uncertainty preserving repetitions within task blocks. Twenty tasks and three repeats are still a modest sample; choose any confirmatory sample size from the observed variation and a predeclared useful margin rather than announcing a win from a point estimate.

## Working order and completion if selected

First choose useful workflow definitions and scoring; then settle whether any separately selected result/recovery fix is in scope; preflight on development material; freeze the comparison; run the matrix under a simple explicit cap; report every attempt and the full efficiency table. Confirmation on further untouched workflows is a later selection if a useful signal appears. Large catalogs, persistent memory, universal adapters and additional models are not automatically included.

Complete with a versioned reproducible corpus, independent state grader, sanitized cell metrics and a retain/narrow/stop decision. No model calls have been made for this proposal.
