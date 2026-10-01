# Strata tuning: examples helped more than another abstraction

October 1, 2026. Issue [060](../.work/issues/060-strata-tuning-trials.md), protocol **060-v1**. [Sanitized results](evaluations/tuning-2026-10-01.json) include all 132 attempts; [prototype](../examples/tuning/extension.ts) uses the unchanged production checked session. The documentation inventory was committed and pushed as `730998c` before paid trials. Earlier 049/051/054 sources and results remain unchanged.

## Subsequent evidence

The [third-model repeat](third-model-portability.md) reran the same recipe with Muse/GLM and added cheaper Ling on current finalization/recovery code. It did not repeat a universal cost benefit: Muse cost fell 17%, GLM rose 5% and Ling rose 13%. The recipe stays experimental, shared across models. This report preserves 060's original measurements; changed implementation/provider/cache conditions prevent causal historical comparisons. Broader new-task/native confirmation remains deferred.

## Decision

**Retain the short recipe as an experimental prompt profile.** On six new workflow definitions, repeated in three generated worlds, it reduced measured requests, tokens, estimated model cost and median time with both models. Answers and final state were correct in all 36 recipe attempts, versus 34/36 baseline attempts. The two baseline failures occurred on the same allocation definition, so they are one structural reliability finding rather than evidence across two independent task families.

Do not promote the helper or shorter declaration presentation from this development screen. Smaller diagnostic feedback remains unmeasured because its changed branch never ran. Production prompt, full declarations, quiet checking before execution, compiler, broker and runtime defaults are unchanged; the retained profile lives in the experiment extension. Generalizing it into the full extension would be separate work. This compares Strata against Strata: it does not establish a new advantage over native Pi or isolate the value of type checking.

**Formatting did not improve.** Strict successes were 31/36 in both confirmation arms. GLM had 14/18 baseline versus 13/18 recipe strict successes, despite recipe answers/effects being correct in all 18. Canonical finalization was deferred at that measured revision and was subsequently implemented under [058](../.work/issues/058-canonical-final-json.md).

## Four hypotheses

| Change tested alone | Hypothesis | Observed outcome and decision |
| --- | --- | --- |
| Recipe | A small correct pagination example plus inference/Map guidance avoids repeated generic wrapper mistakes and pays for its prompt tokens | Selected after development; confirmed lower measured cost/tokens/requests and median time on new definitions. Retain experimental profile. |
| Typed pagination helper | A trusted `collectPages(api.listInvoices, page => page.invoices)` removes repetitive code while preserving row types | Development correctness passed, but requests and cost increased with both models; seven compile rejections versus baseline's three. Do not promote this helper design. |
| Alias-only declarations (`lean`) | Removing the duplicate `@cap/work` body reduces input without changing compiler contracts | Development cost fell, but Muse made a wrong reservation and omitted another. GLM's failure was final serialization. Failed eligibility; do not promote. The small screen cannot establish that deduplication caused the mistakes. |
| Smaller feedback | First three diagnostics plus on-demand full details reduce repair context | No compile rejections in either feedback arm: changed feedback was never exposed. Apparent cost/time variation cannot be credited to this feature. Inconclusive. |

### What the recipe actually adds

**This is one model-independent recipe, not a Muse recipe and a GLM recipe.** Both receive the same guidance for a given task. Its operation/array field varies with the public API schema, never the model name. Selection chose one shared feature set across both models. Per-model rows report how different models respond to the same approach.

The user subsequently clarified the design requirement: improve a shared interface that generalizes across models and leaves each model free to compose its own solution; do not introduce model-specific prompts, helpers or checking policies. Two tested models provide portability evidence, not proof of generalization to unseen models. [061](../.work/issues/061-cross-model-generalization.md) subsequently delivered the bounded third-model repeat linked above; broader new-task/native tests remain deferred.

It adds about **564 UTF-8 bytes** to the initial system prompt, varying slightly by enabled operation/array field. It uses the task's public API shape, never expected answers. The advice is: write ordinary JavaScript-style TypeScript, let API calls infer row types, prefer `Map` for lookups, avoid inventing generic page interfaces, use real response fields, return the requested answer shape, and remember completed writes if later code fails. The example is:

```ts
const rows = [];
let cursor: string | undefined;
do {
  const page = await api.listInvoices(cursor ? {cursor} : {});
  rows.push(...page.invoices);
  cursor = page.nextCursor ?? undefined;
} while (cursor);
```

The code uses TypeScript syntax only where helpful; it does not require manually annotating every row or writing generic wrappers. We tested this whole prompt bundle, so we cannot attribute its effect to the example alone or to any single sentence.

## Development screen

