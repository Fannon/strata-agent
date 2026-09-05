# Next-agent handoff

Updated 2026-09-05 after benchmark repair `1513917`; implementation/verification claims refer to that revision. Recheck current Git status and coordinate concurrent edits before starting. The user requested a return to planning/architecture/documentation after completing and pushing that repair. Remaining implementations are recommendations awaiting selection, not an instruction to start every issue.

## Read in this order

1. [AGENTS.md](../AGENTS.md): local work-selection rules.
2. [README](../README.md): value proposition and shipped scope.
3. [ACD](../ACD.md): proposed contracts, alternatives and trust boundaries.
4. [Benchmark runner](benchmark.md) and [evaluation plan](evaluation.md): delivered machinery versus future comparisons.
5. Local `.work/HANDOFF.md`, `.work/issues/index.md` and revised `020-next-sequence.md`, if present. `.work/` is gitignored; this document preserves the essential sequence for fresh clones.

## Delivered and verified

The Pi extension provides checked fresh TypeScript programs, a multi-module policy/validation broker, MCP/CLI fixtures and lexical catalog search/load. Native filesystem/search/Git APIs, parameter-aware filesystem grants and mechanically strict tool profiles are not built.

The fixture runner now uses independent exact answer oracles and complete Pi event traces. It separates correctness, tool adherence, harness health and accounting; incomplete executions cannot be completed successes. Cold repeats have unique artifacts and rotated condition order. Conservative reservations precede each model request; failed receipt writes stop dispatch. Missing usage remains null. Requests, effective prompts, task/source hashes, pricing and every cell's outputs/verdicts are retained locally. No automatic retries or fallback models.

Typecheck and 53 tests pass. A real pinned Pi CLI is exercised against a loopback fake SSE provider, including compile rejection, successful typed recovery and refusal before an excess request. No paid v2 benchmark was run. The old 9/12 fixture pilot remains historical evidence and does not establish product advantage.

```sh
bun run check
bun test
bun examples/benchmark.ts --dry-run --cells T1:A,T1:B,T1:C --repeats 3
```

Tests need permission for localhost and subprocesses. Dry run is offline and writes no artifacts. Live execution must use explicit `--run` and `--max-cost-usd`; see the runner contract before choosing a budget. Reservations can stop a run well below actual spend and are not a billing guarantee.

## Recommended next implementation

**First select local issue 016: Pi cancellation forwarding.** The shared helper in `src/pi/extension.ts` accepts only ID/params, then calls `session.run(source, {})`; Pi's third execute argument is the abort signal. Direct runtime cancellation tests pass but don't cover this integration. Add registered-tool pre-aborted and mid-call tests, forward the signal if still absent, and verify a subsequent program succeeds. If already fixed in a newer checkout, prove it and close the issue. The benchmark's process timeout does not fix interactive cancellation.

Then select **012A scoped reads**, followed by **011's smallest useful repository slice**. Start with bounded text reading, literal search and Git status on a seeded repository. Define allowed roots, file kinds, symlink behavior, ignored files, completeness and byte/concurrency caps. Native Bun calls live in trusted adapters behind the broker. Canonical path checks alone are not a hardened filesystem sandbox.

Make the task match the API: package fields, named-symbol locations and staged/unstaged/untracked status fit that slice. Full trees/history additionally need listing/log operations. Compare stock Pi, typed-plus-stock-tools, and typed-only with every direct effect alternative mechanically removed. Hybrid versus strict tests shell removal; stock Pi is necessary to assess improvement over ordinary agent work. One run diagnoses wiring; seeded variants/repeats and held-out tasks are needed for claims.

## Architectural guardrails and deferred ideas

Preserve Strata's intentional choices: checked TypeScript, composable domain APIs, Bun-backed native implementation where useful, mature argv adapters where semantics justify them. Avoid cloning Unix flags or assuming subprocess-free execution is the goal. Compile-time types, runtime schema validation and resource authorization are different safeguards.

[Prime research](research/typed-agent-prior-art.md) covers persistent IPython, bash support and host-owned orchestration. The user's local checkout is `/home/fannon/dev/_analyze/prime-agent`, verified at `5c2750bdc3c99cc4225c1167a3484371a7a221ab`; recheck before new analysis. Study useful ideas without treating Python state as Strata's target architecture.

[Cloudflare Code Mode](research/code-mode.md) is direct prior art for tools-as-code. A later semantic-checking ablation should keep the same API, runtime, validation and permissions. Disabling checking in Strata is not an actual Cloudflare benchmark.

Bash sandboxing alone leaves direct read/write/edit tools outside the broker. Catalog snapshots do not undo external effects or define in-flight revocation. Keep OS sandboxing, unload/rollback, persistence and dependency/supersession solving conditional until measured needs justify them. Session mining remains a separate bounded local study; do not publish raw private transcripts or execute recorded commands.

If useful native tasks show no benefit after bounded tuning and fair baselines, narrow, pivot or stop. Learning about Pi and harness design is an intended outcome, not a reason to force a positive benchmark.
