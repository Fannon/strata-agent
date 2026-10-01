# Third-model portability: Ling Flash VL

Date: October 1, 2026. Selected issue: [061](../.work/issues/061-cross-model-generalization.md). Production base: `207648b`, with the new experiment adapter frozen before calls. [108 sanitized attempts](evaluations/portability-2026-10-01.json); raw artifacts stay local under `.work/portability-20261001-v1/`.

## What we learned

**Ling is a useful cheaper test model, but the recipe's efficiency benefit did not generalize across all three models.** With the recipe, Ling completed 15/18 attempts at $0.000407/attempt: about 64% less than GLM and 75% less than Muse in the same profile. Its cheaper price compensates for substantially more tokens, rather than showing more efficient composition. Missing business actions remain a material failure mode.

The unchanged recipe reduced Muse's measured cost 17.4% at equal 18/18 success. GLM improved from 16/18 to 17/18, with 4.9% higher cost and unchanged mean requests. Ling improved from 14/18 to 15/18, with 13.2% higher cost, 22.8% more tokens and 11.9% more requests. Ling cost per successful completion also increased, from $0.000462 to $0.000488. These are sample estimates; all three cost uncertainty intervals include parity.

**Keep one shared Strata interface and retain the recipe as experimental.** This run does not support promoting it as a universal efficiency improvement or choosing different recipes by model name. A future shared change should address actual completion and unnecessary verification, then earn its benefit on new tasks/models. No production prompt, checking policy or dependency was changed.

## Scope and fair comparison

Six existing definitions, N1–N6, each in three existing data worlds (variants 4–6), with baseline/recipe arms across Muse, GLM and Ling: **108 attempts, 18 per row, six distinct definitions per row**. This is a model holdout for Ling; the tasks/APIs are reused from 060. It does not establish new-task or real-service generalization.

Both arms use current checked Strata sessions, full declarations, QuickJS, broker validation, inferred root-return guards, recovery summaries, `program_details`, `program_effects`, and optional explicit finalization. The candidate adds the exact 060 recipe: a public-schema-derived pagination example, inferred row types, Map guidance and a reminder about previous effects. No helper, declaration reduction, model-specific prompt, or new tuning after seeing results. The audit verifies **12 shared prompt contracts** (six tasks × two profiles) are identical across models.

Installed Pi **0.99.1** runs the experiment adapter; the project still pins **0.73.1**. This is task-scoped exposure with no discovery/catalog arm, native Pi comparator, or feature ablation. The adapter uses shipped session behavior and mirrors final selection/message replacement and receipt tools; this is not certification of every production-extension feature under Pi 0.99.1.

Model/provider settings are fixed within each model's arms:

| Model id | Pi thinking | API reasoning configuration | Catalog $/million input / output / cached input |
| --- | --- | --- | --- |
| `meta/muse-spark-1.3-contributor` | medium | effort medium | $0.10 / $0.20 / $0.002 |
| `z-ai/glm-5.3-flash` | low | effort low | $0.15 / $0.50 / $0.03 |
| `inclusionai/ling-3.0-flash-vl` | off | parameter omitted; provider default still produces reasoning tokens | $0.021 / $0.0616 / $0.0042 |

