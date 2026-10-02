# strata-agent

> **Experimental research project.** Strata is built to learn, test ideas and establish proofs of concept. It is unfinished and not production-ready. Negative and inconclusive results are part of the output.

Strata asks: **can an AI agent work more reliably or efficiently when its tools are typed functions it can compose into a program?**

Instead of sending every tool response back to the model, the agent writes a small TypeScript program that calls tools, passes data between them, filters or joins the results, and returns a compact answer. Types describe each function's inputs and outputs; checking can catch some mistakes before the program takes any actions.

The intended value is less raw data in model context, fewer model round trips for dependent work, and earlier feedback on contract errors. Writing code, reading declarations and repairing type errors also cost tokens and time. The experiment is whether those benefits earn the extra machinery against equally capable direct tools and ordinary scripts.

Today this is a **Pi extension hosted by Bun**, with a shared capability layer and a restricted QuickJS execution environment. The broader idea is one composable interface over local tools and remote services. Code-based tool orchestration already has [prior art](docs/research/typed-agent-prior-art.md); Strata's particular experiment combines schema-derived TypeScript functions, checking before execution, runtime validation and explicit result/action evidence.

**Pi now covers much of the composition idea itself.** Native Codemode presents TypeScript tool declarations, composes calls in JavaScript, retains intermediate data and returns structured results; Pi 1.0 adds leaner prompts and better recovery feedback. Strata's remaining research question is whether its shared typed contracts, checking before execution and explicit evidence earn their overhead over that native path. The older results below use dated comparators; the latest [AppWorld study](docs/application-study.md) compares against Pi 1.0. [Native Codemode](https://pi.dev/docs/latest/codemode); [Pi 1.0 release notes](https://pi.dev/changelog/releases/1.0.0).

**Current assessment (October 2, 2026): the mechanism is demonstrated; narrow value is observed; general advantage is unproven.** There is a promising cost result with Muse Spark on synthetic service workflows, but no general speed, cost or reliability advantage. The newer AppWorld comparison against Pi 1.0 shows a substantial cost penalty in both models, completion parity for Muse and lower completion for checked GLM. Earlier repository/application work did not establish an overall win, and a third-model repeat still produced correct-looking answers that omitted required actions. The evidence below separates working mechanisms from demonstrated performance and remaining hypotheses.

## What exists, and what remains a hypothesis

| Area | Implemented scope | Limit or open question |
| --- | --- | --- |
| Typed composition | Schema-derived functions, checked TypeScript modules, local filtering/joins and bounded JSON results | Types cannot establish business correctness or complete pagination |
| Tool connections | MCP connector, a process-based CLI demonstration and read-only repository capabilities | General REST generation, broad CLI/filesystem coverage and repository editing/checks remain unimplemented ideas |
| Discovery | Policy-aware search/load for the local capability catalog; full declarations by default, compact presentation opt-in | Large dynamic service-catalog discovery has not been validated; recent comparisons preload task-relevant functions |
| Feedback and results | Quiet successful checks, error diagnostics, on-demand program details and explicit final JSON selection | Exact delivery preserves a selected result; it cannot make a wrong result correct |
| Action evidence | Bounded receipts distinguish broker-acknowledged, not-executed and uncertain actions; inspection tools support recovery | No automatic retry, rollback, durable replay ledger or synthesized backend idempotency |
| Execution and access | QuickJS by default; broker checks permissions and schemas; direct Bun executor opt-in | Trusted adapters run on the host; ordinary Pi tools retain their own access. This is not a hardened security boundary for the whole agent; direct Bun leaves ambient host APIs reachable |

The long-term hypothesis is a shared typed interface for CLI, filesystem, MCP and REST operations, while keeping their execution locations and permissions explicit. It may be useful for unfamiliar APIs that an agent must learn anyway. Familiar shell workflows may be better served by existing tools; a hybrid interface may work better than universal wrappers. Large-catalog discovery, recurring program reuse and real-service generalization remain questions, not proven value or an implementation commitment.

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

## What worked, and why it seems promising