**Six previously inspected definitions, one fresh attempt per model/profile: 60 attempts.** J1, A1, A4, W1, W2 and R2 from 054 are development material, not fresh confirmation. Every row below covers six distinct definitions. Muse uses medium reasoning; GLM uses low. The feedback arm did not receive its intended treatment.

| Model / shared profile | Answer + state | Strict JSON success | Effects correct | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/business success | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse / baseline | 6/6 | 6/6 | 6/6 | 2.50 | 9,240 | 28.49 / 41.57 | $0.000984 | $0.000984 | $0.000984 |
| Muse / recipe | 6/6 | 6/6 | 6/6 | 2.17 | 7,257 | 10.44 / 21.33 | $0.000762 | $0.000762 | $0.000762 |
| Muse / helper | 6/6 | 6/6 | 6/6 | 2.83 | 9,840 | 16.54 / 22.67 | $0.000992 | $0.000992 | $0.000992 |
| Muse / lean | 5/6 | 5/6 | 5/6 | 2.67 | 7,634 | 14.63 / 24.27 | $0.000734 | $0.000881 | $0.000881 |
| Muse / feedback | 6/6 | 6/6 | 6/6 | 2.33 | 7,522 | 9.02 / 21.12 | $0.000696 | $0.000696 | $0.000696 |
| GLM / baseline | 5/6 | 5/6 | 6/6 | 2.67 | 6,347 | 19.70 / 22.59 | $0.000804 | $0.000964 | $0.000964 |
| GLM / recipe | 6/6 | 5/6 | 6/6 | 2.17 | 5,097 | 12.54 / 24.47 | $0.000666 | $0.000666 | $0.000799 |
| GLM / helper | 6/6 | 4/6 | 6/6 | 2.83 | 7,203 | 9.63 / 18.36 | $0.000838 | $0.000838 | $0.001258 |
| GLM / lean | 5/6 | 4/6 | 6/6 | 2.50 | 5,056 | 16.50 / 20.69 | $0.000678 | $0.000814 | $0.001018 |
| GLM / feedback | 6/6 | 6/6 | 6/6 | 2.33 | 5,900 | 15.45 / 28.87 | $0.000803 | $0.000803 | $0.000803 |

Development total: **150 requests, 426,581 reported tokens, $0.047745962**, 253.99 seconds batch elapsed with four workers. All 60 attempts had complete usage and healthy infrastructure. Failed work stays in every average and cost-per-success figure.

The helper added an unfamiliar signature and selector callback. For example, Muse annotated a selector page as `any`; this broke inference of the helper's row type and produced unknown-row diagnostics. GLM also omitted an API import in one helper program. The model-free helper itself preserved precise invoice types and rejected a missing field before any call. Its implementation worked; the model's use of the new interface still created repair work. Mean requests rose from 2.50 to 2.83 with Muse and 2.67 to 2.83 with GLM, with estimated cost increases of 0.8% and 4.3%. Lower development median time did not compensate for failure to meet the cost gate.

Lean saved estimated cost (25.4% Muse, 15.6% GLM), but Muse's W2 had one missing and one unintended reservation. GLM's R2 made the correct payment, then returned prose followed by unfenced JSON, which the frozen parser rejects. That is a serialization failure, not a payment failure. Smaller feedback's apparent Muse saving arose without any changed feedback being delivered; sampling/provider/cache variation is a sufficient alternative explanation.

### Selection and freezing

Before development, source hashes, actual task definitions, prompts, limits and eligibility gates were frozen. A feature needed at least baseline business/effect correctness for **each model**, at least 10% lower mean cost on one model, no greater than 10% cost increase on the other, and no greater than 25% median latency increase on either. Eligible helper/lean features could be combined, with at most one recipe/feedback feature.

Recipe and feedback qualified numerically. The precise tie-break—lower average model-normalized mean cost—was chosen **after development, before confirmation**, rather than fully prespecified. Recipe won it; helper and lean failed eligibility. The only selected feature was recipe. There was no second development matrix, prompt revision or selection based on confirmation results. The controller's selection and export scripts were added after development; model-facing sources/runtime/tasks were already frozen.

Local `selection.json` SHA-256: `38d879790ed4489cbaa30fd4fc42f964ffc56ad2c91e1a2015fca1d992c63689`. The published JSON includes the selection record, gates and source hashes.

## Confirmation on new definitions

**Six new definitions × three worlds × two arms × two models = 72 attempts.** These extend business rules, not just names or amounts, using the same synthetic connector generator. Each row covers six distinct definitions and 18 attempts. Worlds 4–6 are fresh generated instances; development used world 3.

