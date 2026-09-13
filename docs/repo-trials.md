# Repository trials: evidence review and next decision

Reviewed 2026-09-06 against code at `807562a` and the four local repo-2 result files. This report supersedes earlier narrative summaries; historical result files and verdicts are unchanged. No new paid run or regrading occurred during this review.

## Evidence and provenance

One model (`meta/muse-spark-1.3-contributor`, thinking off), three profiles: stock Pi, typed QuickJS, typed Bun. Each stage used two independent sessions per task/profile. Stages differ in task and prompt revisions, and the close-out repeats previously observed tasks; pooling them does not produce independent confirmatory evidence.

[Sanitized cell summaries](evaluations/repo-2-2026-09-06.json) preserve the source run IDs, result-file SHA-256 hashes, clean Git revisions, per-cell verdict categories, usage and timings. Raw transcripts, requests and credentials stay local. This export permits checking the aggregates; it is not a substitute for raw-trace reproduction. The original fixtures and runner are tracked in `examples/repo-tasks/` and `examples/repo-pilot.ts`.

| Stage | Profile | Exact answers | Overall success | Estimated cost | Total tokens | Pi tool calls | Median seconds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dev | stock-pi | 12/12 | 11/12 | $0.01102 | 172,652 | 84 | 9.86 |
| dev | typed-quickjs | 11/12 | 11/12 | $0.01905 | 358,048 | 33 | 10.07 |
| dev | typed-bun | 12/12 | 12/12 | $0.02122 | 431,947 | 40 | 12.48 |
| held-out | stock-pi | 12/12 | 12/12 | $0.01011 | 140,182 | 60 | 9.37 |
| held-out | typed-quickjs | 12/12 | 12/12 | $0.02271 | 376,765 | 35 | 12.25 |
| held-out | typed-bun | 11/12 | 11/12 | $0.02498 | 419,190 | 39 | 12.60 |
| wave-2 | stock-pi | 5/6 | 5/6 | $0.00660 | 96,758 | 45 | 14.20 |
| wave-2 | typed-quickjs | 6/6 | 6/6 | $0.01270 | 211,408 | 19 | 20.58 |
| wave-2 | typed-bun | 5/6 | 5/6 | $0.01302 | 225,945 | 20 | 15.74 |
| path-closeout | stock-pi | 10/10 | 9/10 | $0.01212 | 178,851 | 80 | 11.08 |
| path-closeout | typed-quickjs | 10/10 | 10/10 | $0.01757 | 319,748 | 31 | 12.28 |
| path-closeout | typed-bun | 10/10 | 10/10 | $0.01691 | 393,573 | 39 | 12.14 |

Overall success includes policy and harness requirements. Tool calls are Pi tool invocations, not necessarily model round trips or underlying broker operations. Costs are Pi/catalog estimates used by the ledger, not provider billing receipts. Token totals include the recorded categories and should not be treated as equally priced tokens.

## What the results support

- **No demonstrated typed advantage on these repository tasks.** In dev+held-out, all profiles had 23/24 overall successes, but exact correctness was stock 24/24, QuickJS 23/24 and Bun 23/24. Typed profiles used 68/79 tool calls versus stock's 144; their aggregate token totals were 2.35×/2.72× stock and estimated costs 1.98×/2.19× stock. Fewer tool calls did not translate into a clear latency win.
- **Efficiency is informative even at high success.** Wave-2 (chain, 1,500-line aggregation, narrowing) retained the cost disadvantage. This tests those particular mechanics; it does not exhaust structured repository tasks or establish model equivalence.
- **Context footprint is a candidate explanation, not a causal result.** Typed prompts included 17,072 declaration bytes in dev/held-out and 17,468 in later rounds. Generated programs, error recovery, other instructions and cache behavior also affect cost. Declarations are appended to the system prompt; repeated context processing is not necessarily repeated uncached billing. This describes the four original rounds; a subsequent matched development ablation is recorded below.
- **Executor choice is not the next priority.** Both support the same tested contracts. Local model-free timings favor Bun by tens of milliseconds on selected probes; paid runs contain model variability and do not show a stable end-to-end engine advantage. Keep QuickJS default and Bun opt-in; do not call the comparison universally settled.

## Failures and interpretive corrections

