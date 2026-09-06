# 028 — Discriminating repository workflows with trustworthy evaluation

Status: initial families selected by user 2026-09-06 (R-LOC, R-EXPORT, R-LOG); license inspection + runner fixes next, no paid runs
Kind: evaluator preflight → task contracts → required API gaps → bounded pilot
Source: user requested critical review and reusable benchmarks, including FrontierHarness.
Dependencies: existing 011 read slice, 012 policy, 027 engines; reuse 009 runner components and 026 metrics. This review authorizes documentation/research, not a new paid run. Existing explicit implementation/spend authorization still takes precedence within its scope.

## Decision and correction

Keep easy T1–T3 as diagnostics and add representative workflows, not tasks selected to make an arm fail. The recorded 27/27, $0.0117 trial is feasibility evidence reported by the prior agent; its raw cells were not regraded in this review. A success-rate ceiling limits accuracy discrimination but still permits cost, latency, repair and tool-use comparisons. More realistic work also tests coverage. Neither a failure nor a perfect repeat is a completion criterion.

Do not implement list/history automatically. Freeze caller scenarios and exact answer contracts first. T4 and T6 can start with existing read/search; commit-change inspection needs a history operation, not directory listing. Build list/find only for a selected discovery task that needs it. Prefer Bun built-ins; preserve mature Git semantics behind bounded adapters.

## 0. Repair the repository trial path before further comparative spending

Source review of `examples/repo-pilot.ts` found risks already addressed more carefully in 009-v2:

- Grading searches JSON blocks across all assistant messages; an earlier correct candidate can pass even after a wrong final answer. Exit code is recorded but does not gate pass; malformed event lines are silently discarded.
- The spending check happens between cells, after requests have already run. Missing usage becomes zero; accounting omits some possible usage categories. The displayed cap is not a pre-request budget guard.
- stdout/stderr are fully materialized, and the deadline kills the immediate child rather than using the existing bounded process-group wrapper.
- `expected.json` is placed beside the candidate repo. Stock shell/direct Bun can potentially read it; typed root checks do not create equivalent evaluator isolation. The runner and other benchmark artifacts may also expose answers. No evidence of actual cheating is asserted.
- Fixed arm order and identical task repeats provide little task diversity. Existing arm B means Bun here but single-operation typing in 009: letter reuse is ambiguous.

Required work:

- [ ] Adapt 009's request guard, bounded process wrapper and complete-trace grading to repository task definitions. Reuse tested responsibilities; do not transplant fixture-specific task/arm assumptions or create another independent budget implementation.
- [ ] Grade only the final completed assistant answer against an independent schema/oracle. Separate correctness, adherence, harness health and accounting. Timeout/nonzero/incomplete traces cannot be ordinary successful runs. Preserve missing usage as null and retain all failures/attempts.
- [ ] Keep expected answers, grader code, private test material and credentials out of the candidate-visible filesystem. Moving answers to a sibling directory is insufficient. Use an existing isolated workspace/container facility if needed, exposing only task inputs and required tools to the candidate. Keep oracle values in the controller, not candidate env/arguments. Add an evaluator-access canary test. If adequate isolation is unavailable, label runs cooperative diagnostics and do not claim leakage-resistant benchmark scores.
- [ ] Pin task/source hashes, actual repo snapshots, Git/tool/runtime versions, limits, prompts, model/provider/settings, declarations and external restrictions. Control Git identity/timestamps where fixtures use history. Validate CLI choices and budgets before creating cells.
- [ ] Regression-test earlier-right/final-wrong answers, extra/missing results, malformed traces, timeout after an answer, missing accounting and answer-file access. Old artifacts stay historical; do not silently upgrade their evidential status.

## 1. Freeze a small task corpus before API work

