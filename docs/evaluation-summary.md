# Strata evaluation summary

**October 1 broader evidence (2026-10-01):** [054 report](composition-benchmark.md) covers 20 distinct workflows and 240 paired native Pi/checked Strata attempts, plus 16 development attempts. Muse has a measured model-cost advantage; GLM requires more repairs and time. Full requests/tokens/time/cost, effects, output compliance and uncertainty are published. This uses the actual production checked session without changing defaults; earlier measurements below remain dated evidence.

**Later tuning (2026-10-01):** [060 report](strata-tuning-results.md) documents four isolated development hypotheses and fresh confirmation of a short programming recipe. Retain the recipe experimentally; generic helper and alias-only declaration prototypes did not earn promotion, and the smaller-feedback branch was never exercised. Full sample/success/effect/request/token/time/cost comparisons and uncertainty are in the report. Production defaults remain unchanged; no additional run is selected.

*For software developers and architects. No prior knowledge of the internal benchmarks assumed. Historical checkpoint reviewed 2026-09-22; checking-policy interpretation updated 2026-10-01.*

**Recommendation: pause at this research checkpoint.** The mechanism works, but measured task outcomes do not justify further general framework development. No next experiment is selected. See the [wrap-up review](wrap-up.md) for verification and restart criteria.

**Later bounded pilot, 2026-09-30:** [049](checking-policy-pilot.md) tested installed Pi 0.99.1 native Codemode and three semantic-checking policies on separate small synthetic tasks. All 36 attempts passed; always-check caught no semantic mistakes in naturally generated programs, while seeded controls showed prevention of partial effects and silent field errors. Never-check repaired the supplied errors without compiler diagnostics. These development results do not overturn the historical repository/application comparisons below or establish a general speed/cost advantage. Production checking stays enabled; no further trial is selected.

**Second-model repeat, 2026-10-01:** [051](glm-checking-policy-repeat.md) used GLM 5.3 Flash with low reasoning on the same 36-cell matrix: **26 strict successes**, eight answer-format failures and two substantive payment-recovery mistakes. Natural strict scores were native 4/6, always 4/6, never 6/6, after-failure 3/6; all natural content and effects were correct after diagnostic outer-fence removal. No generated semantic errors appeared. Three scripts passed checking but omitted a return; the current entry-point contract does not enforce the return type. One checked recovery skipped a required payment yet reported success. Production checking is retained; result-contract and action-identity follow-ups are deferred, with no additional trial selected.

**Efficiency is part of the comparison.** On the Muse Spark natural tasks, native Pi and checked Strata both passed 6/6 with 2.17 requests/attempt; checked Strata averaged 5,849 versus 8,323 reported tokens, $0.000635 versus $0.000735 per attempt, and 11.66 versus 17.72 seconds median wall time. This encouraging signal did not repeat on GLM: both were 4/6 strict, while checked Strata used 2.50 versus 2.00 requests, 5,440 versus 5,575 tokens, $0.000706 versus $0.000493 per attempt and 10.32 versus 9.26 seconds median. Each sample covers only two task definitions; cache/ordering/provider differences limit inference. The [complete efficiency tables and data](checking-policy-comparison.md) include failures, all policies and seeded recovery. A [broader scope](../.work/issues/054-broader-composition-benchmark.md) is proposed but unselected.

## The idea in one paragraph

Strata asks a simple question: **what if an AI agent could call its tools as typed functions inside a small program, instead of calling them one by one?**

Today an agent that needs "all big invoices for German customers" typically calls one tool to list customers, then another tool per customer to fetch invoices, reading pages of raw data into its conversation along the way. With Strata, the agent writes one short TypeScript program: fetch customers, fetch their invoices, filter locally, return only the answer. Types catch wrong arguments or field names *before* anything runs, and large intermediate results never fill the conversation.

The open question is whether that convenience **earns its cost** — programs, type definitions, and error fixing all consume time and tokens too.

## How we tested it

We compared Strata ("typed" path) against a capable baseline ("direct" path) that calls the same underlying service operations as individual tools and may use ordinary scripts. Data, service allowlists and grading were matched. Direct retained shell/files while typed used strict mode; this compares configured systems and does not isolate typing alone.

Three settings, from familiar to unfamiliar:

1. **Repository tasks (familiar territory):** orientation, search-and-read, Git reasoning, and aggregation over real code. ~120 cells across four stages, one model. Typed vs. stock agent.
2. **Business-app tasks (unfamiliar APIs):** six tasks over Gmail/Amazon/Spotify-style services (e.g. "compute last month's spend", "move a wishlist to cart"), each repeated 3× per approach = 36 cells. Typed programs vs. direct per-operation tools. Graded by the upstream task harness, not by us.
3. **Function-calling diagnostic (narrow):** 30 small cases checking whether the model picks the right function, fills arguments, and abstains when nothing fits.

Costs are estimated from recorded token usage, not provider bills. Sample sizes are small — enough to spot a clear win, not enough to prove generality.

> **Terms used below, in one line each:**
> - *Cell* — one run of one task with one approach (*task × approach × repetition*); e.g. "last month's spend" with typed programs, first attempt. The rerun has 6 tasks × 2 approaches × 3 repetitions = 36 cells. Each cell starts from a fresh world with fixed caps and is graded independently.
> - *Typed path / direct path (also called arms)* — the two approaches compared: agent-written TypeScript programs vs. calling the same operations as individual tools.
> - *Strict success* — the task counts only if the agent finishes **and** the grader reports zero failures (stricter than "it produced something").
> - *Cost per success* — total cost of all attempts divided by strict successes, so failed work is included, not hidden.
> - *Round trip / request* — one model call (prompt → response); fewer means less back-and-forth.
> - *Declarations* — the generated typed function signatures the model must read before writing a program; they travel with every request.
> - *Allow-list* — the fixed set of operations the agent may call in a given task.
> - *Fresh world* — each cell starts from a reset starting state, so attempts don't leak answers into each other.
> - *Upstream grading / harness* — the external benchmark's own checker and task runner, not something we wrote for ourselves.
> - *Regression test (4/4 green)* — a small automated test that locks in the timestamp fix: 4 checks, all passing.

## What works (positives)

- **The mechanism is real.** Programs typecheck before running, compose multiple calls, filter large payloads locally (the demo shrinks ~2 MB of intermediate data to a few hundred bytes of answer), reject bad results, and enforce allow-lists. This is a feasibility result, and it holds.
- **Real tasks can be completed.** A hand-written program solved a business-app task twice from a clean slate with full marks. The plumbing — discovery, execution, saving results, upstream grading — works end to end.
- **Validation parity is verified.** Both approaches run under the same validation rules through the interfaces agents actually use, covered by a permanent regression test. The numbers below are the post-fix rerun; other system differences remain.
- **Typed programs use fewer interactions.** In the rerun they needed about **half the model round trips** (6.1 vs. 12.3 requests per task). Both achieved 15/18 strict successes. No destructive hints or typed policy denials were visible in the audit; that does not prove every effect was authorized.
- **Small diagnostic is encouraging.** 30/30 correct function selections after corrected grading — but this is a narrow exercise with ~3 candidate functions per question, not a leaderboard score.

## What doesn't (negatives)

- **No confirmed general advantage.** On repository tasks, typed programs used far fewer agent tool calls but roughly **2× the tokens and cost**, with no latency advantage. The later small Muse Spark native-Codemode comparison showed lower tokens/cost/time for checked Strata, but GLM did not reproduce it and both samples contain only two natural task definitions.
- **The clean business-app rerun reaches completion parity but still loses on cost:**

  | Approach | Tasks completed (strict) | Cost per success |
  | --- | --- | --- |
  | Typed programs | 15/18 | $0.0141 |
  | Direct tools | 15/18 | $0.0092 |

  Direct tools are ~1.5× cheaper per success — and cheaper on **every one of the six tasks**, including the aggregation task typed composition was supposed to favor. (The earlier run was 9/18 vs. 15/18 at ~4× cost, but that included the timestamp bug above; those numbers are preserved for audit, not used as the conclusion.)
- **Context overhead is the leading explanation.** Typed requests cost ~3× more each ($0.0019 vs. $0.0006), with type definitions included in every prompt. Halving the request count did not compensate on these tasks. This is not a controlled declaration-cost ablation and does not rule out a different workload; heavier processing alone has no demonstrated benefit here.
- **Smaller type descriptions helped once, then didn't.** A compact-declaration variant cut cost/success ~26% in one development round (12/12 both arms) but failed confirmation on fresh tasks (2/4 vs. 3/4, stock 4/4). It stays opt-in; full descriptions stay default.
- **One task has zero strict successes in both approaches** (date-relative "songs released this or last year" counting). Most attempts missed grading; one direct attempt passed the grader but stopped at a budget guard. The strict totals do not imply identical failure causes.
- **Platform caveat:** Linux is the tested environment. Windows runs with 12 known environment-related test failures; no general Windows support claimed.

