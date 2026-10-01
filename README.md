# strata-agent

> **Research prototype.** Strata is unfinished and is not production-ready.

Strata explores a simple idea: **what if an AI agent could use its tools as typed functions in a small program?**

An agent often needs to find information, make several related calls, and combine the results. Strata lets it express that work in TypeScript. The program can fetch data, filter it, and pass results between tools before returning a summary to the model. Types describe what each function accepts and returns, so some mistakes can be caught before anything runs.

The prototype is an extension for Pi, a coding agent. The broader research question applies to agents working with local tools and remote services.

**Current finding (2026-10-01): checked composition now has a measurable cost advantage with Muse Spark on a broader synthetic corpus.** Across 20 workflows repeated three times, checked Strata scored 60/60 versus native Pi Codemode's 58/60, using 28% fewer tokens and 23% lower estimated model cost. Median time was similar. With GLM, checking used fewer tokens but needed more repair turns, cost 6% more and took longer. This is a model-dependent result, not a general performance claim.

Strata retains checking before execution, returns diagnostics on errors and keeps clean checks out of model context. The [240-attempt comparison](docs/composition-benchmark.md) is complete, with separate answer, effect and output-format scores. The earlier [checking-policy pilots](docs/checking-policy-comparison.md) and [September 22 wrap-up](docs/wrap-up.md) remain historical evidence. Documentation was pushed as `7b64a4e` before the broader run.

**Later tuning improved the checked approach on both models.** A short correct programming recipe reduced measured cost and repair work on six new workflows. The helper and shorter declarations did not earn promotion; GLM output formatting remains unresolved. See the [132-attempt tuning report](docs/strata-tuning-results.md). This is a Strata-versus-Strata experiment; production defaults remain unchanged.

**Implemented since those measurements:** explicit final-result selection and action receipts now work in the shared production extension. Set `finalize: true` on the final `typed_program`, or select its id with `finalize_result`; the host delivers the computed JSON. `program_effects` distinguishes acknowledged, rejected and uncertain actions after failures and lists allowed inspection operations. Known missing/invalid root returns are rejected before execution. [Usage and limits](docs/results-and-recovery.md). These changes have model-free integration coverage; their LLM performance has not yet been benchmarked.

## The idea: tools as functions

A command-line tool, an MCP tool (a tool exposed through the Model Context Protocol), and a REST API all offer operations an agent can call. Could they share a useful programming interface, even though they run in different places?

| Kind of operation | What a typed function could represent | Where the work happens |
| --- | --- | --- |
| Local tool or CLI | Search files, inspect Git history, run a project check | On the local machine, through an approved adapter |
| MCP tool | Query a service or invoke an operation described by its tool schema | In the connected tool server, locally or remotely |
| REST API | Fetch records or update an external application | In a remote service, through an API client |
| Local computation | Filter, join, sort or summarize the returned data | Inside the program's execution sandbox |

The hypothesis is that the agent could compose these functions without having to handle a different calling convention for each tool. Some functions would make remote calls; others would perform local work inside the sandbox. Access to files, processes and external services would still need explicit permissions.

The broader goal is that every operation available to the agent can be expressed as a typed function, including CLI and filesystem operations underneath. One risk is familiarity: models may already be better at established Bash/Linux workflows than at a new set of function names and schemas. Strata could lose that advantage while adding more definitions to read. This is a counter-hypothesis to test, not an established explanation of the results; comparisons must retain the baseline's ordinary CLI and scripting abilities.

The working hypothesis is that this tradeoff depends on familiarity: a typed wrapper may add friction for a tool the model already knows, yet provide useful structure for an unfamiliar API it must learn anyway. A uniform interface could also make entire workflows easier to compose, even when some individual calls become more expensive. A hybrid—typed functions alongside familiar shell tools—might work better still. Whether uniform composition outweighs the benefit of choosing between interfaces is an open research question.

That is the direction being explored, not a description of a finished universal tool system. Today, Strata has an MCP connection, a small CLI demonstration, and read-only repository tools. General REST integration and broad tool coverage remain ideas to investigate. In the current prototype, local tool adapters run in the trusted host; the generated program's computation runs in a restricted environment. This is not yet a hardened security sandbox.

## A small example

Suppose the agent needs to find large invoices for customers in Germany. It can write one program that gets the customers, fetches their invoices, and returns only the relevant fields:

```ts
import { api } from "@cap/fixture";

export async function main() {
  const { customers } = await api.customers({ country: "DE" });
  const { invoices } = await api.invoices({
    customerIds: customers.map((customer) => customer.id),
  });

  return invoices
    .filter((invoice) => invoice.amount > 10_000)
    .map((invoice) => ({ id: invoice.id, amount: invoice.amount }));
}
```

This example uses the included demonstration data. Intermediate customer and invoice records stay outside the model's conversation; the model sees the final result. If the program uses an invalid argument or a field that does not exist in the declared types, Strata can report that mistake before calling the tools. Inputs, outputs and permissions are also checked when calls run.

Types cannot tell the agent whether it chose the right business rule. They are only as useful as the underlying descriptions and schemas.

## What are we trying to find out?

The main question is whether this approach helps agents complete real tasks more reliably, cheaply or quickly. Fewer tool calls alone would not be enough: writing programs, reading type definitions and fixing errors also consume time and model context.

The research focuses on four questions:

- **Composition:** When does combining calls and processing data in a program beat individual tool calls or ordinary shell scripts?
- **Useful feedback:** Do type errors help agents correct mistakes before taking actions, enough to justify the extra machinery?
- **Discovery:** Could an agent find and load just the functions it needs from a large tool catalog, without reading every tool definition first?
- **Shared interfaces:** How much integration effort can existing MCP schemas and REST API descriptions save, and where do local tools still need custom adapters?

Comparisons need to give the alternatives equivalent access to data and tools. Ordinary agents can already write scripts, and direct tools can also be discovered on demand. Strata needs to earn its place against those alternatives.

## What we have learned so far

**The basic mechanism works.** The prototype can check programs, compose tool calls, reject invalid results, and process large responses before returning a small answer. The demonstration reduces roughly two megabytes of intermediate data to a few hundred bytes of output. That demonstrates local filtering, not an overall cost saving.

**Early checking demonstrated a prevention benefit.** Given deliberately broken scripts, it caught a result-field error before an earlier simulated payment could execute, and caught a field typo that otherwise silently returned an empty answer. Runtime schema validation and permissions stayed enabled under every policy. These are controlled mechanism results within Strata's checking-policy comparison; native Pi was not included in the seeded-recovery arms, and no naturally generated semantic errors appeared in these small tasks.

### Latest comparison with native Pi — 20 workflows

Each row covers **20 distinct definitions, three fresh repetitions = 60 attempts**. A turn is one model request; tokens include input, cached input and output without adding reasoning again. Answer + state requires the requested JSON content and exact effects; one unambiguous JSON fence is accepted. Pure JSON success also requires an unwrapped final answer. All-attempt averages, timing and cost per success include failures.

| Model / approach | Answer + state | Pure JSON success | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/scored success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | 58/60 | 58/60 | 2.12 | 8,614 | 10.46 / 25.88 | $0.000844 | $0.000873 |
| Muse, checked Strata | 60/60 | 60/60 | 2.13 | 6,207 | 10.87 / 23.12 | $0.000653 | $0.000653 |
| GLM, native Pi | 56/60 | 49/60 | 2.17 | 6,847 | 6.74 / 21.45 | $0.000858 | $0.000919 |
| GLM, checked Strata | 59/60 | 36/60 | 2.57 | 6,004 | 13.16 / 29.92 | $0.000910 | $0.000925 |

The Muse cost reduction appears across all five families; its task-block bootstrap cost ratio is 0.774 (95% descriptive interval 0.649–0.907). Reliability intervals include parity. GLM needed 18.5% more requests and roughly twice the median time with checking, and its pure JSON compliance was worse. Its cost difference is uncertain. Both approaches still make semantic business mistakes; types do not replace state verification.

Native Muse overpaid ten simulated invoice payments after using a nonexistent invoice field. Checked Strata made every required effect correctly across both models, but one GLM run then wrongly claimed it had added no payments. The compiler rejected 32 naturally generated programs before calls from those programs ran, including strict typing issues that JavaScript would tolerate. Quiet checking remains the default; the new comparison does not isolate the compiler from interface and runtime differences.

The [full report](docs/composition-benchmark.md) includes task families, failures, token/cache/reasoning breakdowns, P90 time and task-block uncertainty. [Sanitized metrics](docs/evaluations/composition-2026-10-01.json) cover all 240 evaluation and 16 separate development attempts. Total new estimated model cost was **$0.2045**. [055](.work/issues/055-checking-attribution.md) records the deferred experiment to isolate checking itself.