- **Composition keeps intermediate data outside the conversation.** Programs can combine calls and reduce large responses before the model sees them. The bundled demonstration reduces roughly two megabytes of intermediate data to a few hundred bytes of output. This establishes the mechanism; total savings also depend on declarations, generated code and repairs.
- **Checking can prevent contract mistakes before effects.** Controlled broken-script tests caught a nonexistent result field before an earlier simulated payment ran, and a typo that otherwise silently returned an empty answer. Later models also generated programs rejected before any calls from those programs. The useful property is early feedback on the whole program, including mistakes after a planned write. Some rejections concern strict typing that JavaScript would tolerate. The small checking-policy pilot held declarations and runtime controls constant while varying the semantic gate; the broader native-Pi comparison does not isolate the compiler's incremental value. [Checking-policy lessons](docs/checking-policy-pilot.md#what-we-learned-from-the-run).
- **The shared capability layer works across transports.** MCP and CLI connectors use the same declaration/compiler/broker path. Runtime schemas and permissions remain enforced independently of static types. This supports the feasibility of a common interface; it does not establish that every tool should be wrapped or that integration is effortless. [Architecture](ARCHITECTURE.md).
- **Computed results and action evidence are useful explicit contracts.** `typed_program` with `finalize: true`, or `finalize_result`, lets the host deliver selected JSON without model reconstruction. `program_effects` exposes retained action receipts for inspection after errors. Tests verify these behaviors, and the October 1 third-model repeat used them. A broker-accepted reply is an acknowledgement, not independent proof of the requested business outcome. [Usage, verification and limits](docs/results-and-recovery.md).

The clearest measured efficiency signal is Muse's synthetic composition result below. A short shared programming recipe also helped in an initial tuning experiment, but its efficiency benefit did not generalize across all models on the current implementation. It remains an experimental profile, with no model-specific branches. [Tuning report](docs/strata-tuning-results.md).

## Where Strata falls short

**Fewer interactions do not guarantee lower cost or faster completion.** Declarations consume context, generated programs consume output tokens, and repairs add model requests. In earlier repository work there was no demonstrated overall advantage; initial gains from compact declarations did not survive confirmation. The corrected application pilot reached equal completion with direct tools but retained a cost penalty. Those negative results remain relevant alongside the later positive synthetic signal. [Repository evidence](docs/repo-trials.md); [application evidence](.work/issues/046-post-parity-comparison-v3.md).

**Type-safe code can still do the wrong work.** Models can fetch only the first page, apply the wrong business rule, omit required writes, or return extra fields. `any` and assertions can erase useful checks. In the October 1 third-model repeat, two Ling attempts computed the correct credit answer without issuing the credit action. Exact JSON delivery faithfully delivered those answers; receipts did not force completion. Independent answer and final-state grading are necessary.

**Recovery is assisted, not solved.** Receipts help distinguish acknowledged actions from uncertain ones, but a model must choose to inspect and correctly interpret state before retrying. Evidence is bounded and in memory; restarting clears it. Stronger caller-defined completion evidence and accidental extra entry-point invocation are recorded as deferred issues [063](.work/issues/063-effectful-completion-evidence.md) and [062](.work/issues/062-top-level-main-invocation.md).

**The evidence is limited.** Recent workflows are synthetic, task-relevant functions are preloaded, and model/provider/cache behavior varies. Older application trials reuse development tasks. The broader whole-system comparisons do not isolate checking from declaration rendering, prompts, runtime limits or feedback. The earlier isolated policy pilot establishes controlled prevention, but leaves the cost and frequency of naturally occurring contract mistakes on useful workflows uncertain. The October 1 third-model repeat adds a model, but reuses tasks and has no native-Pi arm. The October 2 AppWorld study adds new task instances and native Pi 1.0, while remaining simulated and lacking reuse/discovery tests. We have not established a general advantage on real services, large catalogs or arbitrary coding tasks.

## Evidence at the current checkpoint

A **turn means one model request**; capability invocations are counted separately. All-attempt averages and cost per success include failures; unavailable usage/timing is marked explicitly. Tokens sum uncached input, cached input and output; reasoning is already within output and is never added again. Costs are estimates from captured usage and catalog rates, not provider bills.

For the synthetic comparisons, primary **answer + state** success requires completion, the requested JSON content and exact resulting effects; one unambiguous JSON fence is accepted. **Strict JSON** additionally requires an unwrapped answer. AppWorld retains its upstream task grading plus explicit healthy-run/state requirements, with final delivery scored separately. Separate effect scores do not replace primary grading: an unchanged read-only world can be effect-correct while its answer is wrong.

### Latest: AppWorld against native Pi 1.0 Codemode

October 2: **six new task definitions × three existing sibling worlds = 18 task instances per row, 72 evaluation attempts total**, plus four separate calibration attempts. Both arms use the same read/auth/submission MCP operations and schema validation through a matched experimental adapter. App-relevant schemas are preloaded; no live services, discovery or reuse arm. Primary success requires a healthy completed run, upstream task completion/all checks and unchanged domain state. Strict delivery additionally requires pure JSON identical to the submitted answer.

