# 009 — Baseline hardening: variance, warm sessions, wider tasks

Status: fixture hardening and initial repo-2 trials delivered; independent confirmation remains open
Kind: benchmark follow-up to [001](001-benchmark.md)
Source: baseline analysis 2026-09-05 (assistant)
Dependencies: [001](001-benchmark.md) baseline (done); T3 rewording pairs with [004](004-harness-tuning.md).

## Current decision

028 delivered repository runner integration and four trial stages; [reviewed evidence](../../docs/repo-trials.md) separates exact answers, audit failures and accounting. Current priority is 004 context-cost attribution, then independent confirmation with new task material. The stages/checklists below preserve the original plan, not instructions to rebuild delivered work. No hardened evaluator isolation or paid fixture-v2 campaign is implied by the repo-2 results.

## Confirmed observations (baseline `baseline-2026-09-05T08-37-15Z`, n=1/cell)

- Single attempt per cell: no variance data; T3:A passed in the voided run and failed in the kept run on a wording ambiguity, showing single samples are fragile.
- All runs are cold OS processes; session-reuse (warm compiler, cached declarations) is unmeasured.
- No denied-effect task: the twin has only allowed ops, so policy-denial comparison is MCP-unit-test-only.
- No untyped-narrowing comparison task (twin is fully typed by design).

## Code-inspection corrections (current priority)

The historical v1 runner used substring/regex answer checks; T2 can accept extra wrong IDs and T4 grades error text without checking the final answer or successful recovery. A timeout could produce `pass: true`; Slice A repairs that. B/C tool restrictions remain prompt instructions plus post-hoc detection; they are not enforced tool profiles. Condition D exists only as a separate demo, not in the runner. Repeats alone do not repair these problems.

Historical artifact audit 2026-09-06 (`benchmark/audit.ts` over retained v1 baselines: 50 files, 129 tool calls): 3 files flagged, all one cell (`cell-T2:C`) where the model ran `ls -la ..`, `cat ../twin.json`, `cat ../../../../twin.json` and absolute-path reads of the benchmark dir — harness snooping, not oracle theft (`twin.json` holds transport config, not answers). The v1 grader already failed the cell (forbidden tools `bash`/`read` in a typed-only arm), so the verdict stands; the new auditor would additionally have flagged evaluator-area access as its own violation class. Retained as a worked example of why tool-adherence and evaluator-access are separate verdicts.

The old suggestion of a denied `purge` CLI returning nonzero is not equivalent authorization enforcement. Both arms need the same underlying effect policy and independent counters, or the result must be labeled an enforcement-mode comparison. Warm repeats of the same task also mix caching with answer reuse.

## Execution plan

Authoritative protocol proposal: [docs/evaluation.md](../../docs/evaluation.md). Preserve original 001/v1 artifacts unchanged.

### Slice A: deterministic runner repair — delivered

- [x] Extract task/oracle/runner/report responsibilities just enough to test grading without model calls; no benchmark framework rewrite.
- [x] Parse exact final JSON with schema/value assertions and independent expected answers. T3 v2 uses `totalRecords`, `matchCount`, `selectedIds`; never relabel old failures as passes.
- [x] Separate correctness, policy adherence and harness health. Timeouts/incomplete runs cannot be ordinary successes; preserve partial correctness separately.
- [x] Regression fixtures for wrong extra IDs, text-only matches, malformed JSON, timeouts, nonzero exits, missing usage, forbidden tools and backend startup failures.
- [x] Version prompts/config/task snapshots and artifact schema. Preserve every model attempt/failure/cost, separate fallbacks, cap retries.
- [x] Add independent cold repeats, rotating condition order and an offline dry-run matrix with pre-request token/cost reservations, request/output caps and actual process deadlines. Live mode validates the current model/price snapshot. Warm sessions remain explicitly deferred.

