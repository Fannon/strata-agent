# Evaluation plan: can typed composition earn its cost?

Status: proposed protocol v2, 2026-09-05. This is a plan, not a benchmark result. The existing runner implements only the exploratory fixture protocol v1. See [ACD](../ACD.md) for design hypotheses and [prior-art research](research/typed-agent-prior-art.md) for Pi/Prime differences.

## Existing evidence

At `5079c4d`, `bun run check` and 41 integration tests pass (verified locally with Bun 1.4.1-canary.1). Tests establish compilation, broker validation, fixture parity, fresh execution and discovery behavior. Direct runtime cancellation tests pass; they do not cover the current Pi extension dropping its execute signal.

The local v1 artifact `baseline-2026-09-05T08-37-15Z` reports 9/12 accepted cells, one per task/condition, approximately $0.0062 estimated model cost. Preserve it unchanged. It demonstrates execution viability, not a performance conclusion. Its substring checkers can accept wrong answers; T4 checks tool text without proving final reporting or recovery; timeouts may receive `pass: true`; T3's `total` is ambiguous. The earlier `08-28-22Z` run had a broken relative config path and remains excluded. The separate discovery demo is not a repeated condition-D comparison.

## Questions and conditions

Primary question: with equivalent access and a fixed model, does Strata preserve task success while lowering total token cost, elapsed time, or retries on useful repository workflows?

| Condition | Purpose and available tools |
| --- | --- |
| A: stock Pi | Pinned default read/write/edit/bash; permit pipelines, jq, Python, Bun and scripts where installed. No forced one-call-at-a-time baseline |
| B: typed single-operation | Same typed APIs as C, one broker operation per program; instrument violations. Isolates composition benefits, not static typing alone |
| C: typed composition | Same Pi/model as A/B; generated TS and broker functions, strict removal of direct built-ins; free bounded composition |
| H: hybrid Pi + Strata | Both paths available; measure tool choice and actual shell fallbacks instead of treating fallback as a pure typed win |
| D: discovery ablation | C with selected APIs discovered vs preloaded; run only once catalog size/tasks make discovery meaningful |
| P: Prime/IPython | Pin upstream commit, prompt, model/provider, skills and runtime. Persistent Python kernel and bash helper are allowed as upstream supports |

A/B/C are the initial causal comparison. H and P follow the usable native slice; D is conditional, not a prerequisite. Prime differs in prompt, state, skills and harness, so P measures whole-system performance, not the isolated effect of Python vs TypeScript. If isolating state/language matters later, add a narrowly matched Pi/IPython or stateless-Python condition as its own issue. Do not strip Prime's central capabilities and still label it stock Prime.

Disable tool surfaces for C/B through Pi configuration/extension behavior; a prompt prohibition alone is an adherence test, not access control. Available operations/data must be equivalent across conditions. An unrestricted A and restricted C security task is not a fair security comparison: give both the same OS policy or report policy modes as separate experiments. B/C may share the same fixture backend for mechanism tests; compare native adapters on seeded real repositories for product tests. Log implementation and backend versions separately.

## Task corpus and grading

Keep fixture tasks as inexpensive diagnostics. Use seeded repository snapshots, generated variations and independently computed answers for real workflows:

1. Orientation: manifest, source/test trees, optional `.work` board, Git status and last commits, matching the motivating example.
2. Search → read: find call sites and inspect relevant ranges; include ignored files, Unicode and unusual filenames.
3. Git reasoning: distinguish staged/unstaged changes, rename/untracked paths and history, with dirty working trees.
4. Large aggregation: `totalRecords`, `matchCount`, `selectedIds` have exact, independent definitions and ordering.
5. Recovery: wrong argument followed by a valid query; missing file vs denied path vs invalid output. Grade final answer and absence of forbidden effects.
6. Cancellation/bounds: slow operation, huge output, permission request during cancellation, and healthy next execution. Deterministic contract tests come before model trials.
7. Later editing/check tasks: fix a small defect, preserve unrelated edits, run a named check, and verify the final diff with hidden tests. Only after write policy and process controls exist.

Parse a final JSON value and validate its schema; compare exact values and order where specified. An independent oracle must not reuse the adapter algorithm being tested. Grade task completion, tool-policy adherence, and harness health as separate fields. A timeout or incomplete run is never an ordinary successful completion; retain partial correctness as a separate diagnostic. Nonzero process exit, malformed trace, wrong model and missing usage need explicit treatment. Intentional tool errors in recovery tasks are not harness errors.

