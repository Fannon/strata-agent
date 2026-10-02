# strata-agent

> **Experimental research project.** Strata is built to learn, test ideas and establish proofs of concept. It is unfinished and not production-ready. Negative and inconclusive results are part of the output.

Strata asks: **can an AI agent work more reliably or efficiently when its tools are typed functions it can compose into a program?**

Instead of sending every tool response back to the model, the agent writes a small TypeScript program that calls tools, passes data between them, filters or joins the results, and returns a compact answer. Types describe each function's inputs and outputs; checking can catch some mistakes before the program takes any actions.

The intended value is less raw data in model context, fewer model round trips for dependent work, and earlier feedback on contract errors. Writing code, reading declarations and repairing type errors also cost tokens and time. The experiment is whether those benefits earn the extra machinery against equally capable direct tools and ordinary scripts.

Today this is a **Pi extension hosted by Bun**, with a shared capability layer and a restricted QuickJS execution environment. The broader idea is one composable interface over local tools and remote services. Code-based tool orchestration already has [prior art](docs/research/typed-agent-prior-art.md); Strata's particular experiment combines schema-derived TypeScript functions, checking before execution, runtime validation and explicit result/action evidence.

**Current assessment (October 2, 2026): the mechanism works; its task-level value is conditional.** There is a promising cost result with Muse Spark on synthetic service workflows, but no general speed, cost or reliability advantage. GLM incurs more repair work in the native-Pi comparison, earlier repository/application work did not establish an overall win, and a third-model repeat still produced correct-looking answers that omitted required actions. The evidence below separates working mechanisms from demonstrated performance and remaining hypotheses.

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
- **Checking can prevent contract mistakes before effects.** Controlled broken-script tests caught a nonexistent result field before an earlier simulated payment ran, and a typo that otherwise silently returned an empty answer. Later models also generated programs rejected before any calls from those programs. The useful property is early feedback on the whole program, including mistakes after a planned write. Some rejections concern strict typing that JavaScript would tolerate; the net benefit of the compiler alone has not been isolated. [Checking-policy lessons](docs/checking-policy-pilot.md#what-we-learned-from-the-run).
- **The shared capability layer works across transports.** MCP and CLI connectors use the same declaration/compiler/broker path. Runtime schemas and permissions remain enforced independently of static types. This supports the feasibility of a common interface; it does not establish that every tool should be wrapped or that integration is effortless. [Architecture](ARCHITECTURE.md).
- **Computed results and action evidence are useful explicit contracts.** `typed_program` with `finalize: true`, or `finalize_result`, lets the host deliver selected JSON without model reconstruction. `program_effects` exposes retained action receipts for inspection after errors. Tests verify these behaviors, and the latest real-model repeat used them. A broker-accepted reply is an acknowledgement, not independent proof of the requested business outcome. [Usage, verification and limits](docs/results-and-recovery.md).

The clearest measured efficiency signal is Muse's synthetic composition result below. A short shared programming recipe also helped in an initial tuning experiment, but its efficiency benefit did not generalize across all models on the current implementation. It remains an experimental profile, with no model-specific branches. [Tuning report](docs/strata-tuning-results.md).

## Where Strata falls short

**Fewer interactions do not guarantee lower cost or faster completion.** Declarations consume context, generated programs consume output tokens, and repairs add model requests. In earlier repository work there was no demonstrated overall advantage; initial gains from compact declarations did not survive confirmation. The corrected application pilot reached equal completion with direct tools but retained a cost penalty. Those negative results remain relevant alongside the later positive synthetic signal. [Repository evidence](docs/repo-trials.md); [application evidence](.work/issues/046-post-parity-comparison-v3.md).

**Type-safe code can still do the wrong work.** Models can fetch only the first page, apply the wrong business rule, omit required writes, or return extra fields. `any` and assertions can erase useful checks. In the latest repeat, two Ling attempts computed the correct credit answer without issuing the credit action. Exact JSON delivery faithfully delivered those answers; receipts did not force completion. Independent answer and final-state grading are necessary.

**Recovery is assisted, not solved.** Receipts help distinguish acknowledged actions from uncertain ones, but a model must choose to inspect and correctly interpret state before retrying. Evidence is bounded and in memory; restarting clears it. Stronger caller-defined completion evidence and accidental extra entry-point invocation are recorded as deferred issues [063](.work/issues/063-effectful-completion-evidence.md) and [062](.work/issues/062-top-level-main-invocation.md).

**The evidence is limited.** Recent workflows are synthetic, task-relevant functions are preloaded, and model/provider/cache behavior varies. Older application trials reuse development tasks. Whole-system comparisons do not isolate checking from declaration rendering, prompts, runtime limits or feedback. The newest repeat adds a model, but reuses tasks and has no native-Pi arm. We have not established a general advantage on real services, large catalogs or arbitrary coding tasks.

## Evidence at the current checkpoint

A **turn means one model request**; capability invocations are counted separately. All-attempt averages, elapsed times and cost per success include failures. Tokens sum uncached input, cached input and output; reasoning is already within output and is never added again. Costs are estimates from captured usage and catalog rates, not provider bills.

Primary **answer + state** success requires completion, the requested JSON content and exact resulting effects; one unambiguous JSON fence is accepted. **Strict JSON** additionally requires an unwrapped answer. Separate effect scores do not replace primary grading: an unchanged read-only world can be effect-correct while its answer is wrong.

### Native Pi Codemode versus checked Strata

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
<summary>Token breakdowns and separate capability invocations for the two comparisons</summary>

These are totals per row, including failures. Input excludes cache reads. Cache writes were zero; reasoning is a subset of output. Capability invocations include unsuccessful calls and repeated work; they are not model turns.

| Experiment / model / profile | Input | Cache read | Output | Reasoning within output | Capability invocations |
| --- | --- | --- | --- | --- | --- |
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

A concrete workflow where unfamiliar APIs, substantial intermediate data or recurring composition make the tradeoff worth testing. A fair comparison should retain the baseline's ordinary scripts and direct tools, measure discovery separately, verify actual effects, and confirm on untouched tasks. Uniform versus hybrid interfaces, large-catalog discovery, stored-program reuse and checking attribution remain separate hypotheses on the [issue board](.work/issues/index.md).

The project is at a research checkpoint. The goal is to learn which pieces are useful and where they earn their complexity, rather than complete a universal agent platform. No additional implementation or paid experiment is selected by this documentation review.

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

The package pins Pi 0.73.1. Recent benchmarks used installed Pi 0.99.1 with experiment adapters; they do not certify every full-extension feature on that version.

To try the extension with a model, configure Pi's model credentials and run `bun run pi`. Model use may incur provider charges.

The [prototype guide](docs/prototype-guide.md) covers Pi usage, connecting an MCP server, configuration, tests and benchmark commands.

## Read further

- [How it works](docs/how-it-works.md), [architecture](ARCHITECTURE.md) and [prototype guide](docs/prototype-guide.md) — execution, trust boundaries and setup.
- [Results and recovery](docs/results-and-recovery.md) — final JSON selection, action receipts and their limits.
- [Composition comparison](docs/composition-benchmark.md), [tuning results](docs/strata-tuning-results.md) and [third-model repeat](docs/third-model-portability.md) — measured results and sanitized evidence.
- [Repository trials](docs/repo-trials.md) and [corrected application pilot](.work/issues/046-post-parity-comparison-v3.md) — earlier negative/inconclusive results.
- [Checking-policy comparison](docs/checking-policy-comparison.md) — declarations versus checking, controlled prevention and recovery tests.
- [Architectural direction](ACD.md), [evaluation principles](docs/benchmarking-principles.md) and [related research](docs/research/typed-agent-prior-art.md) — hypotheses and comparison design.
- [Issue board](.work/issues/index.md) and [handoff](docs/handoff.md) — decisions, deferred work and current state.

Plans and issues live in the tracked `.work/issues/` directory. Raw experiment transcripts, credentials, downloaded datasets and generated artifacts stay local.