| Model / approach | Primary success | Strict delivery | Domain state | Requests/attempt | Tokens/attempt | Measured median / P90 seconds | $/attempt | $/primary success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, native | 15/18 | 15/18 | 18/18 | 8.50 | 110,677 | 62.34 / 89.47 | $0.008891 | $0.010669 |
| Muse, checked | 15/18 | 15/18 | 18/18 | 8.78 | 271,144 | 74.00 / 103.28† | $0.023632 | $0.028359 |
| GLM, native | 15/18 | 14/18 | 18/18 | 6.89 | 66,380 | 43.02 / 76.05 | $0.005360 | $0.006432 |
| GLM, checked | 11/18 | 4/18 | 18/18 | 6.61 | ≥194,043 | 62.23 / 101.59† | $0.012850–$0.015148 | $0.021027–$0.024787 |

† Each checked row has one unavailable timing following interruption; medians/P90 use the other 17 measured timings, including ordinary failures. The two missing state grades were later recovered from the original servers without restarting agents; both show unchanged domain state. One unreported GLM request makes its tokens lower bounds and its costs intervals. The zero-request Muse interruption cost zero. Both attempts remain failed and were not replaced.

Checked Strata costs **2.66× native for Muse** and **2.40–2.83× for GLM**, with no general completion advantage. Removing the interrupted instance from both arms/models leaves the cost penalty intact. Twenty compiler rejections preceded any capability invocation; this read-only study does not demonstrate harmful-write prevention. Exact JSON delivery worked, but seven primary-successful checked GLM attempts selected objects while submitting scalar/string answers. The host delivered those objects faithfully. Pure JSON alone does not establish the requested answer shape.

Including calibration, 575 logged model requests cost an estimated **$0.940859–$0.982228** under the $2 cap. One request's exact usage and two timings remain unavailable; all 72 independent state grades are unchanged. [Full report, accounting and limitations](docs/application-study.md); [sanitized evidence](docs/evaluations/application-2026-10-02.json).

### Earlier synthetic native-Pi comparison

October 1 comparison: **20 distinct workflows × three fresh repetitions = 60 attempts per row, 240 evaluation attempts total**, plus 16 separate development attempts. This measured the earlier implementation, before explicit finalization/action receipts were added; it is not a benchmark of every current feature.

| Model / approach | Answer + state | Strict JSON | Effects correct | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, native Pi | 58/60 | 58/60 | 58/60 | 2.12 | 8,614 | 10.46 / 25.88 | $0.000844 | $0.000873 |
| Muse, checked Strata | 60/60 | 60/60 | 60/60 | 2.13 | 6,207 | 10.87 / 23.12 | $0.000653 | $0.000653 |
| GLM, native Pi | 56/60 | 49/60 | 59/60 | 2.17 | 6,847 | 6.74 / 21.45 | $0.000858 | $0.000919 |
| GLM, checked Strata | 59/60 | 36/60 | 60/60 | 2.57 | 6,004 | 13.16 / 29.92 | $0.000910 | $0.000925 |

Muse used 28% fewer tokens and 23% lower estimated model cost with checked Strata, at similar median time. Its task-block cost-ratio interval excludes parity on this corpus; reliability intervals include parity. GLM used fewer tokens but more requests, roughly twice the median time and 6% higher cost; its cost difference is uncertain. Its strict JSON compliance was also worse at this revision. These are model-dependent whole-system results.

The compiler rejected 32 generated programs before calls from those programs ran. Native Muse overpaid ten simulated payments using a nonexistent field; checked effects were correct in all 120 attempts, although one GLM answer wrongly denied making payments. This supports early contract feedback and independent effect grading without proving that the compiler alone caused the difference. [Full report](docs/composition-benchmark.md); [sanitized evidence](docs/evaluations/composition-2026-10-01.json).

### Shared recipe on the current implementation, across three models

October 1 repeat: **six existing workflows × three data variants = 18 attempts per row, 108 total**. Both profiles have finalization and recovery; the recipe adds a correct pagination example and inference/Map guidance. It is the same recipe across models. There is no native-Pi arm or individual-feature ablation.

| Model / Strata profile | Answer + state | Strict JSON | Effects correct | Requests/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Muse, baseline | 18/18 | 18/18 | 18/18 | 3.89 | 19,360 | 27.57 / 36.22 | $0.001964 | $0.001964 |
| Muse, recipe | 18/18 | 18/18 | 18/18 | 3.11 | 15,049 | 22.54 / 54.85 | $0.001622 | $0.001622 |
| GLM, baseline | 16/18 | 16/18 | 18/18 | 3.22 | 10,086 | 11.09 / 17.28 | $0.001084 | $0.001219 |
| GLM, recipe | 17/18 | 17/18 | 18/18 | 3.22 | 10,712 | 11.94 / 34.46 | $0.001136 | $0.001203 |
| Ling, baseline | 14/18 | 14/18 | 16/18 | 3.72 | 19,630 | 11.22 / 23.56 | $0.000360 | $0.000462 |
| Ling, recipe | 15/18 | 15/18 | 16/18 | 4.17 | 24,107 | 12.27 / 27.75 | $0.000407 | $0.000488 |

