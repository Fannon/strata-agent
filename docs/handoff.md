# Next-agent handoff

**Architecture update (takes precedence over older sequencing below):** The enduring architecture is the typed capability layer: discoverable contracts, semantic checking, composable repository/API/MCP functions, runtime validation, permission-aware implementations and observability. The execution engine is an implementation choice. QuickJS remains the implemented baseline; direct Bun is a first-class planned alternative, without a prerequisite to prove QuickJS is slow. Execution containment is a separate concern. This documentation decision does not itself implement or select a runtime migration. Next planning sequence: minimal 026 tracing and the 027 executor comparison are delivered with deterministic checks (see docs/executors.md); next is matched repository trials under an explicit budget. Full observability and a new sandbox are not prerequisites. Preserve completed results and do not redo completed cancellation/read work.

Updated 2026-09-05 after import-alias `4875c8c`; implementation/verification claims refer to that revision. Recheck current Git status and coordinate concurrent edits before starting. The user requested a return to planning/architecture/documentation after completing and pushing that repair. Remaining implementations are recommendations awaiting selection, not an instruction to start every issue.

## Read in this order

1. [AGENTS.md](../AGENTS.md): local work-selection rules.
2. [README](../README.md): value proposition and shipped scope.
3. [ACD](../ACD.md): proposed contracts, alternatives and trust boundaries.
4. [Benchmark runner](benchmark.md) and [evaluation plan](evaluation.md): delivered machinery versus future comparisons.
5. Local `.work/HANDOFF.md`, `.work/issues/index.md` and revised `020-next-sequence.md`, if present. `.work/` is gitignored; this document preserves the essential sequence for fresh clones.

## Delivered and verified

The Pi extension provides checked fresh TypeScript programs, a multi-module policy/validation broker, MCP/CLI fixtures and lexical catalog search/load. Capability modules import as `@c/<id>` (`@cap/<id>` remains accepted). A native read-only repository capability (`readText` with line ranges, `searchText` with glob filters, `listFiles`, fixed-argv `gitStatus`/`gitLog`/`gitDiff`/`gitShow`) enforces root scoping and byte/match/file caps in trusted host code; `STRATA_STRICT=1` blocks direct file/shell tools for typed-only comparisons. Truncated scans carry narrowing hints; truncated samples are deterministic but not global prefixes. Executors (default QuickJS, opt-in direct Bun) share contracts, checking, validation and tracing — see [executors](executors.md). Parameter-aware mutation grants and persistent typed state are not built.

The fixture runner now uses independent exact answer oracles and complete Pi event traces. It separates correctness, tool adherence, harness health and accounting; incomplete executions cannot be completed successes. Cold repeats have unique artifacts and rotated condition order. Conservative reservations precede each model request; failed receipt writes stop dispatch. Missing usage remains null. Requests, effective prompts, task/source hashes, pricing and every cell's outputs/verdicts are retained locally. No automatic retries or fallback models.

Typecheck and 127 tests pass, including both executors on all repository operations and four executable reference workflows (`examples/repo-workflows.ts`: search→read-lines, broad→narrow search, status→diffs, log→show, byte-identical on QuickJS and Bun). A 27-cell feasibility pilot (3 seeded repo tasks × stock/typed+tools/typed-only × 3 repeats, muse-spark-1.3-contributor, $0.013) solved every cell; typed arms used only `typed_program`, stock used read/bash. Mean tokens: stock ≈2.8k, typed-only ≈4.7k, hybrid ≈5.7k — declarations dominate on tiny payloads, so no cost advantage at this scale. Wiring evidence only: tasks are easy and the strict arm met no temptation. A later 27-cell three-setup trial (stock / typed-QuickJS / typed-Bun, $0.0117) repeated the ceiling: engines do not affect outcomes on easy tasks. A real pinned Pi CLI is exercised against a loopback fake SSE provider, including compile rejection, successful typed recovery and refusal before an excess request. No paid v2 fixture benchmark was run. The old 9/12 fixture pilot remains historical evidence and does not establish product advantage.

```sh
bun run check
bun test
bun examples/benchmark.ts --dry-run --cells T1:A,T1:B,T1:C --repeats 3
```

Tests need permission for localhost and subprocesses. Dry run is offline and writes no artifacts. Live execution must use explicit `--run` and `--max-cost-usd`; see the runner contract before choosing a budget. Reservations can stop a run well below actual spend and are not a billing guarantee.

