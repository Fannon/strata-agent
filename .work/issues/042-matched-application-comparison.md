# 042 — Compare typed composition with equally capable direct tools

Status: planned next slice of the already selected 037 sequence; offline preparation precedes any separately approved model campaign
Dependencies: 037 completed task-solving replay; 040 compatibility disposition; verified execution environment

## Question

On application tasks requiring several related calls, does checked TypeScript composition improve task completion, cost or latency relative to direct tools with the same discovery and access? Simple calls and server-side aggregation are controls where composition may add little. This tests the combined typed-program interface, not the isolated causal effect of typechecking.

## Offline deliverables

1. Implement a bounded benchmark-local direct-tool arm over the same MCP operations. Share operation metadata, search/load results, grants, input/output validation (including any explicit compatibility adaptation), reset state and upstream grader with the typed arm. Direct calls must not bypass validation that can reject typed results.
2. Make discovery parity real. The production catalog currently supports CLI-twin entries, not arbitrary MCP catalogs. Use the smallest experiment-local shared discovery/load surface; do not build a general enterprise catalog. If that is not feasible, propose a clearly labeled identical-preloaded comparison and its limits before spending; never call preloading lazy discovery.
3. Keep pure computation available in both arms. Predeclare whether the direct arm may use ordinary scripts and how those scripts access data. Match reachable backend operations and external restrictions, document unavoidable differences, and do not manufacture a benefit by removing ordinary baseline abilities. Use default QuickJS for the typed arm initially; do not mix executor or declaration tuning into this comparison.
4. Add deterministic checks for matching tool visibility/results, reset and save behavior, deliberate invalid outputs, forbidden-effect accounting, incomplete runs, missing usage and budget refusal. Treat success, policy and harness health as separate fields. Confirm whether any reused grading path inherits 038.
5. Produce a dry-run matrix and a concise parity table. Record task/model/runtime/schema versions and adaptation provenance. Keep raw requests, protected data and task solutions local; commit only permitted sanitized summaries and reproducible harness code.

## Proposed development pilot (freeze before running)

Starting proposal: six development tasks, two per category (single-call/simple control, dependent read/aggregation, state-changing workflow), two arms, three fresh-world repetitions: 36 cells. Use only tasks not already inspected for answers; the known inspected smoke task stays regression-only. If the upstream corpus cannot supply a category, document the actual coverage instead of inventing official tasks. Confirmatory tasks remain untouched and separate.

Freeze exact task IDs, order/counterbalancing, model/provider/reasoning, prompts, executor, declarations, discovery rules, per-cell time/request/token caps and total cost reservation. Compute a concrete spend proposal from current model metadata; old development budgets are not automatically the pilot budget. Both arms use the same retry policy; retain all attempts.

Primary measures: upstream task completion, total estimated cost divided by successful completions (including failed work), and end-to-end latency. Also record unauthorized effects, harness failures, tool/model/backend calls, declaration/discovery/program/result tokens where available, and integration effort. Zero successes means cost per success is undefined, not zero. Correct recorded calls are not completed tasks.

## Decision rule

Before the pilot, freeze a development screening rule. Suggested starting rule: typed completion is no lower in observed counts, with at least 15% lower total cost per success or median latency, and no worse observed unauthorized-effect count. Report paired task results and tails; a small pilot cannot establish equivalence or general superiority. A signal limited to composition tasks supports narrowing, not a universal claim.

- Positive, healthy signal: design untouched confirmation under 009; use pilot variance to select its size.
- Useful only in one task category: narrow the hypothesis and confirm that category.
- Harness/contract faults: repair deterministically and version the next experiment; preserve the original results.
- Healthy negative/inconclusive result: report it and decide whether to stop or select one justified follow-up. Do not automatically add transports, memory or tuning rounds.

Acceptance for offline preparation: reproducible arm-parity checks, an executable no-spend dry run, explicit remaining differences, and a reviewable matrix/budget proposal. Paid pilot acceptance is a separate report, not a requirement to finish the offline worker assignment.