| Definition | New business rule |
| --- | --- |
| N1: converted ledger | Separate covered/unpaid balances, per-invoice currency rounding, country totals and partial-payment counts |
| N2: remaining allocation | Reserve only the remaining units on partially reserved orders, in date/id priority, updating available stock |
| N3: support credit | Join tickets/worklogs/customers by account reference, sum budget overruns, cap credits and avoid existing same-reason credits |
| N4: oldest capped payment | Choose one oldest eligible unpaid invoice per customer and cap each payment |
| N5: fulfillable value | Subtract existing reservations from demand, clamp by stock, rank five products by fulfillable value |
| N6: invalid read then credit | Recover from one schema-invalid read, select a product and add the specifically requested credit without duplication |

| Model / shared profile | Answer + state | Strict JSON success | Effects correct | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/business success | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse / baseline | 17/18 | 17/18 | 17/18 | 3.22 | 14,643 | 25.87 / 44.93 | $0.001459 | $0.001545 | $0.001545 |
| Muse / recipe | 18/18 | 18/18 | 18/18 | 2.39 | 10,186 | 16.86 / 40.22 | $0.001039 | $0.001039 | $0.001039 |
| GLM / baseline | 17/18 | 14/18 | 17/18 | 3.00 | 9,791 | 22.30 / 36.33 | $0.001342 | $0.001421 | $0.001726 |
| GLM / recipe | 18/18 | 13/18 | 18/18 | 2.50 | 7,446 | 16.04 / 26.43 | $0.001009 | $0.001009 | $0.001396 |

All 72 attempts had healthy infrastructure and known usage. Answer/state success accepts pure JSON or one unambiguous JSON code block; strict success additionally requires pure JSON. Pure JSON formatting alone was 18/18 baseline and recipe for Muse, and 15/18 baseline versus 13/18 recipe for GLM; a well-formatted wrong answer is not a strict success.

### Efficiency, repair and effects

| Recipe change relative to baseline | Muse | GLM |
| --- | --- | --- |
| Estimated cost/attempt | −28.8% | −24.9% |
| Reported tokens/attempt | −30.4% | −24.0% |
| Model requests/attempt | −25.9% | −16.7% |
| Median elapsed time | −34.8% | −28.1% |
| Generated script UTF-8 bytes/attempt | 3,981 → 2,848 (−28.5%) | 3,425 → 2,495 (−27.2%) |
| Compile-rejected programs | 5 → 2 | 15 → 6 |
| Runtime-error programs | 3 → 1 | 2 → 3 |
| Capability invocations, all 18 attempts | 390 → 312 | 275 → 272 |
| Incorrect effects | 9 unintended reservations → 0 | 11 missing reservations → 0 |

No duplicate business-key effects or wrong-valued matched effects occurred in confirmation. All rejected programs had zero capability calls from that program; this does not erase effects of previous programs. Full diagnostics retrieval was available in every arm, but no confirmation attempt used it. Average total compiler time including repairs was about 169–198 ms/attempt across these four groups; model/provider round trips dominate the observed wall times.

The added prompt was more than paid back by smaller generated programs and fewer requests in this sample. This supports making the programming pattern easier to follow while retaining checking. It does not measure TypeScript versus JavaScript token costs or prove that checking caused the gains.

### What actually failed

- **GLM baseline N2, world 4:** fetched only first pages of orders/products/stock/reservations and wrote nine reservations, omitting eleven required ones. The program passed checking. Knowing types does not ensure complete pagination; the example directly addresses this class of mistake.
- **Muse baseline N2, world 4:** first returned entire tables and exceeded the result budget; that read-only program had no writes. Its next program used `any` and looked up existing reservations with `o.orderId` although orders expose `o.id`. It created nine unintended reservations alongside required ones. Checking cannot catch missing-field mistakes once the model erases the types with `any`. There is no evidence that the earlier error caused duplicate replay.
- **Recipe outlier:** Muse N5, world 5 still used seven model requests, hit a result-budget error and then a missing-brace compiler rejection before succeeding (48.10 s, $0.003834226). The recipe helps on average, not in every attempt.
- **GLM formatting:** five recipe attempts wrapped otherwise correct final results. A pagination recipe does not solve host finalization.

## Token and cost accounting

Tokens below are totals over 18 confirmation attempts per row. Reported tokens are input + cache read + cache write + output; reasoning is already within output and is **not added again**. Cache write is zero throughout. Cost uses the frozen October 1 OpenRouter public catalog and recorded usage, not a reconciled provider invoice.