Use explicit task IDs/names independent of the old fixture suite. Initial recommendation: R-LOC (RepoQA adaptation), R-EXPORT (original), and R-LOG (Terminal-Bench adaptation). Propose two development instances per initial family plus two held-out instances per family (12 total across three initial families). License/artifact inspection precedes selecting borrowed instances; if unavailable, use an explicitly original task rather than copying by default. R-CALL, R-JOIN and R-HISTORY below are follow-up alternatives, not additional first-pilot requirements. Hold out repository/layout and reasoning structure, not just symbol names. Keep prompts neutral about tool sequence. Independently derive and manually review reference answers; never use the candidate adapter as its own oracle.

| Family | Precise task and oracle | Capability requirements |
| --- | --- | --- |
| R-LOC: description → function (initial; adapted RepoQA) | Select a supported-language upstream description and pinned repository snapshot. Ask for the matching function’s relative path and qualified name, with the definition line only if fixed by the snapshot. Keep multiple plausible functions so navigation and comprehension matter. Independently map the upstream target to the source; reject ambiguous descriptions. Tool-driven context retrieval and location output differ from upstream SNF. | Existing read/search; inspect source size/coverage before selection. |
| R-LOG: dated log aggregation (initial; adapted Terminal-Bench) | Adapt `log-summary-date-ranges`: explicit reference date, inclusive period rules and severity counts. Preserve realistic files and decoys. Return a frozen JSON schema instead of CSV for this read-only slice; this changes upstream protocol. Derive expected counts independently and verify date-boundary cases. | Likely list/find plus bounded reads; inspect fixture layout before adding it. |
| R-CALL: disambiguate call sites (follow-up) | Given a definition path and export name, report sorted `{path,line}` direct calls to that binding in a declared TS source scope. Seed named-import aliases, unrelated same-name functions, comments/strings, multiline calls and test-file decoys. Exclude dynamic property calls, higher-order flow and unresolved imports explicitly. Independent TS symbol/AST analysis plus reviewed expected locations; line means start of call expression. This is bounded static call-site identification, not “all runtime callers.” | Existing search/read first; check complete search and readable file sizes. |
| R-EXPORT: trace public exports (initial; original) | Given package and explicit target condition (e.g. import/default), follow a finite acyclic chain of supported package exports and TS re-exports. Return sorted public-name → defining-path/symbol mapping, distinguishing type-only exports under a stated rule. Seed aliases and unrelated entry files. Restrict supported syntax in fixture contract; no implicit full Node resolution claim. Oracle built independently from fixture specification and checked against source. | Existing read/search; list is not inherently required. |
| R-JOIN: join configuration and source (follow-up) | Find all declared workspace packages satisfying an explicit dependency/script condition, then locate specified implementation/config evidence within them. Return exact sorted package/path/value records and totals. Include near-matches, absent optional fields and multiple layouts. Seed scope and bounds so the answer is knowable; use manifest fixtures as independent truth. | Existing read/search if workspace manifests enumerate packages; list/find only if discovery is deliberately part of the task. |
| R-HISTORY: reconstruct commit changes (second slice) | For a frozen HEAD and N non-merge commits, return per-commit change records with status and old/new paths. State ordering and rename policy. Start with linear histories and unambiguous exact-content renames; pin Git detection settings. Do not combine net tree changes with per-commit changes. Oracle is authored commit operations and independent fixture verification. | Add bounded history-with-changes; current gitStatus is insufficient. No directory listing required. |

Difficulty knobs: distractor similarity, candidate count, dependency depth, cross-file joins and realistic result volume. Avoid arbitrary puzzles and simply exceeding fixed caps. Keep first instances within existing byte/search limits; if a completeness/pagination gap blocks the task, record an API-coverage issue and resolve it before comparing model reasoning. Large-result narrowing/recovery can be a separately defined task.

A symptom-to-fault-location task may replace one initial family after review. Keep root-cause explanations out of exact-string grading; use objective location/evidence fields or functional verification for later patch tasks.

## 2. Implement only the operations required by frozen tasks