## Recommended next implementation

Cancellation forwarding and the initial scoped repository slice are delivered (814ffe2, 7dd1a9e); the tool profile and repository pilot followed in 529c5fd. Preserve those baselines rather than repeating the old cancellation → reads sequence.

Select **027: replaceable executor and direct Bun comparison**, with the minimal correlation/timings from **026**. Both are now delivered (see below); the remaining step is matched task trials, not more machinery. The executor comparison keeps contracts, semantic checking, broker validation, adapter policy and fresh execution matched. Direct Bun runs opt-in (`STRATA_EXECUTOR=bun`) in a disposable worker/process behind the shared executor interface; QuickJS remains the default. A worker does not itself constrain filesystem/network access. Label cooperative API adherence separately from mechanically enforced exclusivity; disabling Pi tools alone is insufficient for the latter in Bun. See [docs/executors.md](executors.md).

Delivered 2026-09-06: minimal 026 tracing (versioned program/call/load events, per-call durations, `denied`/`cancelled` categories, opt-in JSONL sink, trace-summary example) and the 027 executor (shared checking/validation/policy, 12 parity tests incl. an ambient-write canary, deterministic offline comparison in `examples/executor-compare.ts`). Results: identical contracts on both engines, byte-identical error categories, matching cancellation/timeout/recovery; Bun is tens of ms faster per run (noise against model latency); tracing overhead is within noise; the canary proves Bun measures adherence, not containment. Raw comparison JSON stays local (`.work/`). No paid model trials ran.

Next: the 028 sequence — evaluator hardening first (still the prerequisite to any paid comparison), then a versioned task corpus reusing the delivered read/diff/history operations, then bounded trials. The list/log-style operations harder tasks need are now delivered, so API gaps no longer block task design. Full observability, a new sandbox and evidence that QuickJS is slow are not prerequisites. Broader engine/persistence/typechecking combinations remain separate experiments.

Delivered 2026-09-06 (repository usability): bounded `readText` line ranges (`fromLine`/`maxLines`/`nextLine`, byte-identical full reads preserved), `searchText` include/exclude globs with truncation hints, `listFiles` + `gitLog` from the earlier slice, and Git change inspection (`gitDiff` staged/unstaged, `gitShow` at HEAD/SHA, `gitLog` per-commit files) sharing one controlled spawn helper. Four executable reference workflows (`examples/repo-workflows.ts`) pass byte-identical on QuickJS and Bun; 127 tests green. Remaining coverage gaps: no stat/line-count op (tail needs a full read), literal-only single-pattern search, no glob filter on listings, worktree-only diffs (no commit-range diff), subject-only log messages, no file ranges on show, branch/tag revisions excluded by design, and no edits/checks/approvals. Pilot allow-lists do not include the new operations yet — that comes with task-corpus work.

## Architectural guardrails and deferred ideas

Preserve Strata's intentional choices: checked TypeScript, composable domain APIs, Bun-backed native implementation where useful, mature argv adapters where semantics justify them. Avoid cloning Unix flags or assuming subprocess-free execution is the goal. Compile-time types, runtime schema validation and resource authorization are different safeguards.

[Prime research](research/typed-agent-prior-art.md) covers persistent IPython, bash support and host-owned orchestration. The user's local checkout is `/home/fannon/dev/_analyze/prime-agent`, verified at `5c2750bdc3c99cc4225c1167a3484371a7a221ab`; recheck before new analysis. Study useful ideas without treating Python state as Strata's target architecture.

[Cloudflare Code Mode](research/code-mode.md) is direct prior art for tools-as-code. A later semantic-checking ablation should keep the same API, runtime, validation and permissions. Disabling checking in Strata is not an actual Cloudflare benchmark.

Bash sandboxing alone leaves direct read/write/edit tools outside the broker. Catalog snapshots do not undo external effects or define in-flight revocation. Keep OS sandboxing, unload/rollback, persistence and dependency/supersession solving conditional until measured needs justify them. Session mining remains a separate bounded local study; do not publish raw private transcripts or execute recorded commands.

If useful native tasks show no benefit after bounded tuning and fair baselines, narrow, pivot or stop. Learning about Pi and harness design is an intended outcome, not a reason to force a positive benchmark.
