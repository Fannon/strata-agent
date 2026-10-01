# Checking-policy comparison: correctness, work, speed and cost

Updated 2026-10-01 from the recorded 049/051 cells. This is a model-free reporting update, with no new benchmark calls. Both campaigns used Pi 0.99.1 and the same small synthetic fixture.

## Definitions and limits

- A turn means one model/provider request. Capability invocations are separate and appear in the downloadable data.
- Every average and percentile includes all attempted cells, including failures. Natural comparisons contain six attempts per profile, but only **two distinct task definitions**, each repeated three times on the same initial world.
- Reported tokens are input + cache reads + cache writes + output. Input excludes cached tokens in these records; reasoning is shown separately where reported and is not added again. Counts follow each model/provider tokenizer.
- Cost is estimated from Pi usage and frozen catalog rates, not a reconciled provider bill. Cost per strict success is the cost of **all** attempts divided by strict successes.
- Wall time is captured subprocess elapsed time, including Pi startup, model requests and tool execution; seeded rows also include seed execution. It excludes catalog download, dependency installation and profile preparation. P90 uses linear interpolation and is descriptive only at n=6 or n=2.
- Reasoning settings, prices, caches, generation lengths and provider timing differ between models. Baseline-first order was not fully counterbalanced. These are development observations, not causal efficiency estimates.

## Natural tasks

### Muse Spark — medium reasoning

Two tasks × three fresh repetitions per profile. Strict answers must be pure JSON.

| Approach | Strict | Requests/attempt | Tokens/attempt | Median s | P90 s | $/attempt | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Native Pi Codemode | 6/6 | 2.17 | 8,323 | 17.72 | 30.12 | $0.000735 | $0.000735 |
| Strata: always check | 6/6 | 2.17 | 5,848 | 11.66 | 16.00 | $0.000635 | $0.000635 |
| Strata: never check | 6/6 | 2.17 | 6,130 | 11.34 | 21.44 | $0.000617 | $0.000617 |
| Strata: check after failure | 6/6 | 2.50 | 6,986 | 17.46 | 20.06 | $0.000739 | $0.000739 |

Token breakdown, mean per attempt:

| Approach | Uncached input | Cached input | Output | Reported reasoning, already accounted for |
| --- | --- | --- | --- | --- |
| Native Pi Codemode | 5,394 | 1,973 | 956 | 388 |
| Strata: always check | 4,866 | 245 | 737 | 298 |
| Strata: never check | 4,424 | 842 | 864 | 383 |
| Strata: check after failure | 5,803 | 392 | 791 | 309 |

### GLM 5.3 Flash — low reasoning

Two tasks × three fresh repetitions per profile. Strict answers must be pure JSON.

| Approach | Strict | Requests/attempt | Tokens/attempt | Median s | P90 s | $/attempt | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Native Pi Codemode | 4/6 | 2.00 | 5,575 | 9.26 | 13.70 | $0.000493 | $0.000740 |
| Strata: always check | 4/6 | 2.50 | 5,440 | 10.32 | 24.48 | $0.000706 | $0.001059 |
| Strata: never check | 6/6 | 2.00 | 3,840 | 7.86 | 9.93 | $0.000473 | $0.000473 |
| Strata: check after failure | 3/6 | 2.17 | 4,358 | 4.85 | 11.49 | $0.000520 | $0.001040 |

Token breakdown, mean per attempt:

| Approach | Uncached input | Cached input | Output | Reported reasoning, already accounted for |
| --- | --- | --- | --- | --- |
| Native Pi Codemode | 1,656 | 3,648 | 271 | 182 |
| Strata: always check | 2,360 | 2,528 | 552 | 201 |
| Strata: never check | 1,700 | 1,813 | 327 | 40 |
| Strata: check after failure | 1,647 | 2,304 | 407 | 80 |

## Seeded recovery

These are separately reported diagnostics, not estimates of natural mistake frequency. Native Pi was not included in these seeded arms. Each row has one task definition × two repetitions.

