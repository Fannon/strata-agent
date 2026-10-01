# 021 — Cloudflare Code Mode prior art and semantic-checking ablation

Status: bounded checking-policy pilot delivered through 049 on 2026-09-30; broader confirmation and Cloudflare comparison remain deferred
Kind: experiment design
Source: user link https://blog.cloudflare.com/code-mode/
Dependencies: 009A complete; use meaningful 011 tasks before measuring product value.

## Evidence and implication

September 30 delivery: [049](049-checking-policy-pilot.md) compared always/never/after-failure policies on installed Pi 0.99.1, with identical declarations and runtime validation. All achieved 6/6 natural-task and 4/4 seeded-repair successes; always-check rejected no naturally generated programs. Early checking prevented simulated partial effects and caught a successful-looking wrong result, while never-check recovered without compiler diagnostics. After-failure did not activate on the silent wrong result. This small synthetic development pilot is not confirmation, a declarations-value ablation or a Cloudflare benchmark. See the [report](../../docs/checking-policy-pilot.md). Historical proposals below are preserved; the development harness now exists under `examples/checking/`, without a production unchecked mode.

[Research](../../docs/research/code-mode.md) records that code-based tool composition and intermediate-data reduction are shared prior art. Current inspected Cloudflare paths supply TypeScript declarations but execute generated JavaScript; they do not establish Strata's semantic compile-before-execution gate. This is a scoped source observation, not a claim about all Cloudflare integrations.

Strata should test the incremental benefit of its type checker, deliberate APIs, and Bun-backed local implementations. Keep the local architecture; Code Mode does not imply adopting Workers or dropping the broker. Loading declarations, validating schemas, checking code and authorizing effects are distinct responsibilities.

## Historical proposal before pilot authorization

September 30 candidate refinement, prompted by [Pi's later Codemode announcement](../../docs/research/pi-codemode-2026-09.md): begin with a bounded check-versus-no-check question using Strata's existing compiler, broker, executor and traces.

- Include valid programs, detectable argument/result-use mistakes, and a mistake after an earlier simulated write. Add negative controls for validly typed but wrong business logic and runtime-only response mismatches.
- Use a resettable in-memory effect fixture; do not perform real external writes.
- Build a small development-only harness that bypasses semantic checking while retaining syntax/import restrictions, schema validation, authorization and the same executor. No unchecked session mode currently exists.
- Deterministic replay establishes coverage and effect accounting, not model repair efficiency or a product win. Only if that probe reveals a useful distinction should a separately selected, budgeted model comparison measure repair and total cost.

At capture, this proposal was backlog and no implementation or trial was selected. The user subsequently authorized the bounded pilot delivered in 049; broader confirmation remains unselected.

### User hypothesis: declarations with optional checking (2026-09-30)

The user asks whether TypeScript descriptions supply most of the useful information while sufficiently capable models compose programs without a semantic check, and whether checking could instead be used only after a script fails. This is a refinement of the checking experiment, not authorization to change execution behavior.

Compare three policies with identical model-facing declarations, source language, syntax/import restrictions, broker validation, grants and executor:

| Policy | Execution and feedback |
| --- | --- |
| Always check | Run semantic checking before execution; reject diagnosed programs before any capability call. |
| Never check | Transpile without semantic checking and execute; return ordinary execution/broker feedback. |
| Check after failure | Execute without the semantic gate; on a code or contract failure, check the original source against the declarations used for that attempt and include relevant diagnostics with the runtime feedback. Do not automatically execute the source again. |

Hypotheses: good first-attempt programs may make the gate redundant; delayed diagnostics may support repair with less checking work; early checking may still prevent calls or partial effects that a later diagnostic cannot undo. Opposing hypothesis: additional compiler diagnostics may distract from the actual runtime failure or introduce unnecessary repairs.

Keep declaration-token costs separate from compiler time and diagnostic-induced model requests. Removing the semantic gate does not remove declarations from the prompt, so the historical context-cost gap is not evidence that disabling checks would close it. The existing results do not isolate the checker, and the timestamp parity bug concerned runtime output validation, not TypeScript diagnostics.

Include failures on untaken branches, successful-looking wrong outputs that do not trigger delayed checking, correctly typed business mistakes, and runtime-only data mismatches. Transport failures, permission denials and timeouts need their own feedback; they should not automatically trigger semantic analysis. Count diagnostics that help, irrelevant diagnostics, repair attempts, task correctness, total cost, latency and completed effects before failure. Use simulated writes with known expected state; grants alone do not prove task correctness. Replay safety must be explicit because a failed program can have completed earlier effects.

The production implementation combines diagnostics and emission in `Workspace.compile()` and always checks in `session.run()`. These policies are now available in the experiment-only harness delivered in 049; none is an exposed production option. Any further model comparison requires separate selection and a frozen matrix.

- [ ] Pin relevant Cloudflare source/docs and identify the particular behavior under comparison.
- [ ] Design a development-only always/never/after-failure comparison with the same Pi/model, API declarations, runtime, schemas, policy and tasks. Change semantic-check timing/feedback only; never disable runtime validation/authorization.
- [ ] Keep generated program style/imports/output and token accounting comparable; report diagnostics, retries, attempted/executed effects, correctness and latency.
- [ ] Use development tasks for setup and held-out tasks for conclusions. Include good first-attempt programs where checking is overhead, and invalid programs where it may prevent failed effects.
- [ ] Decide whether checking earns its cost. If evaluating actual Cloudflare, add a separately pinned whole-runtime arm; an unchecked Strata arm is not a faithful Cloudflare benchmark.

Acceptance: controlled comparison and explicit retain/revise decision. No automatic move to persistent state, durable approvals, new retrieval machinery or remote hosting from this research alone.
