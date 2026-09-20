# Strata evaluation summary

*For software developers and architects. No prior knowledge of the internal benchmarks assumed. Status as of 2026-09-20.*

## The idea in one paragraph

Strata asks a simple question: **what if an AI agent could call its tools as typed functions inside a small program, instead of calling them one by one?**

Today an agent that needs "all big invoices for German customers" typically calls one tool to list customers, then another tool per customer to fetch invoices, reading pages of raw data into its conversation along the way. With Strata, the agent writes one short TypeScript program: fetch customers, fetch their invoices, filter locally, return only the answer. Types catch wrong arguments or field names *before* anything runs, and large intermediate results never fill the conversation.

The open question is whether that convenience **earns its cost** — programs, type definitions, and error fixing all consume time and tokens too.

## How we tested it

We compared Strata ("typed" path) against an equally capable baseline ("direct" path) that calls the same underlying operations as individual tools and may use ordinary scripts. Same data, same access, same grading — the baseline was deliberately kept strong.

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
- **The comparison is fair.** Both approaches run under the same validation rules through the interfaces agents actually use, locked in by a permanent regression test. The numbers below are that apples-to-apples rerun.
- **Typed programs are interaction-efficient.** In the rerun they needed about **half the model round trips** (6.1 vs. 12.3 requests per task) and produced correct final answers with no observed unauthorized effects.
- **Small diagnostic is encouraging.** 30/30 correct function selections after corrected grading — but this is a narrow exercise with ~3 candidate functions per question, not a leaderboard score.

## What doesn't (negatives)

- **No overall win anywhere so far.** On repository tasks, typed programs used far fewer agent tool calls but roughly **2× the tokens and cost**, with no latency advantage.
- **The clean business-app rerun reaches completion parity but still loses on cost:**

  | Approach | Tasks completed (strict) | Cost per success |
  | --- | --- | --- |
  | Typed programs | 15/18 | $0.0141 |
  | Direct tools | 15/18 | $0.0092 |

  Direct tools are ~1.5× cheaper per success — and cheaper on **every one of the six tasks**, including the aggregation task typed composition was supposed to favor. (The earlier run was 9/18 vs. 15/18 at ~4× cost, but that included the timestamp bug above; those numbers are preserved for audit, not used as the conclusion.)
- **We know why.** Typed requests cost ~3× more each ($0.0019 vs. $0.0006) because the type definitions travel with every prompt. Halving the trip count can't compensate. This predicts that simply "bigger data processing" won't rescue the tradeoff — the definitions ride along regardless.
- **Smaller type descriptions helped once, then didn't.** A compact-declaration variant cut cost/success ~26% in one development round (12/12 both arms) but failed confirmation on fresh tasks (2/4 vs. 3/4, stock 4/4). It stays opt-in; full descriptions stay default.
- **One task beats both approaches equally** (date-relative "songs released this or last year" counting) — an approach-independent difficulty, not a typed-specific failure.
- **Platform caveat:** Linux is the tested environment. Windows runs with 12 known environment-related test failures; no general Windows support claimed.

## Limits of what we claim

- Mostly one model, small samples, development tasks reused between runs — no generalization claim follows. A positive signal would need confirmation on untouched tasks.
- Both compared paths preloaded the relevant operations; "finding the right tools in a huge catalog" was explicitly excluded and remains untested.
- The diagnostic (30 cases) measures function selection in isolation, not task completion.

## Reading of the result

The pattern is consistent across settings: **typed composition buys fewer round trips at higher cost per request, and the second effect dominates.** A plausible mental model is familiarity: wrapping a tool the model already knows (shell, files, simple lookups) adds reading cost without adding understanding, while composition might still help where the API is unfamiliar and multi-step — but our unfamiliar-API test still favors direct tools, so that hypothesis currently has no supporting evidence either.

Possible next directions (none selected; stopping is a legitimate outcome):

- **Hybrid:** typed functions alongside ordinary shell/direct tools, measuring what the agent actually chooses.
- **Narrow:** a task family where local joining and filtering demonstrably outweighs definition cost — needs concrete tasks and a fair baseline, not an assumption.
- **Larger catalogs / changing contracts:** discovering a few functions among thousands, or recovering when an API changes — separate experiments, not follow-ups to the cost result.

Total program spend to date is ~$1.21 of the €5 authorization. Raw transcripts, credentials, and datasets stay local; only sanitized summaries are committed.

## Where to look next

- Prototype behavior: `docs/how-it-works.md`, `ARCHITECTURE.md`
- Repository evidence: `docs/repo-trials.md`
- Business-app pilot and rerun: `.work/issues/042-matched-application-comparison.md`, `.work/issues/046-post-parity-comparison-v3.md`
- Entry-point fix: `.work/issues/045-pilot-entrypoint-validation-parity.md`
- Diagnostic: `docs/bfcl-diagnostic.md`
- Priorities: `.work/issues/index.md`, `docs/handoff.md`
