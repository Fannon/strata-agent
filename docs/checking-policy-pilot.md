# Checking-policy pilot on updated Pi

Date: 2026-09-30. Development pilot 049-v2, using installed **Pi 0.99.1**, Bun 1.4.0-canary.1, OpenRouter **meta/muse-spark-1.3-contributor**, medium thinking. All writes were simulated. The repository's Pi dependency remains pinned to 0.73.1; the pilot explicitly invoked the newer global CLI.

Interpretation expanded 2026-10-01 from the same frozen results and traces. No additional model runs or production changes accompanied this documentation review.

Subsequent October 1 selection: the [GLM 5.3 Flash repeat](glm-checking-policy-repeat.md) ran this matrix with low reasoning, preserved all original sources/artifacts and achieved 26/36 strict successes. It exposed answer-format, missing-return and payment-recovery mistakes; these later observations do not replace the Muse Spark results below. Production checking before execution remains the agreed policy.

The [combined efficiency comparison](checking-policy-comparison.md) now lists requests, tokens, wall time, cost per attempt and cost per strict success for every profile and task family, with input/output/cache/reasoning breakdowns and sanitized per-cell data. In this natural Muse Spark sample, checked Strata matched native Pi's 6/6 success with approximately 30% fewer reported tokens, 14% lower estimated model cost and 34% lower median wall time. This is an encouraging whole-system development observation over two task definitions, not an isolated benefit of the checker; GLM did not repeat it.

## Finding

**The pilot found no completion benefit from always running semantic checks on the natural tasks.** All four profiles completed 6/6 natural attempts. Always-check rejected no model-generated programs. Never-check recovered both seeded error families without compiler diagnostics. This supports testing simpler execution for short scripts, but the sample is too small to establish that checking is generally unnecessary.

Early checking still demonstrated two useful behaviors: it prevented an earlier simulated write when later code contained a detectable type error, and it caught a field typo that otherwise returned a plausible but wrong empty result. Checking after failure supplied diagnostics for the thrown error but did not diagnose the successful-looking wrong result. Runtime validation, permissions and syntax/import restrictions stayed active in every profile.

## What we learned from the run

### Declarations and checking can have separate roles

The model composed the natural workflows with declarations available and no semantic feedback needed. That makes declarations with optional checking a credible design to investigate. It does **not** establish how much the declarations helped: every Strata policy received them, and there was no otherwise matched arm without them. TypeScript can describe an API usefully even when the harness executes without asking its compiler to approve the program.

The observed checker contribution was prevention of supplied mistakes. Whether that prevention pays off in ordinary use depends on how often detectable mistakes occur, how costly their effects are, and whether compiler feedback creates extra repair work. This pilot demonstrated the prevention mechanism but did not estimate those frequencies on realistic workloads. Six successful natural attempts per profile leave substantial uncertainty; the 36 total cells cover different tasks and profiles, rather than 36 independent tests of one policy.

### Failure timing changes what feedback can accomplish

The following distinctions were visible in the controls and repair trials:

| Mistake or failure | Early semantic checking | Runtime validation / execution | Checking after failure |
| --- | --- | --- | --- |
| Misspelled argument `county` | Rejects before calls | Input validation rejects before backend invocation | Adds a useful field diagnostic after rejection |
| Wrong result field after a payment | Rejects the whole program before payment | Throws after payment has completed | Explains the typo, but the payment remains |
| Filter using `totlaCents` | Rejects before calls | Returns a wrong empty list successfully | Does not activate |
| Type error in an untaken branch | Rejects the program | Returns the intended result for this execution | Does not activate |
| Type-correct wrong business rule | Accepts | Can return a wrong answer | Does not activate if execution succeeds |
| Backend response violates its schema | Cannot predict the actual response | Output validation rejects the response | Can run but supplies no useful semantic diagnostic here |

An exception is only one way a task can go wrong. For example, `undefined > 100000` is false, so a misspelled property inside a filter can discard every record without throwing. A schema-valid empty result does not reveal whether the filter was correct. Independent checks of task outcomes remain necessary for claims of correctness, even with early semantic checking.

### Recovery may mean inspecting state rather than rerunning code

In all four unchecked partial-effect attempts (never and after-failure), the seed had already made the requested new payment. The model's recovery called `listPayments`, confirmed that state, and finished without another payment. It did not need to repair and rerun the original customer-list code to satisfy the task. This is a narrower and more informative observation than saying that compiler-free script repair always worked.

That recovery was supported by an explicit instruction to inspect state and avoid duplicates, visible call feedback, and a readable synthetic payment ledger. It does not establish automatic replay safety for an opaque service. Checking after failure should supply diagnostics for the original attempt; deciding whether to retry also requires knowing what happened. The harness therefore never replayed automatically. Early checking prevented this particular partial effect, but type-correct code can still perform a write and fail later for another reason.