- [ ] Prove each task can be completed through supported APIs with small human-written reference compositions; do not expose those solutions to candidate agents. Keep old operations available. APIs may support generic useful composition, not hardcoded benchmark-answer functions.
- [ ] If list/find is needed, define deterministic ordering, depth, hidden/ignored files, symlinks, scope and completeness; evaluate Bun.Glob first. Bounded traversal plus sorting a truncated sample is not necessarily a deterministic global prefix.
- [x] If history is selected, define fields, byte/commit/path caps, fixed argv, empty/root commit handling, cancellation and Git config/helper controls. Author identity is unnecessary unless the task requires it. Delivered 2026-09-06 beyond the initial slice: `gitLog(withFiles)` per-commit records (status + rename oldPath, pinned `-M50%`, root via `--root`, merges report none), `gitDiff` (staged/unstaged, bounded, line-cut), `gitShow` (HEAD/SHA allowlist, readText content rules). Reference workflows W2 (status→diff) and W3 (log→show) pass byte-identical on both engines. R-HISTORY task work itself remains follow-up.
- [ ] Test relevant semantics against actual filesystem/Git fixtures. Policy resolution can itself inspect filesystem metadata: require denial before protected content access or mutation, not the impossible blanket “before any effect.” Validate supported outcomes and category-preserving errors.

## 3. Pilot and decision

Use descriptive profile fields: `stock-pi`, `typed-quickjs`, `typed-bun`; record engine, enabled Pi tools and containment separately. Same typed API/checker/broker/backend in both typed arms. Stock Pi retains normal scripts/pipelines and installed tools. Bun API-only behavior is cooperative unless independently enforced; its wrapper logs cannot prove absence of ambient access. Do not call an engine comparison a typechecking ablation.

- [ ] Run offline grader/fixture preflight first. One run per arm is a wiring smoke. Two repeats are acceptable for exploratory diagnostics, not stable rankings or general success-rate claims. Prefer task diversity before many copies of identical easy tasks.
- [ ] Proposed initial matrix: 6 development instances × 3 profiles × 2 repeats = 36 cells. Counterbalance profile order within task/seed blocks, fresh independent sessions, fixed settings, no hidden retries. Freeze development revisions before spending on the 6 held-out instances. Select more repeats/second model only when uncertainty warrants them.
- [ ] Treat $2.50 as an unapproved planning ceiling, not a price estimate or inherited authorization. Dry-run the actual model pricing, reservations and per-cell limits; use existing explicit remaining authorization if applicable. Reduce planned cells or request a concrete revised cap if it does not fit. Never raise limits silently.
- [ ] Report success, total cost per success (including failures), median/tail elapsed time, calls, compiler/runtime/adapter time, declarations/source/result tokens, repairs and coverage failures. Missing data remain unknown. Report paired descriptive deltas and task-level uncertainty when supported; two repetitions are not two independent task families.
- [ ] Preserve all outcomes. Easy deterministic checks must remain correct; an easy model miss is investigated and retained, not rerun until 100% and not automatically an implementation regression.

Acceptance: versioned representative tasks with independent oracles and a trustworthy runner; each arm has equivalent task information and documented enforcement differences; sanitized reproducibility report supports continue/narrow/pivot/inconclusive. No requirement that any arm fails or that Strata wins. If all succeed, report efficiency differences and uncertainty. Any later harder set is a new development version, not post-hoc editing of held-out tasks.

## Existing benchmark reuse

See [benchmark research](../../docs/research/repository-benchmarks.md). Prefer borrowing task packaging, isolation, verifier lifecycle and reporting practices before integrating a whole harness. Review exact task/fixture licenses, pin revisions, retain attribution and dependencies before copying. Public availability alone is not permission to redistribute all datasets/images. Modified prompts, task subsets or graders must be labeled adapted workloads, not official benchmark scores.

FrontierHarness is a useful harness-evaluation reference, but its inspected public repository has no license declaration: do not copy its scripts/prompts without verifying permission. Use the separately licensed upstream task material where suitable. RepoQA is a closer read-oriented task source; Terminal-Bench’s `log-summary-date-ranges` is a concrete composition candidate. Broader terminal/patch suites are later coverage tests when Strata supports their actual actions. Keep this first implementation bounded; no new benchmark framework is required.
