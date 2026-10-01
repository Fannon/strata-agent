# GLM 5.3 Flash checking-policy repeat

Date: 2026-10-01. Issue 051-v1 repeats the [Muse Spark pilot](checking-policy-pilot.md) using OpenRouter `z-ai/glm-5.3-flash`, **low reasoning**, installed Pi **0.99.1** and the same synthetic tasks. All writes were simulated. Production remains strict checking before execution; the repository Pi pin remains 0.73.1.

The [combined comparison](checking-policy-comparison.md) lists requests, tokens, wall time and cost together with correctness for all natural and seeded profiles. It includes input/output/cache/reasoning breakdowns, cost per strict success, descriptive tail latency and sanitized metrics for all 72 attempts across both models.

## Finding

**GLM exposed more instruction-following and recovery mistakes, but no naturally generated semantic type errors.** The frozen matrix completed with **26/36 strict successes**, all 36 processes healthy with complete usage. Eight failures concerned final-answer formatting. Two were substantive seeded-recovery errors: claiming a new payment was complete without creating it, and reporting total payments instead of the requested new amount.

All 24 natural attempts had correct answer content and final effects when an outer Markdown fence was removed for diagnostic inspection. The primary strict score still rejects those fenced answers. This run therefore does not establish a completion benefit from semantic checking or a reliable advantage for a particular policy. It does reveal gaps in the program result contract and in how the model interprets recovery state.

## Design and comparability

The user selected this model to see whether a less capable model would differentiate native Pi from Strata. We tested the selected model without assuming its relative capability in advance. OpenRouter's catalog listed canonical slug `z-ai/glm-5.3-flash-20260826`, tool calling and mandatory reasoning with supported efforts `low`, `high`, `max`. We selected **low** explicitly in every profile because medium is unsupported. Muse Spark used medium, so cross-model observations compare configurations, not model identity alone. [OpenRouter model page](https://openrouter.ai/z-ai/glm-5.3-flash), [Z.ai documentation](https://docs.z.ai/guides/vlm/glm-5.3-flash).

The same 049 matrix ran:

- 24 natural attempts: invoice aggregation and payment reconciliation, three fresh repetitions per task under native Pi Codemode, always-check, never-check and check-after-failure.
- 12 seeded-recovery attempts: partial payment followed by a result-field mistake, and a field typo returning a wrong empty list; two repetitions per family under each Strata policy.
- Native/always-check baseline first (12 cells), then the remaining 24 cells. No prompt, fixture, policy, schema, grant, executor or grading changes after freezing the matrix. No task failures were replaced or rerun.
- Identical declarations and tool instructions within the three Strata policies. Native Pi has a different interface and program format, so its comparison is of configured systems rather than typing alone.
- Limits unchanged: eight model requests, 4096 completion tokens/request, 180 seconds/cell. No model or nested classifier fallback. No attempt reached a request/token/time stop. Fresh simulated state per cell; independent final-answer and payment-state grading.

All five installed-Pi fingerprints matched 049. All original frozen sources stayed unchanged; `run-glm.ts` supplied the separate launcher and sixth source hash. Sampling used model/provider defaults rather than a fixed random seed. Baseline-first order, cache differences, routing and the changed reasoning setting limit cross-profile and cross-model cost/latency claims. The already-tested model-free mechanism and reuse probes were not repeated.

## Natural tasks

| Profile | Strict successes | Correct answer/effects after outer-fence removal, diagnostic only | Model requests | Estimated cost | Median wall time |
| --- | --- | --- | --- | --- | --- |
| Native Pi Codemode | 4/6 | 6/6 | 12 | $0.002960 | 9.26 s |
| Always check | 4/6 | 6/6 | 15 | $0.004235 | 10.32 s |
| Never check | 6/6 | 6/6 | 12 | $0.002837 | 7.86 s |
| Check after failure | 3/6 | 6/6 | 13 | $0.003119 | 4.85 s |

Seven natural failures were solely final Markdown code fences. Diagnostic removal required the whole response to be a single fenced JSON block and re-used the same answer/state grader. This post-run inspection does not replace the preselected pure-JSON acceptance rule. Never-check's higher strict score mainly reflects formatting in this small sample; it is not evidence that removing checking improves calculations or makes effects safer.

The Strata profiles submitted 9, 6 and 7 model-authored programs respectively. Always-check had two execution failures and after-failure one; all were `main() must return a JSON result`. The model logged an answer instead of returning it. All three programs passed semantic checking when checked, and after-failure diagnostics were empty. Their inferred `Promise<void>` return type is legal under the current compiler's zero-argument entry-point check. One always-check payment script had already completed the payment before the missing-return error. Recovery preserved the correct final effects; no duplicate payments were observed.

Thus the run did expose naturally occurring code/interface mistakes, but their result contract was not encoded in the semantic gate. [052](../.work/issues/052-main-result-contract.md) records possible static result-contract enforcement as deferred. No compiler or prompt correction was applied during this run.

## Seeded recovery