### Disabling checking does not address declaration overhead

The earlier application comparison's measured cost problem was expensive model requests with declarations included. The checking policies here kept exactly the same declarations, so disabling the compiler did not remove those prompt tokens. The observed source-preparation difference (about 150 versus 64 ms/program) was small next to model round trips, and includes more than semantic analysis alone. A simpler implementation may still be attractive, but this run did not measure maintenance savings or demonstrate a meaningful model-cost reduction from dropping checks.

### Native Pi narrows the question Strata needs to answer

Native Pi Codemode completed the same six small natural attempts. Code composition without Strata's semantic gate is therefore a working alternative on this fixture. Composition feasibility alone is insufficient evidence that Strata earns its additional machinery. Any value claim needs to identify a useful benefit of its contracts, broker, diagnostics or workflow handling and measure that benefit against a capable alternative. The native arm differed in several interfaces and is not a compiler-only comparison or a full external-MCP evaluation.

### Reuse is feasible; its payoff is still open

Both checked and unchecked stored workflows handled the five changed worlds. Repeated execution can avoid asking a model to author the same workflow again, but ordinary stored scripts can do that too. The probe did not measure authoring, retrieval, adaptation or contract drift. It supplies feasibility evidence for issue 047 without demonstrating an advantage from types or selecting a memory implementation.

## Baseline and design

The user requested a baseline after updating Pi, then experiments on checking and checking only after failure, with up to €5 for this batch. The installed global CLI was verified as 0.99.1. Its Codemode tool supplies TypeScript declarations and executes JavaScript in QuickJS. Inspection of the installed worker's `vm.evalCode()` path found no pre-execution TypeScript semantic gate in that path; this is a version-specific implementation observation. The native baseline used custom structured tools, not a live external MCP server.

The first 12 paid runs were six native-Codemode and six always-check attempts. After all passed, the remaining checking-policy cells ran. The complete frozen matrix comprised:

- **24 natural attempts:** invoice aggregation and payment reconciliation, three fresh repetitions per task, four profiles.
- **12 seeded repair attempts:** a result-use mistake after an additive simulated payment, and a misspelled field yielding an empty result; two fresh repetitions per task under each Strata policy.

For the isolated policy comparison, the model received identical TypeScript declarations and tool instructions. The same broker, schemas, grants, fixture and QuickJS executor applied. Always-check added the semantic gate; never-check transpiled and executed; after-failure checked the original source after an eligible execution failure and returned diagnostics without replaying it. The common syntax/import gate remained proactive in all arms. No production session setting was changed.

The native comparison uses a different tool surface, declaration rendering, program format and runtime integration. It compares configured systems, not typing alone. All profiles were limited to their experiment tools; this is not a comparison against unrestricted stock Pi with shell and filesystem workflows. Large-catalog discovery, external authentication, live service integration and long sessions were excluded.

Correctness required exact final JSON, correct final simulated payment state, healthy process completion and complete usage. Duplicate or unwanted payments failed independently of the answer. Expected answers were controller-held and never supplied to Pi. Each attempt used a fresh world and session. The controller launched all cells sequentially; baseline-first ordering and varying provider/cache behavior limit causal cost and latency comparisons.

## Natural-task results

| Profile | Strict successes | Model requests, total | Estimated model cost, total | Median wall time |
| --- | --- | --- | --- | --- |
| Native Pi Codemode | 6/6 | 13 | $0.004408 | 17.72 s |
| Always check | 6/6 | 13 | $0.003807 | 11.66 s |
| Never check | 6/6 | 13 | $0.003702 | 11.34 s |
| Check after failure | 6/6 | 15 | $0.004436 | 17.46 s |

The three Strata profiles executed 7, 7 and 9 model-authored programs respectively. None received a semantic diagnostic on these natural tasks. After-failure had one **syntax** error, caught by the shared source parser before execution; the model repaired it. There were no model-authored execution failures after source preparation in those profiles. The two extra requests and higher cost in after-failure do not show that deferred diagnostics caused overhead: the semantic checker never ran for that syntax failure.

Always-check versus never-check differed by approximately 2.8% in total model cost, with the same request count. These small values and samples do not establish an economic advantage. Never and after-failure would execute the same way on valid first-attempt programs; differences between their natural runs mainly reflect generated programs, request choices, caches and provider timing.

Source preparation/checking totaled 1050 ms over seven always-check programs and 446 ms over seven never-check programs, approximately 150 versus 64 ms/program. These are cold-per-cell measurements, and always-check includes the common transpiler plus the existing checking/emission pipeline. They are not isolated semantic-check timings. The observed source-processing difference was small relative to model round trips.

## Seeded recovery