Across all stages there were 116/120 exact answers and 114/120 overall successes. These pooled counts are inventory, not an independent success-rate estimate.

Four exact mismatches used a leading `./`: dev QuickJS R-EXPORT-2 r1, held-out Bun R-EXPORT-4 r1, wave-2 stock R-EXPORT-5 r1 and Bun R-EXPORT-5 r0. One model on one date produced these; earlier wording about two models/two days was incorrect. The path convention was subsequently documented and echoed in prompts. Close-out had 30/30 exact answers, zero prefix mismatches, and 29/30 overall successes. Exact and normalized diagnostics agreed there. That is encouraging development feedback, not proof that future formatting failures are eliminated. The close-out reused held-out instances after inspection, so those instances are now regression material rather than untouched evaluation data.

The other two unsuccessful cells had correct final answers but were flagged by the evaluator-material argument audit (stock R-EXPORT-2 r1 in dev and close-out). `snoopedCanary` scans tool-call arguments for forbidden markers/traversal. It is a heuristic audit result, not general proof of reading files or absence of unobserved access. Broad enumeration and computed access can create false positives/negatives. The canary contained no answer. Retain the original policy verdicts and distinguish them from answer errors; do not rename the canary post hoc to improve scores.

All 120 cells report healthy harnesses and complete accounting. That validates recorded lifecycle/accounting fields, not independent billing or hardened evaluator isolation. Oracle values are controller-held, but candidate processes share host authority; runner/source/artifact discovery is still possible. These remain cooperative diagnostics, not leakage-resistant benchmark scores.

## Accounting and reproducibility limits

Recorded ledger totals versus account-global key-usage deltas: dev $0.05129/$0.0465; held-out $0.05779/$0.0455; wave-2 $0.03232/$0.0230; close-out $0.04660/$0.0282. They do not reconcile exactly and must not be presented as verified invoices. Timing, cache/rate accounting and account-wide activity need attribution before explaining the discrepancies. The controller deducts reported estimates per completed cell, reserving worst-case requests before admission and falling back to reservations when usage is missing. This relies on provider limits/prices, not an absolute billing guarantee.

Earlier flat-reservation/zero-price attempts remain excluded as invalid infrastructure runs. They do not become successful trials after later fixes. All current tasks are original seeded fixtures inspired by prior benchmarks; they are not copied RepoQA/Terminal-Bench tasks or official scores.

## Recommended trajectory

1. **004 development ablation delivered.** Attribution and a full-surface compact declaration presentation are implemented. Keep compact opt-in pending independent confirmation; do not repeat the completed development slice.
2. **Confirm usefulness on independent work.** Use a small session-informed or licensed repository task set with plausible distractors but objectively resolvable answers. Existing -3/-4 instances have been inspected and rerun; reserve genuinely new families/repos for confirmation. Add a second model after an affordable development signal, not a large engine×model×task campaign.
3. **Decide continue, narrow or stop.** A read-only hybrid remains plausible, but aggregation superiority is not yet demonstrated. If bounded tuning does not improve task-level economics, keep Strata as a learning/tooling project or a narrowly justified integration. Edits/checks can be a separately selected product-coverage experiment, not a remedy assumed to rescue these numbers.

Keep engines, memory, caps, a new sandbox and broad catalogs out of the next context-cost ablation. 032/013/033 can supply coverage evidence without new adapters. See [handoff](handoff.md), [evaluation](evaluation.md) and the [issue board](../.work/issues/index.md).

## Subsequent compact development trial (2026-09-06)

Issue [004](../.work/issues/004-harness-tuning.md), delivered at `4b8e39a`, records a separate 36-cell paired run: stock 11/12 successes, full QuickJS 12/12, compact QuickJS 12/12. Estimated costs were $0.0092/$0.0212/$0.0156 respectively; compact cost per success fell 28% against full, exceeding the predeclared 15% development retention bar. Tokens fell from 437,030 to 304,406. Ledger $0.0461 versus key delta $0.0385 remains an accounting discrepancy, not a verified invoice.

This result is additional development evidence, not part of the historical 120-cell export or independent confirmation. Compact remains opt-in; full declarations remain default. Fresh uninspected task families are the next confirmation step. The supervisor reconciled this delivery record on 2026-09-13; this update does not claim a fresh raw-artifact audit or new model run.