### Muse Spark — medium reasoning

| Family / approach | Strict | Correct effects | Requests/attempt | Tokens/attempt | Median s | $/attempt | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Partial payment / Strata: always check | 2/2 | 2/2 | 2.50 | 7,985 | 24.87 | $0.000886 | $0.000886 |
| Partial payment / Strata: never check | 2/2 | 2/2 | 2.00 | 6,407 | 21.20 | $0.000736 | $0.000736 |
| Partial payment / Strata: check after failure | 2/2 | 2/2 | 2.00 | 6,816 | 29.36 | $0.000780 | $0.000780 |
| Silent wrong result / Strata: always check | 2/2 | 2/2 | 2.00 | 4,824 | 5.86 | $0.000489 | $0.000489 |
| Silent wrong result / Strata: never check | 2/2 | 2/2 | 2.00 | 4,932 | 7.35 | $0.000514 | $0.000514 |
| Silent wrong result / Strata: check after failure | 2/2 | 2/2 | 2.00 | 4,947 | 7.46 | $0.000518 | $0.000518 |

### GLM 5.3 Flash — low reasoning

| Family / approach | Strict | Correct effects | Requests/attempt | Tokens/attempt | Median s | $/attempt | $/strict success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Partial payment / Strata: always check | 1/2 | 1/2 | 2.00 | 3,852 | 7.70 | $0.000398 | $0.000796 |
| Partial payment / Strata: never check | 1/2 | 2/2 | 2.00 | 4,216 | 15.01 | $0.000502 | $0.001004 |
| Partial payment / Strata: check after failure | 1/2 | 2/2 | 2.00 | 4,148 | 7.51 | $0.000423 | $0.000846 |
| Silent wrong result / Strata: always check | 2/2 | 2/2 | 2.00 | 3,805 | 11.70 | $0.000515 | $0.000515 |
| Silent wrong result / Strata: never check | 2/2 | 2/2 | 2.00 | 3,601 | 3.55 | $0.000320 | $0.000320 |
| Silent wrong result / Strata: check after failure | 2/2 | 2/2 | 2.00 | 3,658 | 5.51 | $0.000332 | $0.000332 |

## Reading the measurements

The Muse Spark natural sample has an encouraging whole-system signal: checked Strata matched native Pi at 6/6 strict success with approximately **30% fewer reported tokens, 14% lower estimated model cost per attempt, and 34% lower median wall time**. Request counts were equal. This is a descriptive result over two tasks, not confirmation that the difference generalizes or is caused by checking.

GLM did not repeat that advantage: checked Strata and native Pi each had 4/6 strict successes; checked Strata used 2.50 versus 2.00 requests/attempt, cost approximately **43% more per attempt** and had **11% higher median wall time**. All natural content and effects were correct after diagnostic outer-fence removal, so strict score differences mainly reflect formatting. Never-check's 6/6 and deferred-check's lower median time do not establish a reliable winner on this sample.

Early checking prevented the deliberately supplied field mistakes before calls, including a partial-payment case and a silent wrong answer. That establishes a prevention mechanism within Strata's policy comparison. A matched native-Pi seeded comparison has not been run. GLM also exposed missing-return and business-recovery mistakes that checking did not prevent; see the individual reports.

## Data and reproduction

[Sanitized per-cell metrics and aggregates](evaluations/checking-policy-2026-10-01.json) cover all 72 attempts, including input/output/cache/reasoning tokens, requests, timing, cost, correctness and capability-call counts. No raw answers, programs, state, transcripts or credentials are published in this export.

With the ignored original artifact directories present, regenerate it without model calls:

```sh
bun examples/checking/compare.ts .work/checking-20260930-v2 .work/checking-20261001-glm-v1
```

Individual reports: [Muse Spark](checking-policy-pilot.md), [GLM](glm-checking-policy-repeat.md). The user subsequently selected the [broader design under 054](../.work/issues/054-broader-composition-benchmark.md) for implementation and running after this documentation checkpoint is pushed; no new run is part of the measurements here.
