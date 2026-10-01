# Later related work: Pi Codemode and MCP

Documentation update: 2026-10-01. This note compares a public announcement and discussion with Strata's recorded evidence. At initial capture on September 30, no current Pi implementation inspection or experiment had been performed. The subsequently authorized [049 pilot](../checking-policy-pilot.md) inspected installed Pi 0.99.1 and completed 36 synthetic model trials; the package dependency pin was not upgraded. The October 1 review adds interpretation of that same run, without new model calls. The announcement-to-original-experiment chronology below remains intact.

## Chronology

- Strata's initial implementation and prior-art notes date to 2026-09-05, using Pi **0.73.1**.
- The corrected application comparison (046) completed on 2026-09-19; the research wrap-up recommended pausing on 2026-09-22.
- Earendil published [“You Said No MCP!”](https://earendil.com/posts/you-said-no-mcp/) on **2026-09-29**, describing MCP and Codemode in Pi's core. The linked [Hacker News discussion](https://news.ycombinator.com/item?id=49906637) followed on September 30.

This Pi announcement came after the original recorded Strata experiments. It is later related work, not a source that informed the initial design or a baseline in the original comparisons. The subsequent September 30 pilot did test native Pi Codemode. There is no evidence that Strata influenced Pi. Code-based tool composition already had earlier precedents, including [Cloudflare's September 2025 Code Mode post](https://blog.cloudflare.com/code-mode/); chronology does not establish originality.

## Architectural relationship

Earendil describes a harness-side JavaScript sandbox for composing tool calls, structured outputs for programmatic processing, deferred tool exposure and session-managed state. These overlap with Strata's capability functions, local intermediate-data processing and selective loading. The announcement does not establish an equivalent to Strata's pre-execution TypeScript semantic-checking gate. This is a limit of the source, not a claim that current Pi lacks checking. [Announcement](https://earendil.com/posts/you-said-no-mcp/)

Strata's implemented distinctions are recorded in [ARCHITECTURE](../../ARCHITECTURE.md): generated declarations, semantic checking, runtime schema validation, a protocol-independent broker and replaceable executors. Programs have fresh execution state; persistent compiler infrastructure is not persistent program data. No modern Pi performance or security comparison follows from this architectural overlap.

## What Strata adds to the discussion

**Measure total work, including the interface.** The corrected application comparison achieved 15/18 strict successes in each arm. Typed composition used 6.1 model requests per task versus 12.3 direct, but cost $0.0141 per success versus $0.0092. Direct tools were cheaper on every tested task, including aggregation. Definitions, generated code and repairs belong in the accounting alongside intermediate results. Declaration overhead is a plausible explanation, not an isolated causal result. See [046](../../.work/issues/046-post-parity-comparison-v3.md) and the [evaluation summary](../evaluation-summary.md).

**Keep the scripting baseline capable.** [wren6991](https://news.ycombinator.com/item?id=49906911) questions why agents need another composition mechanism when they have shell scripts. [Armin](https://news.ycombinator.com/item?id=49907603) distinguishes shell execution from harness-tool orchestration; [statenjason](https://news.ycombinator.com/item?id=49907956) describes exposing MCP through a CLI bridge. Strata's comparisons must allow ordinary scripts and equivalent backend access. Its repository results establish no overall advantage over the familiar tools tested; they do not establish a training-familiarity explanation.

**Contracts must describe real responses.** [andrewingram](https://news.ycombinator.com/item?id=49907846) asks what remains difficult to compose with code. Strata's timestamp compatibility bug supplies a concrete example: different validation policies distorted completion results. Fixing parity recovered completion but not cost efficiency. Structured data and valid schemas do not resolve business meaning, pagination or cross-service identifiers automatically.

**Separate checking from authority.** [magnio](https://news.ycombinator.com/item?id=49907715) discusses type checking; [coder-pm](https://news.ycombinator.com/item?id=49908068) asks about sandbox boundaries and credentials. Strata distinguishes semantic checking, runtime validation, broker authorization and execution containment. Its Bun option retains checking and broker mediation while allowing ambient host authority. The prototype is not a hardened hostile-code service.

**Keep unanswered questions explicit.** Both application arms preloaded operations, so the experiment says nothing about large-catalog discovery. The later pilot demonstrated stored-workflow replay feasibility, but recurrence, retrieval and amortized value remain untested. Protocol-independent composition does not settle the MCP-versus-OpenAPI ecosystem debate. Small samples, mostly one model and unmeasured application latency limit the result.

## What the subsequent run adds

Native Pi Codemode passed 6/6 small natural tasks, and each Strata checking policy passed the same number. Inspection of the installed Pi 0.99.1 worker found declarations supplied to the model and JavaScript execution without a pre-execution semantic gate in the inspected path. The three Strata profiles needed no semantic diagnostics for their naturally generated programs. This supports treating API descriptions and compiler enforcement as separate design choices, while leaving the value of descriptions themselves unmeasured.

The seeded mistakes make the checking discussion more concrete: early checking prevented a simulated write before a later field error and caught a typo that returned a wrong empty list. Deferred checking explained a thrown error after the write but never activated for the empty result. Compiler-free recovery succeeded with explicit verification prompts and observed state; it did not establish unattended detection or replay safety. These are narrow mechanism and recovery results, not evidence that one whole system is generally superior. See the [expanded pilot lessons](../checking-policy-pilot.md#what-we-learned-from-the-run).

## Questions recorded before the follow-up

The following proposals were captured before the user authorized 049. That pilot delivered the bounded checking experiment and native Pi baseline, with a model-free reuse feasibility probe. Wider confirmation, recurrence/retrieval and production changes remain unselected:

1. [021 — Semantic-checking ablation](../../.work/issues/021-code-mode-checking.md): isolate checking while retaining identical declarations, broker validation, policy and execution. Include successful programs, recoverable mistakes and simulated partial-effect cases. A deterministic probe can establish mechanism behavior; model-driven repair trials are needed to measure practical value.
2. [047 — Stored program reuse](../../.work/issues/047-stored-program-reuse.md): if a recurring workflow exists, compare stored parameterized programs with stored scripts, counting first authoring, retrieval and adaptation. A small local driver is enough for a pilot; a production workflow library is not a prerequisite.
3. [048 — Modern Pi Codemode baseline](../../.work/issues/048-modern-pi-codemode-baseline.md): if a whole-system comparison is selected, inspect and pin current Pi before designing matched capabilities, permissions and accounting. A modern native baseline changes the comparison question; upgrading Strata is not automatically necessary.

The [board](../../.work/issues/index.md) owns selection and dependencies. The announcement did not itself authorize work; the user separately selected the completed 049 pilot. Its results do not overturn the original application comparison or select another campaign.