The recipe reduced Muse's measured cost 17%, but increased GLM's 5% and Ling's 13%; all three cost intervals include parity. Muse's median improved while its P90 worsened. Ling is cheaper at the captured rates but less reliable here. No universal efficiency improvement is established.

Exact host delivery was verified in 105 attempts, and action evidence was inspected nine times. That demonstrates use of the mechanisms, not an isolated performance benefit. Missing required writes persisted. [Full report and failures](docs/third-model-portability.md); [sanitized evidence](docs/evaluations/portability-2026-10-01.json).

<details>
<summary>Token breakdowns and separate capability invocations</summary>

These are totals per row, including failures. The AppWorld checked GLM totals omit one unreported request and are lower bounds. Input excludes cache reads. Cache writes were zero; reasoning is a subset of output. Capability invocations include unsuccessful calls and repeated work; they are not model turns.

| Experiment / model / profile | Input | Cache read | Output | Reasoning within output | Capability invocations |
| --- | --- | --- | --- | --- | --- |
| AppWorld / Muse / native | 1,469,317 | 461,961 | 60,914 | 21,148 | 784 |
| AppWorld / Muse / checked | 4,090,276 | 715,710 | 74,601 | 31,572 | 869 |
| AppWorld / GLM / native | 424,579 | 749,632 | 20,620 | 5,320 | 782 |
| AppWorld / GLM / checked | ≥879,100 | ≥2,568,960 | ≥44,718 | ≥6,067 | 972 |
| Native comparison / Muse / native | 385,402 | 71,567 | 59,861 | 19,213 | 570 |
| Native comparison / Muse / checked | 259,209 | 47,232 | 65,956 | 24,510 | 553 |
| Native comparison / GLM / native | 227,040 | 158,464 | 25,324 | 1,174 | 1,209 |
| Native comparison / GLM / checked | 204,101 | 115,136 | 41,027 | 2,492 | 664 |
| Current repeat / Muse / baseline | 264,368 | 39,925 | 44,189 | 16,554 | 368 |
| Current repeat / Muse / recipe | 212,975 | 18,616 | 39,287 | 15,257 | 326 |
| Current repeat / GLM / baseline | 61,029 | 106,176 | 14,337 | 170 | 248 |
| Current repeat / GLM / recipe | 58,344 | 118,144 | 16,322 | 796 | 258 |
| Current repeat / Ling / baseline | 151,964 | 158,976 | 42,408 | 11,215 | 248 |
| Current repeat / Ling / recipe | 160,791 | 224,320 | 48,821 | 13,192 | 354 |

</details>

<details>
<summary>Earlier application pilot: completion parity with a cost penalty</summary>

September 19 corrected AppWorld pilot: **six development tasks × three repetitions = 18 attempts per approach, 36 total**. Both paths used the same validation policy after fixing a timestamp-compatibility mismatch in the first pilot. Preserve upstream strict grading; one direct attempt passed task grading but stopped at a budget guard and remains a strict failure.

| Approach | Strict success | Requests/attempt | Tokens | Elapsed time | Total estimated $ | $/strict success |
| --- | --- | --- | --- | --- | --- | --- |
| Direct tools | 15/18 | 12.3 | Not available in the published v3 summary | Not measured per attempt | $0.1380 | $0.0092 |
| Checked Strata | 15/18 | 6.1 | Not available in the published v3 summary | Not measured per attempt | $0.2113 | $0.0141 |

Typed composition halved model requests but cost more per success. Declaration overhead is a plausible explanation, not an isolated causal result. Separate exact effect-correctness and complete backend-invocation counts are unavailable in the published v3 summary; metadata/policy logs do not prove all effects were task-authorized. Earlier v2 counts must not be substituted for v3. These reused development tasks do not establish generalization. [Versioned results and limits](.work/issues/046-post-parity-comparison-v3.md).

</details>

<details>
<summary>Earlier repository trials: no demonstrated overall advantage</summary>

The historical held-out stage used **six task instances × two repetitions = 12 attempts per profile, 36 total**, with Muse Spark and reasoning off. These tasks are now inspected regression material. Primary overall success includes answer, policy and harness requirements; exact answer correctness is supplementary. The tasks are read-only, and no separate final-state effect score was recorded.