| Seeded family | Policy | Strict successes | Correct final payment state | Model requests | Estimated cost |
| --- | --- | --- | --- | --- | --- |
| Partial payment | Always | 1/2 | 1/2 | 4 | $0.000796 |
| Partial payment | Never | 1/2 | 2/2 | 4 | $0.001004 |
| Partial payment | After failure | 1/2 | 2/2 | 4 | $0.000846 |
| Silent wrong result | Always | 2/2 | 2/2 | 4 | $0.001030 |
| Silent wrong result | Never | 2/2 | 2/2 | 4 | $0.000641 |
| Silent wrong result | After failure | 2/2 | 2/2 | 4 | $0.000663 |

Early checking again blocked erroneous seeds before calls. Unchecked partial-effect seeds completed the new payment before failing; deferred checking supplied useful field diagnostics after that failure. Silent-result seeds succeeded unchecked, so delayed checking did not activate. All six silent-result recoveries passed when explicitly asked to verify the previous attempt. No model-authored recovery program received a semantic diagnostic.

Three partial-payment recoveries failed in different ways:

1. **Always, repetition 2: correct success answer, missing required effect.** The seed had been rejected before any call. An older payment existed for the same invoice. The model tested whether *any* payment existed, skipped the required additional payment, and returned the expected answer anyway. The independent state grader caught the omission. TypeScript and runtime schemas accepted the recovery program.
2. **After failure, repetition 2: correct state, wrong reported amount.** The seeded new payment was present and the model added no duplicate. It returned the total paid amount, including the older payment, rather than the newly requested amount.
3. **Never, repetition 2: correct state, invalid answer format.** The recovery also computed the total, but the final answer used the correct requested amount inside prose and a fenced block. It failed pure-JSON grading. The single-outer-fence diagnostic deliberately does not strip prose; manual inspection classified this as formatting.

Across all ten strict failures, eight concern formatting (seven outer fences, one prose plus fence), one concerns a wrong amount, and one concerns a missing effect hidden by a correct-looking answer. No duplicate or wrong payment was added; eighteen new payments were required across the matrix and seventeen were present at the end. [053](../.work/issues/053-recovery-action-identity.md) captures distinguishing old state from completed current-attempt actions as deferred research.

## What changed in our understanding

**The model's ability to follow the execution and output contracts matters.** A weaker result on this setup did not manifest as misspelled API fields in naturally generated code. It showed up as logging instead of returning, output wrappers and confusion about the meaning of a new payment. Those failure categories need separate accounting.

**Checking protects the contracts it actually expresses.** It prevented the supplied field mistakes. It did not reject a missing return because the current entry-point check permits `void`, and it could not establish whether an existing payment satisfied the requested additional action. The result-contract gap is potentially addressable; business correctness still needs independently observed outcomes.

**Readable state is useful but requires interpretation.** The model inspected payment state in every partial-effect recovery. One checked recovery misinterpreted an old payment as evidence of completion. Providing state is not sufficient by itself; the agent needs to identify which action belongs to the current attempt. This limits the stronger recovery observation from the Muse Spark pilot.

**The primary comparison has no demonstrated policy winner.** Natural content and effects matched in all four profiles; strict scores mainly varied with formatting. Each policy passed 3/4 seeded recoveries, but failure causes differed. Two repetitions are insufficient to estimate recovery reliability or infer that early checking causes omissions.

## Cost, verification and artifacts

The batch used **$0.01813044** estimated from Pi-recorded tokens and the frozen catalog rates ($0.15/M input, $0.50/M output, $0.03/M cache reads). Provider-specific rates may differ; this is not a reconciled bill. All 36 attempts completed with recorded usage, 76 model requests in total, and no infrastructure restarts or substituted cells. The separately preserved Muse Spark batch was $0.024197942; combined estimated cost for these two batches is **$0.042328382**. Different rates, reasoning, caches and generated lengths prevent a causal model-efficiency claim.

`bun run check` passed. The existing checking-policy tests passed **4/4, 49 assertions** before paid runs. The production runtime was unchanged. The full suite was not rerun; [050](../.work/issues/050-macos-bun-baseline.md) retains the earlier macOS/Bun environment failures. Documentation links, whitespace and frozen source hashes were checked during wrap-up.

Ignored local artifacts under `.work/checking-20261001-glm-v1/` contain the matrix, catalog snapshot, source and Pi fingerprints, isolated public profile, events, states, grading, usage, aggregate summary and post-run diagnostic script/results. The script removes only an outer code fence for its supplementary inspection; primary `summary.json` remains unchanged. Credentials were passed through the process environment, not tracked files or command arguments. Reports contain sanitized observations; raw transcripts and generated fixtures remain local.

## Decision

Retain **strict semantic checking before execution, quiet success and diagnostics on errors** in production, as agreed with the user. The run supplies no reason to weaken that policy for critical business actions. It also shows why checking alone cannot guarantee that a requested business action happened.

Complete this selected repeat. Record the missing-return contract and action-identity questions under 052/053; no fixes, additional models, confirmation trials or production changes are selected. The original application comparison remains its own negative/inconclusive result, and both synthetic runs remain development evidence.
