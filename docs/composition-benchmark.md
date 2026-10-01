# Broader composition comparison — October 1, 2026

## Decision

**Retain checking before execution. The clearest new advantage is lower whole-system model cost with Muse Spark; the tradeoff with GLM is more repairs and longer completion time.** This is a useful result on a broader synthetic corpus, with concrete failures to inspect. It establishes neither universal superiority nor the isolated value of the semantic gate.

The documentation checkpoint was committed and pushed as `7b64a4e` before new paid work. [054](../.work/issues/054-broader-composition-benchmark.md) is delivered. Production defaults and dependency pins were preserved. [055](../.work/issues/055-checking-attribution.md) records a deferred checking-attribution follow-up; 052/053 remain deferred.

## Scope and method

Twenty distinct workflow definitions in five families, three fresh repetitions, two approaches and two models: **240 evaluation attempts**. Four separate development definitions produced **16 additional attempts**. Each comparison row has 20 definitions and 60 attempts. Repetitions change numeric values and row order, rather than adding task definitions. The shared data covers customers, invoices, payment ledgers, orders, products, stock, reservations, tickets, worklogs, currency rates and credits. Lists return only 24 rows per page.

| Family | Four workflow definitions |
| --- | --- |
| Joins | Customer unpaid balances; late-delivery ranking; account-reference/worklog join; pack-unit stock shortages |
| Aggregation | Country/currency conversion; SKU sales; ledger coverage histogram; billable-minute median/P90 |
| Updates | Pay outstanding remainders; sequential stock allocation; late-delivery credits; close resolved tickets within budget |
| Contracts | Pack/individual-unit value; calendar-date age; opaque account references; paid status versus actual ledger |
| Service recovery | Temporary read failure; lost payment reply after its effect; protected-stock denial; invalid product response |

Service failures are controlled fixture behavior in four definitions. They are reported separately from model-generated mistakes and cannot estimate a real service's error frequency. All operations are synthetic; reported payments are simulated effects.

Checked Strata uses the **actual production `createSession()`**, full generated declarations, semantic checking before execution and QuickJS. Native Pi uses installed **Pi 0.99.1 Codemode**, with task-relevant schemas preloaded (inline budget 100000). Both use the same operations, schemas, descriptions, fixture, broker validation and grants. Both receive pagination, unit and recovery instructions. Strata's prompt explicitly says to return from `main()` rather than print, unlike the earlier pilot. Neither arm has filesystem/shell tools or permission for nested model calls.

This is a whole-system comparison. Declaration rendering, module conventions, tool feedback and native Codemode helpers differ. Strata has a five-second program timeout and 100-call program limit; native uses its existing execution behavior. The common controller stops a cell after 180 seconds or 16 MiB of captured output. Native runaway programs exhausted that output limit; Strata could recover from its own program-call limit. Do not attribute every difference to type checking.

Each attempt starts in a fresh process and service world. Task order is deterministically permuted; model/approach order alternates within blocks, with four asynchronous workers. Provider routing and prompt caches are uncontrolled. Model settings are Muse Spark **medium** and GLM 5.3 Flash **low**, confirmed in every captured provider request. Sources, task descriptions, limits, matrix and prices were frozen before dispatch. The development controller was archived before tightening usage-completeness/resume guards; no model prompt, fixture, oracle or runtime changed between development and evaluation.

## Primary results

A scored success requires a parseable requested answer, exact answer equality and exact resulting effects, plus a completed run. Pure JSON success additionally rejects Markdown/prose. The business parser accepts pure JSON or one unambiguous JSON code block; it does **not** accept JavaScript object literals. Consequently one native GLM failure below is serialization only. This protocol is frozen separately from the older pilots; their scores are preserved.

One request is one model turn. Tokens are input + cached input + output; reasoning is already within output. Failed work is included in averages, time and cost per success. Cache writes were zero. Costs are Pi estimates using the October 1 public OpenRouter catalog, not reconciled invoices.

| Model / approach | Answer + state | Pure JSON success | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/scored success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | 58/60 | 58/60 | 2.12 | 8,614 | 10.46 / 25.88 | $0.000844 | $0.000873 |
| Muse, checked Strata | 60/60 | 60/60 | 2.13 | 6,207 | 10.87 / 23.12 | $0.000653 | $0.000653 |
| GLM, native Pi | 56/60 | 49/60 | 2.17 | 6,847 | 6.74 / 21.45 | $0.000858 | $0.000919 |
| GLM, checked Strata | 59/60 | 36/60 | 2.57 | 6,004 | 13.16 / 29.92 | $0.000910 | $0.000925 |

