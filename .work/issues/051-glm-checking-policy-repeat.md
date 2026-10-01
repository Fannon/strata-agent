# 051 — GLM 5.3 Flash repeat of checking-policy pilot

Status: DELIVERED 2026-10-01 — 26/36 strict successes, estimated model cost $0.01813044; production always-check retained
Dependencies: 049 (frozen fixture, policies, grading and Muse Spark results), 048 (installed native Pi baseline)

## Authorization and question

The user selected `z-ai/glm-5.3-flash` through OpenRouter to test whether a different model exposes a useful difference between native Pi and Strata. The earlier €5 trial allowance and request to keep cost handling simple remain the working ceiling; preserve the $0.024197942 Muse Spark estimate separately. Do not assume this model is less capable on these tasks before observing results.

## Frozen design

- Repeat 049's same **36 cells**: two natural tasks × four profiles × three repetitions (24), then two seeded-recovery tasks × three Strata policies × two repetitions (12).
- Native Pi Codemode and always-check baseline first (12 cells), then never-check/after-failure natural cells and seeded recovery (24). Identical fixtures, declarations within Strata policies, schema validators, grants, QuickJS executor, grading and prompts.
- Installed global Pi remains **0.99.1**; package pin stays 0.73.1. Preserve all frozen 049 sources and artifacts. `run-glm.ts` supplies a separate versioned launcher; aggregate metadata now reads the matrix version rather than hard-coding 049.
- Model is exactly `z-ai/glm-5.3-flash`; public catalog canonical slug `z-ai/glm-5.3-flash-20260826`. No other model or nested model calls.
- GLM's catalog supports `low`, `high`, `max` and defaults to `max`. Use **low** explicitly, identically across profiles; Muse Spark used medium. Cross-model observations therefore compare configurations and are not an isolated model-identity ablation. [OpenRouter](https://openrouter.ai/z-ai/glm-5.3-flash), [Z.ai](https://docs.z.ai/guides/vlm/glm-5.3-flash).
- Preserve 8 requests, 4096 completion tokens/request, 180 seconds/cell, fresh simulated state and pure-JSON final answers. The completion cap may constrain reasoning as well as visible output; record any limit failures.
- Current catalog rates: $0.15/M input, $0.50/M output, $0.03/M cached input. Provider-specific billed rates may differ. Log Pi token-rate estimates, not reconciled billing claims. Use a $4.45 batch stop and conservative next-cell reservation; previous spend plus this cap stays below the working allowance. No additional confirmation or model sweep selected.
- Raw catalog, profiles, traces, generated programs, state, source hashes and installed-Pi fingerprints remain ignored under `.work/checking-20261001-glm-v1/`. No credentials in tracked files or command arguments.

## Evaluation and completion

Record every attempted cell, including task/limit failures. Stop and inspect infrastructure errors or incomplete usage rather than hiding or replacing them. Compare natural correctness, model-generated diagnostics, retries, requests, latency, costs and final simulated effects; seeded recovery remains separate. Model-free reuse need not be repeated because its code and policy do not depend on the selected model.

All profiles succeeding again would show that this fixture still does not discriminate them. Differences in small samples would be development observations requiring confirmation on untouched tasks. Neither result changes production always-check behavior automatically.

Complete with a sanitized report, updated board/handoff and explicit retain/revise decision. Newly discovered broader work remains deferred.

## Setup and baseline observations

Type checking and the four existing checking-policy tests passed (49 assertions). All five installed-Pi fingerprints match 049, and all original frozen 049 source hashes remain unchanged.

The first 12 cells completed with healthy processes and complete usage, estimated cost $0.00719538. Native and always-check each passed 4/6 strict; all four failed answers were correct when only the outer Markdown fence was removed, and all final simulated effects were correct. Strict grading remains unchanged; fence removal is a post-run diagnostic rather than the primary result.

Always-check had two model-authored execution failures from logging an answer without returning it; neither generated a semantic diagnostic. One occurred after a payment. Recovery preserved correct final effects. The compiler's zero-argument entry-point check does not enforce a JSON return type; [052](052-main-result-contract.md) records that substantial follow-up as deferred, without changing the frozen trial.

## Complete results and decision

All 36 cells finished healthy with complete usage, 76 requests and estimated cost $0.01813044. Natural strict successes: native 4/6, always 4/6, never 6/6, after-failure 3/6. All 24 natural answers and final effects were correct after supplementary outer-fence removal; primary grading remained unchanged. There were three naturally generated missing-return execution errors (two always, one after-failure), no generated semantic diagnostics and no infrastructure replacements or reruns.

Seeded recoveries were 3/4 strict under every policy. Silent-result recoveries all passed (6/6). Partial-payment failures differed: always-check repetition 2 skipped the required new payment because an older payment existed and reported the expected answer; after-failure repetition 2 reported total payments rather than the new amount; never repetition 2 had correct effects and final answer content but added prose/fences. Across all failures: eight answer-format mistakes and two substantive business mistakes, one in state and one in the reported amount. No duplicate or incorrect payments were added; one required payment was omitted. [053](053-recovery-action-identity.md) records that recovery evidence must distinguish old state from the current requested action.

See the [report](../../docs/glm-checking-policy-repeat.md) for exact tables, provenance and limits. These development results do not identify a reliable policy winner or prove that GLM is generally weaker. Retain production checking before execution, quiet success and diagnostic feedback, as agreed with the user. No follow-up implementation, further model or confirmation run selected; 052/053 are deferred.