| Seeded task | Policy | Final successes | Model requests, total | Writes completed before recovery, total |
| --- | --- | --- | --- | --- |
| Error after simulated payment | Always | 2/2 | 5 | 0 |
| Error after simulated payment | Never | 2/2 | 4 | 2 |
| Error after simulated payment | After failure | 2/2 | 4 | 2 |
| Silent wrong result | Always | 2/2 | 4 | 0 |
| Silent wrong result | Never | 2/2 | 4 | 0 |
| Silent wrong result | After failure | 2/2 | 4 | 0 |

Always-check rejected both erroneous seeds before any capability invocation. In the partial-effect case, never and after-failure each completed one payment per attempt before failing; after-failure then produced useful field diagnostics. All policies ultimately left exactly one intended new payment per attempt, with no duplicates. Never-check recovered using the runtime error, source, declarations and observed payment state alone.

In the silent-result case, always-check rejected the misspelled field. Never and after-failure returned an incorrect empty list without an execution failure, so delayed checking did not activate. The model repaired it when explicitly asked to verify the prior attempt. That explicit recovery prompt matters: these final successes do not show that an unattended agent would detect a successful-looking wrong answer.

Seeds were controller-authored and executed once before the first model request; their source, observed result/error and task were shown for recovery. Seed calls, effects and processing were included in the execution records, but there was no model authoring charge for seeds. These tasks measure recovery from supplied mistakes, not natural model error frequency.

## Model-free controls and reuse

Twenty-one deterministic controls (seven cases × three policies) produced their expected behaviors. These included valid programs, invalid arguments, partial effects, silent wrong outputs, errors in an untaken branch, type-correct wrong business logic and invalid backend responses. All policies retained runtime input/output validation. Early checking also rejected a type-invalid dead branch in an otherwise working script; an always-on gate can therefore demand repairs to code that would not execute.

Ten stored-workflow replays passed across five reordered or numerically changed worlds for checked and unchecked versions of the same manually authored workflow. This establishes reuse feasibility for both paths. It does not measure retrieval, real recurrence, model authoring, adaptation, native Pi session storage or amortized economic benefit. Issue 047 remains open beyond this feasibility probe.

## Cost, verification and provenance

- The 36 model cells cost **$0.024197942 estimated from recorded Pi token usage and catalog rates**, approximately €0.021 at the recorded reference rate. This is not a reconciled provider bill. No other model or classifier calls were made.
- A first startup attempt in 049-v1 failed with HTTP 401 and zero reported token cost because the isolated profile used the old environment-reference syntax. Pi 0.99.1 requires `$OPENROUTER_API_KEY` interpolation. Its artifacts were preserved; the corrected profile and runner were frozen as 049-v2 before any successful model cell. The 36-cell results exclude that infrastructure attempt.
- `bun run check` passed. Focused checking-policy, production QuickJS-runtime and entry-point parity verification: **30 pass / 0 fail / 165 assertions**. The new checking-policy tests alone passed 4/4 with 49 assertions.
- The environment baseline before new tests was **168 pass / 28 fail**, 196 tests / 1367 assertions. Most failures concerned direct-Bun temporary imports, plus BFCL setup and benchmark HTTP integration. See [050](../.work/issues/050-macos-bun-baseline.md). The full suite was not rerun after adding the experiment; the focused green result is not a green full suite.
- Local artifacts: `.work/checking-20260930-v2/` contains the frozen matrix, source hashes, installed-Pi fingerprints, public pricing/profile configuration, cell events, state, grading, usage, mechanism probe and aggregate summary. The initial failed attempt is under `.work/checking-20260930/`. Raw transcripts, generated fixtures and credentials are not committed. Authentication was passed through the subprocess environment, not command arguments or tracked files.

The frozen limits were eight model requests and 4096 output tokens per request, 180 seconds per cell, and a $4.50 batch stop with a conservative next-cell reservation. All 36 cells finished with healthy processes and complete recorded usage, far below the user cap. Synthetic expected-state checks establish task effects for these fixtures; they are not a hardened sandbox or enterprise authorization audit.

## Decision

Complete this bounded pilot without changing the production default. The evidence supports **optional semantic checking as a plausible simplification for short, low-impact workflows**, with declarations and runtime validation retained. It does not demonstrate a general cost or completion advantage, and the comparison did not isolate the benefit of supplying TypeScript descriptions themselves.

Check-after-failure is useful as a diagnostic option but has two practical limits: it cannot prevent earlier effects, and it never activates for wrong results that look successful. Early checking earns a concrete role where avoiding partial work matters, although checking is not a transaction or proof of business correctness. Whether that prevention outweighs unnecessary diagnostics and repair costs needs a real task family that encounters those problems.

No further experiment is selected. The existing application comparison remains a negative/inconclusive result for its own tasks; this simpler synthetic pilot does not overturn it. See [049](../.work/issues/049-checking-policy-pilot.md), [021](../.work/issues/021-code-mode-checking.md), [047](../.work/issues/047-stored-program-reuse.md) and [048](../.work/issues/048-modern-pi-codemode-baseline.md).