### Prompt tuning after that comparison

**One shared recipe was tested with both models.** “Muse, recipe” and “GLM, recipe” identify the model running that same profile; there are no separate model-specific recipes. Only the example’s operation and response field come from the task’s public API schema.

Six new definitions × three generated worlds = **18 attempts per row**, following 60 separate development attempts. Same checked session and full types; the recipe adds a correct pagination example and inference/Map guidance. Requests are model turns; tokens include cached input and output; failures stay in averages. Costs are estimates.

| Model / shared checked profile | Answer + state | Strict JSON success | Effects correct | Requests/attempt | Tokens/attempt | Median seconds | $/attempt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, baseline | 17/18 | 17/18 | 17/18 | 3.22 | 14,643 | 25.87 | $0.001459 |
| Muse, recipe | 18/18 | 18/18 | 18/18 | 2.39 | 10,186 | 16.86 | $0.001039 |
| GLM, baseline | 17/18 | 14/18 | 17/18 | 3.00 | 9,791 | 22.30 | $0.001342 |
| GLM, recipe | 18/18 | 13/18 | 18/18 | 2.50 | 7,446 | 16.04 | $0.001009 |

The recipe's measured cost was 29% lower with Muse and 25% lower with GLM; GLM's uncertainty interval includes parity. Both baseline failures concern the same allocation rule, so broader reliability superiority is unproven. Strict success overall stayed equal because formatting did not improve. The recipe is retained in the experimental profile; the generic helper added repairs/cost, alias deduplication failed a correctness gate, and smaller feedback was never exercised. [Full results](docs/strata-tuning-results.md) include P90 time, cost per success, tokens/cache/reasoning, paired uncertainty and all [132 sanitized attempts](docs/evaluations/tuning-2026-10-01.json). Estimated tuning cost: **$0.1350**.

### Earlier small comparison with native Pi

Each row covers **two natural tasks, three fresh repetitions each**. A request is one model turn; tokens include input, cached input and output without adding reasoning again. Averages and cost per success include failed attempts. Dollar amounts are estimates from recorded usage, not provider bills.

| Model / approach | Strict success | Requests/attempt | Tokens/attempt | Median seconds | $/attempt | $/strict success |
| --- | --- | --- | --- | --- | --- | --- |
| Muse Spark, native Pi | 6/6 | 2.17 | 8,323 | 17.72 | $0.000735 | $0.000735 |
| Muse Spark, checked Strata | 6/6 | 2.17 | 5,849 | 11.66 | $0.000635 | $0.000635 |
| GLM 5.3 Flash, native Pi | 4/6 | 2.00 | 5,575 | 9.26 | $0.000493 | $0.000740 |
| GLM 5.3 Flash, checked Strata | 4/6 | 2.50 | 5,440 | 10.32 | $0.000706 | $0.001059 |

In the Muse Spark sample, checked Strata used approximately **30% fewer reported tokens, 14% less estimated model cost and 34% lower median wall time** than native Pi. GLM had equal strict success with more model requests, about 43% higher cost and 11% higher median time for checked Strata. All natural GLM answer content and final effects were correct after diagnostic removal of outer Markdown fences; primary strict grading still rejects those answers. Muse Spark used medium reasoning and GLM low; caches, provider timing and small samples limit interpretation.

The complete [comparison report](docs/checking-policy-comparison.md) includes all four profiles, separate seeded-recovery results, input/output/cache/reasoning breakdowns, tail latency and [sanitized metrics for all 72 attempts](docs/evaluations/checking-policy-2026-10-01.json). The Muse Spark pilot passed 36/36 strict overall; GLM passed 26/36, with eight formatting failures and two substantive recovery mistakes. These results motivate a broader test; they do not establish a generally superior approach.

### Earlier application and repository evidence

**The repository experiments have not shown an advantage.** On the tasks tested, typed programs used fewer agent tool calls but more model tokens and greater estimated cost than ordinary Pi. Shorter type descriptions helped in an initial experiment, but a follow-up did not confirm the improvement. There is no established overall win in task success, cost or speed. The [repository trial report](docs/repo-trials.md) contains the measurements and limitations.