**Muse:** checked Strata used **28.0% fewer reported tokens and 22.6% lower estimated cost per attempt**. Cost per scored success fell **25.2%**. Median time was 3.9% higher; mean time was effectively equal. Every family had lower mean model cost with checked Strata. The two native failures share one task definition, so they are not two independent reliability discoveries.

**GLM:** checked Strata used **12.3% fewer tokens**, but **18.5% more requests and 6.0% higher cost per attempt**. Cost per scored success differed by only about 0.7%. Median time rose from 6.74 to 13.16 seconds; the mean rose 52.7%. Pure JSON compliance was materially worse with checked Strata (36/60 versus 49/60). This is not an overall efficiency win for GLM.

Successful-attempt median seconds: Muse native 10.87, checked 10.87; GLM native 6.74, checked 12.13. The primary timing table includes failures. An early terminated program is not a faster successful workflow.

### Full token/cost accounting

| Model / approach | Requests total | Input | Cache read | Output | Reasoning (within output) | Estimated total $ |
| --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | 127 | 385,402 | 71,567 | 59,861 | 19,213 | $0.050656 |
| Muse, checked Strata | 128 | 259,209 | 47,232 | 65,956 | 24,510 | $0.039207 |
| GLM, native Pi | 130 | 227,040 | 158,464 | 25,324 | 1,174 | $0.051472 |
| GLM, checked Strata | 154 | 204,101 | 115,136 | 41,027 | 2,492 | $0.054583 |

Completion output was **10.2% higher for checked Muse and 62.0% higher for checked GLM**, including code, reasoning, repairs and final answers. That does not isolate the token cost of writing TypeScript, but it shows why fewer total tokens need not mean cheaper output. Smaller input context offsets the output increase for Muse. Different cache proportions also affect price.

Evaluation estimated cost: **$0.195917**. Development: **$0.008571**. Total new work: **$0.204487** over **576 requests**; the separately published prior pilots cost $0.042328, making this sequence approximately **$0.246816**. All 256 attempts have complete request usage. Evaluation dispatch took 795.5 seconds with four workers; this batch duration is not single-cell latency.

### Paired uncertainty

| Model | Measure, checked/native | Estimate | Task-block 95% interval |
| --- | --- | --- | --- |
| muse | Mean cost ratio | 0.774 | 0.649–0.907 |
| muse | Mean token ratio | 0.721 | 0.608–0.854 |
| muse | Mean request ratio | 1.008 | 0.930–1.104 |
| muse | Mean time ratio | 0.998 | 0.856–1.183 |
| muse | Completion difference (percentage points) | 3.3 | 0.0–10.0 |
| glm | Mean cost ratio | 1.060 | 0.871–1.293 |
| glm | Mean token ratio | 0.877 | 0.714–1.077 |
| glm | Mean request ratio | 1.185 | 1.074–1.317 |
| glm | Mean time ratio | 1.527 | 1.193–2.001 |
| glm | Completion difference (percentage points) | 5.0 | 0.0–10.0 |

Intervals are descriptive percentile bootstrap intervals from 10000 resamples of **whole task blocks**, preserving three repetitions and both approaches within each of 20 definitions. A ratio below one favors checked Strata; time here is mean time, not median. Both completion intervals include zero. The Muse cost interval excludes parity on this corpus; that is stronger than the six-attempt pilot, while generalization to real services remains untested. GLM cost and token intervals include parity; its request/time penalties are clearer here. Correlated synthetic tasks, selected task families, caches and routing limit interpretation.

## Failures and observed effects

| Attempt(s) | What happened | Answer/state distinction |
| --- | --- | --- |
| W1 native Muse, repetitions 2 and 3 | Indexed prior payments with nonexistent `invoice.invoiceId` instead of `invoice.id`; paid full totals rather than remainders | Ten wrong payment amounts; simulated overpayment 402305 EUR cents across two independent worlds; answer and state fail |
| W1 native GLM, repetition 1 | Used an object/string cursor incorrectly and repeatedly fetched page one until the output guard terminated the cell | No writes; five required payments missing |
| J1 native GLM, repetition 3 | Repeated pagination from the beginning after a null cursor; output guard terminated the cell | No answer; state stayed unchanged |
| J3 native GLM, repetition 2 | Read only the first page of customers, tickets and worklogs | Incomplete join answer; unchanged state |
| W1 checked GLM, repetition 2 | Correctly paid five remainders, filtered its result by an incorrect total-ledger-entry count, then inspected the now-paid state and claimed no new payments were made | Correct effects, wrong final answer; no duplicate writes |
| R3 native GLM, repetition 3 | Both reservation actions behaved correctly, but the final answer was a JavaScript object literal with unquoted keys/single quotes | Correct effects and human-readable content; unparseable under the frozen JSON protocol |