Add checker regression fixtures: wrong extra IDs, matching text inside an explanation, malformed JSON, forged success text, incorrect counts, truncated transcripts, timeouts and forbidden-tool use. Record failures, don't rerun until a success replaces them. Model/provider failures can receive a bounded retry under a declared rule; retain every attempt and its cost. A model fallback starts another stratum and cannot silently complete a paired comparison.

## Run design and accounting

First run deterministic preflight with no model calls: fixture parity, grader failures, artifact schema and clean/reset repositories. Pin Strata/Pi/Prime commits, Bun/Python/Git/package versions, task snapshot hashes, model identifier/provider, reasoning settings, system prompt, API declarations, enabled tools, grants and resource limits. Preserve actual prompts and record whether credentials/network access differ.

Proposed feasibility pilot: 6 development tasks × A/B/C × 3 independent fresh sessions on one model (54 cells), followed by a disjoint 6-task set with the same matrix. Three repeats reveal obvious instability; they are not enough to establish a general win. Before calling a model, set a total spend cap and per-cell token/time caps using a current price snapshot and conservative worst-case tokens. The old fixture bill is not a price forecast. Expose a dry run of the matrix and stop at the cap.

Choose held-out tasks before prompt/API tuning. Split by repository/workflow family, not merely renamed paths. Counterbalance condition order within task/model blocks. Pin state and reset between independent trials. Measure cold setup separately from execution in a warm compiler/session. Warm infrastructure trials should use independent tasks; repeating the same answer in one conversation measures memory leakage as well as amortization. A repeated run is another stochastic sample, not another independent task.

For each cell retain: final outcome and oracle details; model/API attempts; compile/validation/policy/adapter errors; LLM tool calls and broker operations; shell invocations, subprocesses and native calls separately; context consumed by prompts/declarations/discovery/program source/results/errors; input/output/cache/reasoning tokens where reported; estimated cost and pricing provenance; setup/compile/execution/end-to-end latency; bounded payload bytes; fallback reasons and resource-limit events. Count all attempts, including failures. Null means unavailable, never zero. JSON-envelope bytes and raw transport bytes are different metrics and must be labeled.

Report success per task family and model, paired deltas, medians and tail latency, bootstrap intervals resampling task blocks (preserve repeats within blocks), and raw sample counts. Tiny samples warrant descriptive results, not significance claims. Report both total cost divided by successes and cost of successful cells; the former includes failed work. Publish minimal sanitized fixtures, prompts, checker/version manifest and summary under tracked `docs/evaluations/`; keep private transcripts and credentials out of git. Local artifact paths alone are insufficient for independent reproduction.

## Learning the right operations from sessions

A future local `agentsview` study should sample workflows across agents, repositories and outcomes. Record intents, command families, composition patterns, output sizes when available, retries, parsing steps and avoidable round trips. Do not execute recorded commands. Manually validate a sample of classifications; shell syntax needs a parser, not splitting on semicolons. Compare both frequency and costly failures; observational traces reflect existing tool availability and cannot prove a counterfactual TS win.

Derive candidate APIs on the development sample; turn anonymized workflows into seeded tasks and keep other projects/date windows held out. Start small (e.g. 30 sessions across at least 3 projects and more than one available agent), state selection bias and missing data, and keep raw extraction local. User session contents are not needed to write this plan and were not mined in this pass.

## Continue, narrow, pivot, or stop

Proposed product gate to freeze before confirmatory trials: C's success should be within 5 percentage points of A and show at least a 15% improvement in total estimated cost per success **or** median end-to-end latency, without a material tail-latency or forbidden-effect regression. These are decision thresholds, not promised outcomes or statistical power claims. Require uncertainty intervals narrow enough to assess the chosen margin; the 54-cell pilot alone will often be inconclusive. If promising, choose the confirmatory sample size from pilot variance before running it on held-out tasks and a second model family.

If benefits appear only on large structured-data tasks, narrow the product to that use case. If models struggle with imports/types, discoverability, or unfamiliar operation names, allow at most two versioned API/prompt revisions on development tasks before re-evaluation. Training bias is a plausible explanation, not a fact inferred from one bad run; distinguish it from poor docs, compiler overhead, capability gaps and policy mismatch.

If the advantage does not survive fair scripting baselines, held-out tasks and bounded tuning, stop broad expansion or pivot to reusable Pi extensions/benchmark tooling. Preserve negative results and an explanation of what was learned. Adding more adapters, persistent state or a retrieval graph is not automatically the remedy for a failed hypothesis.
