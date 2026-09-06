# Reusing repository benchmarks

Research date: 2026-09-06. Scope: issue 028, harder read-only repository tasks for comparing stock Pi with typed capabilities on Bun and QuickJS. These are selection recommendations, not benchmark results. No external task or runner has been imported or executed.

## Recommendation

Keep a small diagnostic suite, add independently sourced task material, and reuse evaluation conventions before adopting another execution framework. Select tasks before seeing comparative results. A task does not need to make an arm fail to be useful: equal correctness at different cost is evidence too. Strong shell baselines must remain free to compose commands and write scripts.

For the next slice, investigate one RepoQA-derived function-location task and one Terminal-Bench-derived log-aggregation task alongside the original repository tasks. They test different behavior: exploratory code understanding versus predictable data composition. This is our recommendation, not a claim that either dataset measures Strata's full hypothesis.

## FrontierHarness: relevant methodology, qualified reuse

The announcement compares 12 configurations on 30 tasks: 21 from Terminal-Bench and nine from DeepSWE. It uses deterministic verifiers and fresh checkpoint restores, and discusses costs of failures as well as successes. There is one canonical result per task/configuration; this is not repeated evidence of variance. Its own caveat attributes results to the complete harness/model/provider setup. Treat the rankings as motivation to measure, not evidence that a particular interface wins. [Announcement](https://runta.com/blog/introducing-frontierharness-eval/), [benchmark manifest](https://github.com/frontier-harness-eval/eval/blob/main/benchmark.json).

The public repository includes instructions, task metadata, aggregate results and provisioning/scoring/report scripts. Its documented workflow uses Runta plus Harbor/Pier; it is not a self-contained local suite of read-only repository questions. Private evidence and internal infrastructure are omitted, and first-turn normalized cost fields require nonpublic inputs. [Repository README](https://github.com/frontier-harness-eval/eval#readme).

At inspected revision `8f11b130c30bbf76ca1f3edeea70abc773bd8d2c`, the recursive tree contains no license file and `package.json` declares no license. Reuse permission for its code and prompts remains unverified; do not vendor them on the assumption that public visibility grants it. Prefer separately licensed upstream material or ask the authors. [Inspected tree](https://github.com/frontier-harness-eval/eval/tree/8f11b130c30bbf76ca1f3edeea70abc773bd8d2c), [package metadata](https://github.com/frontier-harness-eval/eval/blob/8f11b130c30bbf76ca1f3edeea70abc773bd8d2c/package.json).

Useful methodological choices for Strata: preserve per-task records, include failed-run expenditure, distinguish infrastructure failures, use a separate smoke set, freeze versions/resources, and document cache treatment. Fresh filesystem processes do not guarantee cold provider caches. Do not compare our local results directly with their leaderboard after changing model, task subset, tools, environment or scoring.

## Candidate sources

| Source | What exists | Best use for Strata | Limit |
| --- | --- | --- | --- |
| RepoQA | Search Needle Function: 500 cases across five languages and 50 repositories; description-based function retrieval with syntax-based grading | Adapt selected descriptions and pinned repository contexts into tool-driven navigation tasks | Original evaluation supplies long code context. Letting an agent navigate files changes the protocol; exact symbol/location grading would also be a change. |
| Terminal-Bench 2 / Harbor | Task repositories and a task format separating instructions, environments, reference solutions and verifiers | Reuse a small suitable task or its data-processing structure; use the packaging conventions for later interoperability | Many tasks need builds, edits or broader terminal access. Importing the whole suite now would mainly measure missing capability coverage. |
| SWE-bench | Real GitHub issue repair with patch grading in Docker | Later edit/check evaluation; possible source of repository snapshots and diagnostic questions | Read-only localization questions derived from patches are new tasks, not SWE-bench scores. Changed files alone do not establish all valid semantic answers. |

Sources: [RepoQA task and grader documentation](https://github.com/evalplus/repoqa#-search-needle-function-snf), [Terminal-Bench 2 task repository](https://github.com/harbor-framework/terminal-bench-2), [Harbor task structure](https://www.harborframework.com/docs/tasks), [SWE-bench overview and evaluation](https://github.com/SWE-bench/SWE-bench#-overview).

RepoQA declares Apache-2.0, Terminal-Bench 2 and Harbor have Apache-2.0 license files, and the SWE-bench runner declares MIT. These declarations are not a blanket license for every embedded repository, dataset, image or third-party asset. Record the applicable notices for the actual selected material before copying. [RepoQA license](https://github.com/evalplus/repoqa/blob/main/LICENSE), [Terminal-Bench license](https://github.com/harbor-framework/terminal-bench-2/blob/main/LICENSE), [Harbor license](https://github.com/harbor-framework/harbor/blob/main/LICENSE), [SWE-bench license](https://github.com/SWE-bench/SWE-bench/blob/main/LICENSE).

### Concrete first candidate: log aggregation

Terminal-Bench's `log-summary-date-ranges` asks for severity counts from date-named logs over several periods using an explicit reference date, written as CSV. This is useful for testing discovery, bounded reads and aggregation without requiring semantic code analysis. Returning equivalent JSON instead of writing a CSV would make ours an adapted task. [Upstream instruction](https://github.com/harbor-framework/terminal-bench-2/blob/main/log-summary-date-ranges/instruction.md).

Pin the task revision, data/image digest, reference date and verifier. Inspect the data and grader before selection. Do not silently mix source variants: the inspected FrontierHarness metadata disables internet while upstream metadata permits it. [FrontierHarness task metadata](https://github.com/frontier-harness-eval/eval/blob/8f11b130c30bbf76ca1f3edeea70abc773bd8d2c/tasks/log-summary-date-ranges/task.toml), [upstream metadata](https://github.com/harbor-framework/terminal-bench-2/blob/main/log-summary-date-ranges/task.toml).

## Reuse contract for issue 028

For each selected task, record upstream URL/revision/task ID, applicable license and attribution, setup checksum, required capabilities, prompt, grading contract and every adaptation. Identify it as **original**, **adapted**, or **unchanged upstream task**. A subset is not a full benchmark score; protocol changes must remain visible even when the task name is retained.

Keep expected answers, reference solutions and private verifier inputs inaccessible to every agent arm, including direct Bun and stock shell. A sibling directory or an instruction not to read it is insufficient isolation. Validate oracle answers independently of the implementation being compared; test that plausible partial, stale and malformed answers fail. Separate development tasks from frozen measurement tasks and report exclusions before runs. Public benchmark familiarity remains a limitation even when no answer files leak.

Report correctness, complete-run validity, API adherence and accounting separately. Include all attempt costs, timeouts and failures; do not replace missing usage with zero. Use paired tasks, balanced run order and repeated independent sessions within an explicit budget. Report absolute values and uncertainty; a small pilot establishes wiring and hypotheses, not general superiority. Full FrontierHarness/Harbor integration and SWE-bench repair evaluation remain later options, not prerequisites for this bounded experiment.