No duplicate payments/reservations/credits or writes to unintended business targets were observed in any arm. Correct effect state: Muse native 58/60, checked 60/60; GLM native 59/60, checked 60/60. An unchanged read-only world can pass effect grading even when the answer fails, so this is not a substitute for completion. Each arm required 114 effects across its matrix; native Muse had ten incorrect amounts, native GLM omitted five payments, checked arms had no missing or wrongly valued effects.

Both approaches handled the lost-payment-reply scenario in all six model/repetition combinations without duplicating the payment. Unlike the old seeded recovery, the task required observing a baseline ledger before writing, explicitly distinguishing older matching payments from a new action. This is a favorable result with observable state and precise instructions, not automatic recovery from arbitrary uncertainty.

## What this says about checking

The broader tasks generated **32 compiler-rejected programs: four Muse, 28 GLM**. All were rejected before any capability calls from that program. Muse repaired two missing braces and two cursor/result inference annotations (TS7022). GLM diagnostics include missing properties, mismatched response shapes, nullable cursors, unknown page/row values from generic helpers and strict typing of dictionaries/callbacks. Not every rejection identifies a business mistake: some code would execute successfully as JavaScript.

Checked compiler time totaled 9.32 seconds for Muse and 10.25 seconds for GLM, about **155/171 ms per attempt**, across all initial checks and repairs. These timers exclude session/declaration setup, which is included in wall time. Clean checks add no diagnostic text to model context. The larger GLM cost is chiefly additional model repair work and output, rather than local compiler CPU time.

The native Muse overpayment used a field absent from the schema. Accurate TypeScript inference can reject that access; `any` can erase the protection. The matched checked runs used the correct field, but they generated different programs, so this is not a causal proof that adding the compiler to the native attempt alone would guarantee success. Types also did not prevent checked GLM's false claim about payments it had already made.

**Practical conclusion:** keep the current quiet checking before execution, especially for business writes. It provides early contract feedback at a small local runtime cost and has now encountered naturally generated errors. Continue to inspect state after uncertain execution, and track what each attempt actually completed. Do not choose a model/approach only from pass rate: Muse's whole-system cost result is favorable; GLM's repairs and output compliance are real disadvantages. [055](../.work/issues/055-checking-attribution.md) is the deferred experiment needed to isolate the semantic gate itself.

## Tuning follow-up

The [post-run inventory and improvement plan](glm-improvement-plan.md) distinguishes the full extension’s existing custom instructions/search/load tools from 054’s small preloaded surface. It proposes a correct pagination example/typed helper, smaller diagnostics, effect receipts and explicit result finalization. Prompt and function-presentation/discovery changes are separate deferred comparisons. A review found 19 of 60 checked GLM attempts had compiler rejections; 16 of the 28 rejected programs declared pagination helpers. No code, scores or paid calls changed in that review.

## Family results

Each row has **four distinct definitions, three repetitions = twelve attempts**. All-attempt time and costs include failures; see the sanitized data for strict format, P90 and full breakdowns.