**The application comparison now runs clean, and still favors direct tools on cost.** The first pilot had a flaw: across six tasks repeated three times per approach, typed programs completed 9 of 18 attempts versus 15 for direct tools, at roughly four times the cost per success — but the typed path rejected some timestamps the direct path accepted. After fixing that mismatch through both agent-facing entry points, a versioned 36-cell rerun reached completion parity (15–15) while direct tools remained cheaper (about 1.5× lower cost per success). The mechanism is measured: typed programs need half the model round trips but cost about three times more per request, with type definitions dominating the context — and direct tools were cheaper on every task, including aggregation. One task has zero strict successes in both approaches, although individual failure causes differ. So typed composition earns back completion but not its cost on the tasks tested. See the [pilot report and review](.work/issues/042-matched-application-comparison.md) and the [post-parity rerun](.work/issues/046-post-parity-comparison-v3.md).

**Small tool-use diagnostics are encouraging, but narrow.** In a small BFCL-based exercise, the model selected functions, supplied arguments and abstained when no function fit. Corrected grading accepted all recorded calls, but some sessions stopped at a request limit. This was neither an official benchmark score nor a comparison proving Strata was better. See the [diagnostic report](docs/bfcl-diagnostic.md).

### Contracts and recovery

**Declarations and semantic checking can be evaluated separately.** The September 30 pilot kept the same TypeScript descriptions while varying when checking ran. Each policy passed 6/6 small natural attempts without needing semantic diagnostics; native Pi Codemode also passed 6/6. Early checking prevented seeded partial effects and caught a typo that silently returned no records. Checking after failure missed that silent error, and recovery from a partial payment required inspecting state rather than replaying the failed script. Skipping the compiler did not remove declaration tokens or demonstrate a clear cost saving. The [pilot's lessons](docs/checking-policy-pilot.md#what-we-learned-from-the-run), expanded October 1, explain the evidence and its limits.

**Checking needs meaningful contracts, and recovery needs correctly interpreted state.** The GLM repeat produced scripts that passed checking but omitted a return; the compiler at that measured revision permitted that return type, so the runtime reported the error after execution. In one recovery, the model treated an old payment as evidence that the requested new payment existed, skipped it and reported success. Types and runtime schemas accepted the program; independent state grading caught the omission. The [second-model report](docs/glm-checking-policy-repeat.md) records these historical failures. The subsequent [implementation](docs/results-and-recovery.md) rejects known invalid root returns and supplies action evidence; it does not certify business rules. We retain checking before execution with quiet success and diagnostic feedback.

The repository/application comparisons predominantly used one model; the small checking pilots used two natural task definitions. The latest synthetic comparison expands to 20 definitions and two model families, with a Muse cost advantage and a GLM repair/time penalty. Real-service generalization and the isolated value of semantic checking remain open.

### What can be tuned next?

The full extension already appends custom Strata instructions to Pi’s base prompt and has `search_capabilities`, `load_capability` and `program_details`. Full declarations are the default; compact presentation is opt-in. The 054 comparison used a separate prompt, preloaded task-relevant functions and exposed only `typed_program` in the checked arm. It did not test discovery or optimize prompt wording. The subsequent 060 tuning experiment exposed `program_details` in every arm and varied prompt/helper/presentation/feedback independently before confirmation.

The [inventory and improvement plan](docs/glm-improvement-plan.md) distinguishes existing behavior, the completed tuning tests and deferred ideas. The recipe is the retained experimental result. Action receipts and explicit final JSON selection are now implemented and [documented separately](docs/results-and-recovery.md); finer discovery and cross-model benchmarking remain deferred. The runtime still checks before execution. Earlier frozen benchmark results remain unchanged.

## Later related work

Earendil's [“You Said No MCP!”](https://earendil.com/posts/you-said-no-mcp/) (2026-09-29) describes Pi adopting MCP and JavaScript tool orchestration in its core. This announcement came **after Strata's initial September experiments and September 22 research checkpoint**. It overlaps with the composition mechanism explored here; it does not establish a performance advantage or imply that Strata influenced Pi. Earlier code-composition precedents already existed. The [comparison note](docs/research/pi-codemode-2026-09.md) connects the announcement and HN discussion to Strata's evidence and open questions. Historical repository/application measurements used Pi 0.73.1; the subsequent [September 30 pilot](docs/checking-policy-pilot.md) tested native Codemode in installed Pi 0.99.1 on a separate small synthetic fixture.

## Where the research could go

A more interesting fit may be agents with a programmable execution environment: a runtime such as Bun, CLI tools and filesystem access, combined with many APIs and MCP tools. For familiar local coding tasks, shell tools and ordinary scripts are already effective; Strata's extra type definitions and checking may not earn their cost. The repository experiments so far support that caution, without establishing that typed composition can never help coding agents.

With many unfamiliar services, the proposition changes: discover a small set of typed functions, call them from a program, and combine remote results with local work. A function might query an API, invoke a CLI tool or read a file; the program can then join responses, transform data and calculate an answer. The potential benefit comes from one composable interface over those different operations, backed by a general-purpose execution environment. Whether it earns its cost remains a research hypothesis. Execution location and filesystem, network and process permissions remain explicit design choices.

A promising setting may be an agent working across many unfamiliar business services. Existing API descriptions could supply the types; the agent could discover a few relevant functions, combine their results locally, and return an answer without filling its conversation with raw records. Whether that helps more than good direct tools remains an open question.

Possible directions include:

- **More tools through one interface:** explore typed functions for CLI operations, MCP tools and REST APIs, reusing existing schemas and generated clients where practical.
- **Local and remote composition:** combine remote service calls with local sandboxed computation, while keeping execution location and permissions explicit.
- **Larger catalogs:** discover a small relevant set of functions from many available operations, then measure discovery separately from program execution.
- **Changing contracts and permissions:** investigate how an agent recovers when an API changes or access is revoked between discovering a function and calling it.
- **Broader workflows:** consider edits, project checks and state across programs where real tasks demonstrate a need.

Both application tool paths now apply the same validation rules, verified through the interfaces agents actually use. That enabled the corrected rerun, where direct tools remained cheaper on every tested task. The later [broader native-Codemode comparison](docs/composition-benchmark.md) confirms a Muse cost advantage on a synthetic corpus, with a GLM repair/time penalty. The [tuning experiment](docs/strata-tuning-results.md) then improved measured checked-profile efficiency on new synthetic workflows. Real-service generalization remains open; catalog scaling, memory and additional adapters remain separate possibilities. The [issue board](.work/issues/index.md) records scope and dependencies.

## Try the prototype

The local demonstration requires Bun and uses bundled test data; it needs no model API key or external service. A historical Linux full-suite pass is recorded; the latest macOS/Bun baseline and Windows runs have [documented verification gaps](docs/handoff.md#verification-and-environment).

```sh
git clone https://github.com/Fannon/strata-agent.git
cd strata-agent
bun install --frozen-lockfile
bun run check
bun test
bun run demo
```

To try the extension with a model, configure Pi's model credentials and run `bun run pi`. Model use may incur provider charges.

The [prototype guide](docs/prototype-guide.md) covers Pi usage, connecting an MCP server, configuration, tests and benchmark commands.

## Read further

- [Broader composition comparison](docs/composition-benchmark.md) — 20 workflows, two models, full correctness/efficiency data and uncertainty.
- [Tuning inventory and GLM improvement plan](docs/glm-improvement-plan.md) — what already exists and what we could test next.
- [Evaluation summary](docs/evaluation-summary.md) — plain-language rundown of what works, what doesn't, and the numbers.
- [Checking-policy comparison](docs/checking-policy-comparison.md) — success, requests, tokens, time and cost for both models and all profiles.
- [Checking-policy pilot](docs/checking-policy-pilot.md) — updated Pi baseline and always/never/after-failure checking on small synthetic tasks.
- [GLM repeat](docs/glm-checking-policy-repeat.md) — second-model results, output-format failures and payment-recovery mistakes.
- [Wrap-up review](docs/wrap-up.md) — assessment of the stopping point, remaining gaps and restart criteria.
- [How it works](docs/how-it-works.md) explains the execution flow.
- [Architecture](ARCHITECTURE.md) describes the implementation and its trust boundaries.
- [Architectural direction](ACD.md) develops the longer-term design.
- [Evaluation plan](docs/evaluation.md) explains how the hypotheses should be tested.
- [Related research](docs/research/typed-agent-prior-art.md) places the experiment alongside other tools-as-code approaches.
- [Issue board](.work/issues/index.md) and [handoff](docs/handoff.md) track ongoing work.

Plans and issues live in the tracked `.work/issues/` directory. Raw experiment transcripts, credentials, downloaded datasets and generated artifacts stay local.