## Limits of what we claim

- Mostly one model, small samples, development tasks reused between runs — no generalization claim follows. A positive signal would need confirmation on untouched tasks.
- Both compared paths preloaded the relevant operations; "finding the right tools in a huge catalog" was explicitly excluded and remains untested.
- The diagnostic (30 cases) measures function selection in isolation, not task completion.
- Per-cell latency was not measured in the AppWorld rerun, so fewer requests do not establish a speed advantage.

## What the later checking pilot teaches us

The September 30 pilot asked a narrower question than the application comparison: does semantic checking help when the model already has the same TypeScript API descriptions? Each of always-check, never-check and check-after-failure passed 6/6 natural attempts. There were no naturally generated semantic errors to prevent. The native Pi Codemode baseline also passed 6/6. These tasks were small synthetic development cases; completion parity does not establish that checking is generally redundant.

The supplied mistakes exposed different responsibilities:

- **Early checking can prevent some partial work.** It rejected a result-field typo before an earlier simulated payment could run. Deferred diagnostics explained the error only after that payment existed.
- **Successful execution can conceal a wrong answer.** A misspelled field in a filter produced an empty list without throwing. Checking after failure never activated; early checking caught the field error. Type-correct business mistakes escaped both policies.
- **Recovery needs observed state.** In the four unchecked partial-effect attempts, the model read the payment ledger and confirmed that the requested payment already existed. It avoided duplicates without rerunning the original script. The task explicitly instructed this verification; automatic replay safety was not demonstrated.
- **Compiler work and model context are different costs.** Skipping checking retained the same declarations and therefore did not address the earlier application's declaration overhead. Source preparation was faster, but small relative to model round trips; overall cost and speed had no established winner.

The reasonable inference is that declarations with optional semantic checking deserve consideration for short, low-impact workflows. The value of early checking depends on the mistakes and effects a real workload encounters. We have not isolated the benefit of declarations themselves, demonstrated a production policy improvement, or selected another campaign. See the [detailed interpretation](checking-policy-pilot.md#what-we-learned-from-the-run).

## Reading of the result

The historical repository/application pattern is consistent: **typed composition buys fewer round trips at higher cost per request, and the second effect dominates.** A plausible mental model is familiarity: wrapping a tool the model already knows (shell, files, simple lookups) adds reading cost without adding understanding, while composition might still help where the API is unfamiliar and multi-step — but our unfamiliar-API test still favors direct tools, so that hypothesis currently has no supporting evidence either. The later synthetic checking runs address a different question and do not establish a general policy winner.

Possible next directions (none selected; stopping is a legitimate outcome):

- **Hybrid:** typed functions alongside ordinary shell/direct tools, measuring what the agent actually chooses.
- **Stored program reuse:** only if recurring workflows justify it; compare against stored scripts too, counting authoring and adaptation costs ([047](../.work/issues/047-stored-program-reuse.md)).
- **Narrow:** a task family where local joining and filtering demonstrably outweighs definition cost — needs concrete tasks and a fair baseline, not an assumption.
- **Larger catalogs / changing contracts:** discovering a few functions among thousands, or recovering when an API changes — separate experiments, not follow-ups to the cost result.

Historical program spend through the September 22 checkpoint was approximately $1.21 under its authorization. The September 30 Muse Spark pilot and October 1 GLM repeat added $0.024197942 and $0.01813044 respectively, **$0.042328382 combined** in estimated model cost. These are usage-based estimates, not reconciled bills. Raw transcripts, credentials, and datasets stay local; tracked reports contain sanitized summaries.

## Where to look next

- Prototype behavior: `docs/how-it-works.md`, `ARCHITECTURE.md`
- Repository evidence: `docs/repo-trials.md`
- Business-app pilot and rerun: `.work/issues/042-matched-application-comparison.md`, `.work/issues/046-post-parity-comparison-v3.md`
- Entry-point fix: `.work/issues/045-pilot-entrypoint-validation-parity.md`
- Diagnostic: `docs/bfcl-diagnostic.md`
- Priorities: `.work/issues/index.md`, `docs/handoff.md`