| Model / approach | Family | Answer + state | Requests/attempt | Tokens/attempt | Median seconds | $/attempt |
| --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | joins | 12/12 | 2.17 | 9,882 | 10.74 | $0.000961 |
| Muse, native Pi | aggregation | 12/12 | 2.08 | 7,324 | 8.42 | $0.000694 |
| Muse, native Pi | updates | 10/12 | 2.08 | 9,150 | 11.38 | $0.000945 |
| Muse, native Pi | contracts | 12/12 | 2.00 | 7,341 | 9.38 | $0.000771 |
| Muse, native Pi | service-recovery | 12/12 | 2.25 | 9,372 | 13.88 | $0.000850 |
| Muse, checked Strata | joins | 12/12 | 2.00 | 5,640 | 11.51 | $0.000581 |
| Muse, checked Strata | aggregation | 12/12 | 2.00 | 5,046 | 8.68 | $0.000517 |
| Muse, checked Strata | updates | 12/12 | 2.17 | 7,659 | 12.76 | $0.000834 |
| Muse, checked Strata | contracts | 12/12 | 2.17 | 5,824 | 11.43 | $0.000633 |
| Muse, checked Strata | service-recovery | 12/12 | 2.33 | 6,864 | 11.07 | $0.000703 |
| GLM, native Pi | joins | 10/12 | 2.17 | 7,267 | 9.93 | $0.000928 |
| GLM, native Pi | aggregation | 12/12 | 2.17 | 8,144 | 4.67 | $0.000949 |
| GLM, native Pi | updates | 11/12 | 2.00 | 6,185 | 9.99 | $0.000843 |
| GLM, native Pi | contracts | 12/12 | 2.08 | 6,431 | 10.94 | $0.000937 |
| GLM, native Pi | service-recovery | 11/12 | 2.42 | 6,209 | 4.69 | $0.000633 |
| GLM, checked Strata | joins | 12/12 | 2.42 | 5,730 | 16.10 | $0.000956 |
| GLM, checked Strata | aggregation | 12/12 | 2.75 | 7,384 | 16.46 | $0.001051 |
| GLM, checked Strata | updates | 11/12 | 3.08 | 8,902 | 13.46 | $0.001271 |
| GLM, checked Strata | contracts | 12/12 | 2.17 | 4,273 | 8.12 | $0.000750 |
| GLM, checked Strata | service-recovery | 12/12 | 2.42 | 3,733 | 5.57 | $0.000521 |

## Separate development run

Four disjoint definitions, one repetition per arm/model. Development sources and matrix were archived locally. All 16 answer/effect scores passed; one checked GLM response used a fence. Muse's five-request development attempt repaired a missing brace and inspected pagination. No evaluation prompt tuning followed.

| Model / approach | Answer + state | Pure JSON success | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/scored success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | 4/4 | 4/4 | 2.25 | 7,270 | 8.13 / 11.80 | $0.000668 | $0.000668 |
| Muse, checked Strata | 4/4 | 4/4 | 3.00 | 6,433 | 18.92 / 56.32 | $0.000648 | $0.000648 |
| GLM, native Pi | 4/4 | 4/4 | 2.00 | 4,694 | 6.34 / 15.79 | $0.000538 | $0.000538 |
| GLM, checked Strata | 4/4 | 3/4 | 2.00 | 2,291 | 4.94 / 5.37 | $0.000288 | $0.000288 |

## Verification and reproduction

- `bun run check` passed.
- `bun examples/composition/preflight.ts`: **78 model-free checks**, covering list pagination/schema contracts, grader rejection of wrong answers and extra/missing effects, and handwritten real-session pagination/payment-recovery programs.
- `bun examples/composition/verify-oracles.ts`: **72 independent SQL answer checks** agree with the in-memory controller oracles across all 24 definitions and three worlds. This additional audit ran during evaluation without changing any frozen source or score.
- Every paid attempt, including the two output-limit failures, is retained. No infrastructure replacement or hidden success rerun was used. Complete usage/cost receipts and source hashes are audited; native script duration is unmeasured rather than reported as zero. Native call-metric outcome sentinels are corrected in the export using actual Codemode error events; caught nested API errors are counted separately. Model-issued tool calls count composition requests, not every nested capability invocation.

[Sanitized 256-cell metrics](evaluations/composition-2026-10-01.json) contain task definitions, fingerprints, aggregate/family/paired metrics, every cell, compiler diagnostic codes and effect counts. They omit transcripts, answers, backend state, credential paths and request payloads. Raw artifacts remain ignored under `.work/composition-20261001-v1/`.

The corpus/extension/controller live in `examples/composition/`. `bun examples/composition/summarize.ts` regenerates the sanitized export without model calls. A future authorized replay must use a **fresh output directory** via `STRATA_COMPOSITION_OUT`, a freshly verified public catalog at `/tmp/strata-openrouter-models-20261001.json`, and the documented installed Pi path; then `--prepare`, `--dev`, `--run`. Prepare writes the matrix: never use it over existing evidence. The runner validates source hashes and resumes only recorded cell results; incomplete paid evidence requires inspection. It uses the existing OpenRouter credential privately from the environment or Pi auth storage. Eight requests/cell, 4096 completion tokens/request, 262144 serialized payload bytes/request, 180 seconds/cell, four workers and a $4.35 new-batch cap were frozen. This run used only $0.2045; the cap is a guard, not its cost forecast.