| Profile | Overall success | Exact answers | Requests/attempt | Tokens/attempt | Median seconds | $/attempt | $/success |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stock Pi | 12/12 | 12/12 | 4.17 | 11,682 | 9.37 | $0.000842 | $0.000842 |
| Typed QuickJS | 12/12 | 12/12 | 3.92 | 31,397 | 12.25 | $0.001892 | $0.001892 |
| Typed Bun | 11/12 | 11/12 | 4.25 | 34,932 | 12.60 | $0.002081 | $0.002271 |

Total input/cache-read/output tokens were 63,724/58,370/18,088 for stock, 182,880/173,517/20,368 for QuickJS and 196,749/197,905/24,536 for Bun. Cache writes were zero; separate reasoning counts are unavailable in this export. Capability invocations were unmeasured for stock, 108 for QuickJS and 106 for Bun. Failed attempts remain in every average and cost per success.

The full report records other stages, policy/harness limitations and an accounting discrepancy between estimated ledger spend and account-level usage. Later compact-declaration development gains did not survive confirmation. [Repository report](docs/repo-trials.md); [sanitized stage/cell evidence](docs/evaluations/repo-2-2026-09-06.json).

</details>

## What would justify further work?

The strongest next step would be one concrete recurring workflow across unfamiliar services, with enough intermediate data to make composition relevant. A read-only reconciliation or reporting task could test usefulness without requiring a general business-action completion framework. Compare checked Strata with native Pi Codemode and ordinary scripts on equivalent data and access. If testing reuse, let both approaches store their programs/scripts and include authoring, retrieval and adaptation in total cost. [Reuse hypothesis](.work/issues/047-stored-program-reuse.md).

For further learning without such a use case, [checking attribution](.work/issues/055-checking-attribution.md) is a separate bounded research question: keep declarations, prompts, runtime validation and limits constant while varying the semantic gate on new workflows. It is not a prerequisite for every continuation. A hybrid retaining familiar tools is also a hypothesis, not a demonstrated product outcome; an extra interface could add overhead as well as useful choice.

Before stronger effectful claims, investigate [062](.work/issues/062-top-level-main-invocation.md)'s extra entry-point invocation. Pursue [063](.work/issues/063-effectful-completion-evidence.md)'s caller-defined completion evidence only if a selected workflow requires it. These are conditional paths, not a mandatory framework-building sequence. The [continuation proposal](.work/issues/065-conditional-continuation.md) records the working order and stopping conditions.

The completed AppWorld study supports retaining the pause. Pi now covers much of the orchestration idea; additional Strata work would need a concrete caller who benefits from stronger contracts, or a separately selected checking-attribution question. The goal remains learning which pieces earn their complexity. No further implementation or paid experiment is selected.

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

The package pins Pi 0.73.1. Earlier benchmarks used installed Pi 0.99.1; the latest AppWorld study uses Pi 1.0.0 through experiment adapters. Neither certifies every full-extension feature on those versions.

To try the extension with a model, configure Pi's model credentials and run `bun run pi`. Model use may incur provider charges.

The [prototype guide](docs/prototype-guide.md) covers Pi usage, connecting an MCP server, configuration, tests and benchmark commands.

## Read further

- [How it works](docs/how-it-works.md), [architecture](ARCHITECTURE.md) and [prototype guide](docs/prototype-guide.md) — execution, trust boundaries and setup.
- [Results and recovery](docs/results-and-recovery.md) — final JSON selection, action receipts and their limits.
- [AppWorld versus Pi 1.0](docs/application-study.md), [composition comparison](docs/composition-benchmark.md), [tuning results](docs/strata-tuning-results.md) and [third-model repeat](docs/third-model-portability.md) — measured results and sanitized evidence.
- [Repository trials](docs/repo-trials.md) and [corrected application pilot](.work/issues/046-post-parity-comparison-v3.md) — earlier negative/inconclusive results.
- [Checking-policy comparison](docs/checking-policy-comparison.md) — declarations versus checking, controlled prevention and recovery tests.
- [Architectural direction](ACD.md), [evaluation principles](docs/benchmarking-principles.md) and [related research](docs/research/typed-agent-prior-art.md) — hypotheses and comparison design.
- [Issue board](.work/issues/index.md) and [handoff](docs/handoff.md) — decisions, deferred work and current state.

Plans and issues live in the tracked `.work/issues/` directory. Raw experiment transcripts, credentials, downloaded datasets and generated artifacts stay local.