| Model / shared profile | Input | Cache read | Output | Reasoning (within output) | Reported total | Requests | Total estimated $ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse / baseline | 183,354 | 40,986 | 39,227 | 13,511 | 263,567 | 58 | $0.026262772 |
| Muse / recipe | 124,661 | 27,786 | 30,908 | 11,781 | 183,355 | 43 | $0.018703272 |
| GLM / baseline | 76,253 | 79,296 | 20,688 | 5,957 | 176,237 | 54 | $0.024160830 |
| GLM / recipe | 55,371 | 62,720 | 15,933 | 2,593 | 134,024 | 45 | $0.018153750 |

Confirmation total: **200 requests, 757,183 reported tokens, $0.087280624**, 409.66 seconds batch elapsed with four workers. Entire tuning run: **132 attempts, 350 requests, 1,183,764 tokens, $0.135026586**. September 30/October 1 measured sequence including 049/051/054: **$0.381842432**; the older approximately $1.21 research estimate remains separate. The simple new-work cap was $3.75 within the existing €5 authorization; no request/payload/attempt-time limit terminations, infrastructure failures or unaccounted replacements occurred.

## Uncertainty and limits

The export uses 10,000 descriptive percentile bootstrap resamples of six whole task blocks, preserving all three worlds and both arms. These are not population/generalization intervals. Candidate/baseline mean cost ratio: Muse **0.712, interval 0.539–0.891**; GLM **0.751, interval 0.497–1.142**. GLM's interval includes parity, so its positive point estimate is less secure. Both success-difference intervals include parity (0 to 0.167); this is not established general reliability superiority. Mean-time ratio intervals also include parity for both models. Median-time reductions above are observed values, not statistically established latency guarantees.

Six definitions and repetitions in one reused synthetic generator are still a small corpus. Provider routing/cache were uncontrolled, and four concurrent workers affect timing. The same model/reasoning setting is held within comparisons, but model-to-model comparisons are not reasoning-matched. The recipe was selected using development results. This confirmation has no native-Pi arm; do not compare its absolute costs with 054 as if prompt tuning proved Strata now beats native Pi on GLM.

## Implementation and reproducibility

- [variants](../examples/tuning/variants.ts): pinned prompt, helper and model-facing presentation variants.
- [extension](../examples/tuning/extension.ts): production `createSession`, full checking/QuickJS/broker, task-defined grants. All arms expose `typed_program` and `program_details`; 054 exposed only `typed_program`, so this is a fresh baseline with shared details access.
- [protocol](../examples/tuning/protocol.ts): controller-only tasks/oracles/answer-and-state grading; never imported by the agent extension. Hidden expected answers stay outside model context.
- [preflight](../examples/tuning/preflight.ts): 57 model-free checks, including 18 independent SQL answer comparisons; helper inference/missing-field rejection, repeated cursors, pagination and negative grading controls.
- [driver](../examples/tuning/run.ts): fresh process/state per attempt; pinned sources, models, prices and limits; alternating arm/model order and four-worker dispatch; resume from durable results while refusing to overwrite an unaccounted paid attempt.
- [selection](../examples/tuning/select.ts) and [export](../examples/tuning/summarize.ts): preserve all cells, errors, formats, effects and cost including failures.

Limits: eight requests/attempt, 4096 output tokens/request, 262144 payload bytes/request, 180 seconds/attempt, unchanged program execution budgets. Installed Pi 0.99.1 and Bun 1.4.0; TypeScript 5.9.3/QuickJS 0.32.0. Repository Pi pin remains 0.73.1; these experiments do not certify the full extension against installed Pi.

Model-free verification:

```sh
bun run check
bun examples/tuning/preflight.ts
bun examples/tuning/summarize.ts
```

Raw matrices/prompts/transcripts/profiles/state are local under ignored `.work/tuning-20261001-v1/`; only sanitized evidence is tracked. Never prepare over existing results. A separately authorized paid replay needs a fresh `STRATA_TUNING_OUT` and public catalog at `/tmp/strata-openrouter-models-20261001.json`, then prepare/development/selection/confirmation in that order. Reusing these inspected tasks would be regression/development evidence, not new holdout evidence. Existing macOS/Bun full-suite baseline failures remain deferred in 050.

## What this suggests next

The useful principle is **teach one concrete correct pattern before adding a more elaborate abstraction**. Here, the models used fewer tokens even though the prompt got longer. Keep precise inferred API types and quiet pre-execution checking; simplify generated code before weakening contracts. If a new business workflow justifies more work, canonical final JSON (058) addresses the remaining measurable formatting gap, and action receipts (053) matter for critical writes. A redesigned simpler helper or a diagnostic test with guaranteed compile failures would require a new selected scope. Tool search still needs a genuinely larger catalog comparison under 059. No additional implementation or paid run is selected by this report.