Rates come from the captured [OpenRouter API catalog](https://openrouter.ai/api/v1/models), not the differently priced public model page. Pi “off” did **not** disable Ling's provider-side reasoning; usage reports 24,407 reasoning tokens across its 36 attempts. Treat these as measured configurations, not equal-reasoning model-capability comparisons. Routing, caching and provider default settings remain uncontrolled.

Eight requests, 4096 output tokens, 262144 provider-payload bytes and 180 seconds per attempt; four concurrent workers, fresh process/state per cell, rotating models, baseline first within first-world task/model blocks and alternating approaches afterward. Failures remain in the matrix and averages. Success requires a completed healthy run, exact requested answer and independently correct final state. One unambiguous JSON code block is accepted for business content; pure JSON is scored separately.

## Correctness, speed and cost

Requests are model turns. Tokens include uncached/cached input and completion output, with reasoning not added again. Time includes startup and repairs. Failure costs count in averages and cost per success.

| Model / shared Strata profile | Answer + state | Strict success | Effects correct | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, baseline | 18/18 | 18/18 | 18/18 | 3.89 | 19,360 | 27.57 / 36.22 | $0.001964 | $0.001964 |
| Muse, recipe | 18/18 | 18/18 | 18/18 | 3.11 | 15,049 | 22.54 / 54.85 | $0.001622 | $0.001622 |
| GLM, baseline | 16/18 | 16/18 | 18/18 | 3.22 | 10,086 | 11.09 / 17.28 | $0.001084 | $0.001219 |
| GLM, recipe | 17/18 | 17/18 | 18/18 | 3.22 | 10,712 | 11.94 / 34.46 | $0.001136 | $0.001203 |
| Ling, baseline | 14/18 | 14/18 | 16/18 | 3.72 | 19,630 | 11.22 / 23.56 | $0.000360 | $0.000462 |
| Ling, recipe | 15/18 | 15/18 | 16/18 | 4.17 | 24,107 | 12.27 / 27.75 | $0.000407 | $0.000488 |

Total: **384 model requests, 98/108 answer-and-state successes, 98/108 strict successes, 104/108 correct final states**, estimated model cost **$0.118309037**. All 384 requests have accounted usage. This is catalog-priced SDK usage, not a reconciled provider bill.

Median latency alone conceals slower tails: Muse recipe has a lower median but a higher P90 (54.85 vs 36.22 seconds), and mean time is 7.2% higher. GLM recipe mean time is 49.0% higher, including a 75-second recovery attempt; Ling mean time is 14.5% higher. Provider/cache/concurrent timing effects prevent assigning all latency changes to prompting.

### Token and cost totals, including failures

| Model / profile | Input | Output | Cache read | Cache write | Reasoning (already in output) | Total | Total cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, baseline | 264,368 | 44,189 | 39,925 | 0 | 16,554 | 348,482 | $0.035354450 |
| Muse, recipe | 212,975 | 39,287 | 18,616 | 0 | 15,257 | 270,878 | $0.029192132 |
| GLM, baseline | 61,029 | 14,337 | 106,176 | 0 | 170 | 181,542 | $0.019508130 |
| GLM, recipe | 58,344 | 16,322 | 118,144 | 0 | 796 | 192,810 | $0.020456920 |
| Ling, baseline | 151,964 | 42,408 | 158,976 | 0 | 11,215 | 353,348 | $0.006471276 |
| Ling, recipe | 160,791 | 48,821 | 224,320 | 0 | 13,192 | 433,932 | $0.007326129 |

Output includes the separately reported reasoning subset. SDK cache-read counts are separate from uncached input. Cache-write counts are zero. The replay audit recalculates cost from the catalog rates and every recorded usage message.

### Paired uncertainty

| Model | Recipe/baseline cost | Descriptive 95% task-block interval | Paired recipe-only / baseline-only successes | Recipe/baseline mean time |
| --- | --- | --- | --- | --- |
| Muse | 0.826 | 0.597–1.087 | 0 / 0 | 1.072 |
| GLM | 1.049 | 0.895–1.212 | 2 / 1 | 1.490 |
| Ling | 1.132 | 0.945–1.311 | 4 / 3 | 1.145 |

Descriptive 95% percentile bootstrap, 10,000 resamples of **six whole task blocks**, preserving both arms and all three data variants. These are not population confidence guarantees. All cost intervals include 1; Ling's success-difference interval includes substantial regressions and improvements (−27.8 to +33.3 percentage points). Muse's observed zero success difference does not prove population equivalence. The corpus is small and selected; provider routing/caching is uncontrolled.

## What the shipped mechanisms did

| Model / profile | Compile rejections | Execution error reports | Generated source bytes/attempt | Host-delivered answers | Effects queries | Missing effects |
| --- | --- | --- | --- | --- | --- | --- |
| Muse, baseline | 6 | 5 | 4,320 | 18/18 | 1 | 0 |
| Muse, recipe | 5 | 1 | 3,642 | 18/18 | 0 | 0 |
| GLM, baseline | 5 | 0 | 2,404 | 18/18 | 0 | 0 |
| GLM, recipe | 8 | 2 | 2,633 | 18/18 | 0 | 0 |
| Ling, baseline | 7 | 2 | 4,695 | 17/18 | 3 | 16 |
| Ling, recipe | 5 | 5 | 5,752 | 16/18 | 5 | 2 |

**Type checking caught real model-authored mistakes.** Across the campaign, 36 programs were rejected before making any capability calls. Examples include cursor `null` versus `undefined`, untyped evolving arrays, object indexing and invented type namespaces. This supports keeping quiet checking as a useful guard. There is no unchecked arm here, so the net token/cost benefit of checking cannot be identified. It does not validate pagination completeness, required writes, requested answer fields or business rules; `any` can remove useful field checks.

**Explicit finalization worked when used.** The audit verifies 105 completed answers exactly equal the selected successful program JSON, with no reconstruction. Models made 52 inline selections and 66 separate `finalize_result` calls (some redundant selections); inline selection avoids a separate tool call. Models still require a normal final completion and can continue tools, invalidate selection, or choose a wrong result. Both arms have the mechanism, so improvements against historical formatting scores are not a causal estimate of its benefit.

**Recovery evidence was available and inspected.** `program_effects` was called nine times, including post-success write verification and inspection after errors; models did not all choose to use it. The selected task set injects invalid **read** responses, not lost write replies. This is not a strong new test of uncertain-write recovery. The existing model-free payment/cancellation regressions remain the stronger evidence for those receipt semantics.

## All ten failed attempts

| Attempt | Failure and observed state |
| --- | --- |
| `N4-ling-baseline-r1` | Only first customer page read. Five correct payments added; five required payments missing. Compile repair did not fix pagination. |
| `N5-ling-baseline-r1` | Reads only first pages, initially matches reservations by SKU; later fixes matching but keeps partial inputs. Wrong read-only answer, no final selection, commentary/code fence. |
| `N6-glm-baseline-r1` | Correct credit, extra unrequested `creditId` in selected answer. Source also calls exported `main()` at top level; not evidence of deliberate read-error recovery. |
| `N3-ling-candidate-r2` | Correct reported credit amount, but no `creditCustomer` invocation; one required credit missing. |
| `N1-glm-baseline-r3` | Only first pages fetched; wrong read-only aggregation despite passing types and pure JSON. |
| `N1-ling-candidate-r3` | First computed/selected answer was correct, then repeated verification and intermediate programs invalidate selection. Reaches eight-request guard without a completed answer; retained as failure. |
| `N2-ling-baseline-r3` | Only first order page used. Nine correct reservations added, eleven required reservations missing. |
| `N3-ling-candidate-r3` | Again computes the correct credit answer without calling the credit operation; one required credit missing. |
| `N6-ling-baseline-r3` | Correct credit added, but `any` conceals confusion between the response wrapper and its credit row. Returned `amountCents` is undefined and omitted from JSON. |
| `N6-glm-candidate-r3` | Correct credit and read-error recovery, but extra unrequested `creditId` remains in selected answer. |

Ling recipe fixed all four baseline failed pairs but failed three pairs where its baseline succeeded. Baseline's 16 missing writes became two missing writes with the recipe; **effect-correct attempts stayed 16/18**. Thus the recipe reduces the number of omissions here while still leaving two successful-looking credit answers that did not perform the action. Answer-only scoring would count these as successes.

The receipt/JSON layer faithfully reports or delivers what happened; it cannot establish that all required business actions happened. [063](../.work/issues/063-effectful-completion-evidence.md) captures caller-defined completion evidence as deferred work. [062](../.work/issues/062-top-level-main-invocation.md) captures accidental extra entry-point invocation; no production fix or additional paid run was selected during this campaign.

## Provenance, budget and verification

Preflight: typecheck; 57 model-free checks including 18 independent SQL answers; 18 production finalization/recovery tests with 111 assertions. Post-run audit: all 108 final-state/content grades, all recorded requests and usage, catalog-price arithmetic, shared prompt contracts, successful selected result equality, and frozen source hashes passed. Known wider macOS/Bun failures under 050 remain outside this run; no full-suite green claim.

The conservative reservation guard paused dispatch after three attempts ($0.002815104 actual spend) and 45 attempts ($0.051923345). Ceiling-only amendments raised $0.75 → $1.25 → $2 within existing authorization to fit four maximum-size concurrent reservations. Original matrices and every paid attempt remain local; amendments are published in sanitized protocol metadata. No frozen source, task, prompt, provider setting or scoring changed, and no failures were replaced. Actual final spend was $0.1183.

Reproduce with captured catalog/profile settings and this frozen implementation. A future revision requires a new matrix; earlier 060/054 results are unchanged.

```sh
# Requires the public catalog snapshot at the path used by --prepare.
# Choose a fresh ignored directory; never overwrite a paid campaign.
STRATA_PORTABILITY_OUT=.work/portability-new bun examples/portability/run.ts --prepare
STRATA_PORTABILITY_OUT=.work/portability-new bun examples/portability/run.ts --run
STRATA_PORTABILITY_OUT=.work/portability-new bun examples/portability/publish.ts
```

The driver has a $0.75 initial cap, preserving the actually frozen original. Its conservative reservation guard may pause at concurrency four; any budget-only amendment must be recorded before resume. Publication writes the named 2026-10-01 output, so a new campaign should select a new published artifact/report rather than overwrite this evidence. Raw credentials, model context, generated programs, transcripts and service state are never published.