Delivered code: `examples/benchmark.ts` plus `examples/benchmark/{protocol,config,guard,process}.ts`; usage and artifact contracts in [docs/benchmark.md](../../docs/benchmark.md). Fixed model, no automatic retries/fallbacks. Raw attempts and exact request reservations persist; missing usage is null, not zero. Pi/provider retries are disabled. Timed-out/invalid executions cannot be completed successes. Output-directory reuse is rejected.

Verification: typecheck and full 53-test suite pass, including real Pi against a local fake provider; additional typed recovery case confirms actual compile rejection then successful execution. No paid run. Three initial support files were included in concurrent commit 316cb28; 1513917 completes/integrates the repair without rewriting shared history. Budget reservations are deliberately conservative and assume provider limits/pricing compliance; they are not billing reconciliation or a shell security boundary.

Historical next step was [020](020-next-sequence.md); that sequence and initial Slice B trials are now delivered. Do not rerun the full synthetic matrix merely to postpone testing useful repository behavior. Small seeded repetitions are still needed before interpreting success rates.

### Slice B: useful native tasks and strict profiles

Current follow-through: [028](028-harder-repository-tasks.md) owns the next task corpus and adaptation of this runner to repository trials. Its source review found that the separate `repo-pilot.ts` bypasses several delivered safeguards (final-only/complete-run grading, pre-request reservations, bounded process handling and evaluator isolation). Repair those before further comparative spending. Keep descriptive profile/engine fields: pilot B means Bun, while fixture B means single-operation typing. Do not copy that ambiguity into a shared protocol.

- [ ] Consume 011's seeded orientation/search/Git tasks; final oracles don't reuse adapter algorithms.
- [ ] Enforce B/C active tools; instrument B's one-operation constraint. Allow A normal shell pipelines/scripts. Add hybrid separately.
- [ ] Add denied/missing/invalid-output/recovery and cancellation cases with equivalent authority and independent effect counters. Keep unknown-output narrowing honest; don't add artificial untyped outputs merely to fill a matrix.
- [ ] Predeclare dev/held-out task families and run the bounded pilot specified in the evaluation plan after deterministic preflight.
- [ ] Report all-context tokens/cache/cost, wall/setup/compile time, retries, calls and actual shell/process/native activity; unavailable metrics remain null.
- [ ] Publish sanitized reproducibility artifacts and descriptive uncertainty; private raw traces stay local. Decide confirmatory sample size before held-out multi-model trials.

### Slice C: decision

Apply frozen success margin and practical cost/latency threshold from the evaluation plan. Allow bounded 004 tuning, then continue/narrow/pivot/stop. Prime comparison is 014, discovery D conditional. Do not grow the adapter catalog to avoid an unfavorable result.

## Evidence-quality follow-ups (before stronger claims)

- [ ] Reconcile estimated cost with available provider/account usage, recording timing/cache/rate caveats. Account-global deltas are not per-cell invoices; do not overwrite historical estimates.
- [ ] Review audit-flag evidence and define false-positive/negative handling for future protocols; a tool-argument match is not proof of file I/O. Preserve old policy verdicts alongside exact correctness.
- [ ] Add precise model-response/request versus Pi-call counts to summaries. Same-surface declaration ablation belongs to 004; old held-out task instances are now regression material.
- [ ] Reproducibility manifest improvement: record actual selected task instances, fixture hashes and all backend versions. A source commit plus a whole-corpus definition list is useful provenance but not a complete environment snapshot.

## Dependencies and open decisions

Slice A needs only the completed 001 runner. Slice B needs 011, 012 read policy and 016 cancellation. Session study 013 is optional input. Choose actual dollar cap/model at execution time; no paid trials performed or started by this planning pass. Three repeats are a feasibility sample, not a significance guarantee.

## Completion criteria

A versioned v2 runner passes deterministic grader/preflight tests; native task report is reproducible with equal-access conditions, honest failures and uncertainty; old v1 remains intact; all findings lead to explicit retain/revise/pivot decisions. Remaining expensive conditions stay separate rather than silently expanding the run.
