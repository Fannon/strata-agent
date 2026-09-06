# Strata: how it works

Deep-dive companion to the [README](../README.md). The README pitches the
idea; this document describes the mechanism end to end as implemented.
Sources: the walkthrough of Topics 1–10 (2026-09-06), current code, and the
trial report in [repo-trials.md](repo-trials.md). Status numbers below were
rechecked 2026-09-06: `bun run check` clean, 148 tests passing (permitted subprocess/loopback test run).

## 1. The idea

An agent can spend successive turns running commands and interpreting results. It can also compose shell pipelines or scripts within one tool call. Strata tests whether typed contracts and composition make that work more effective; the baseline is not restricted to one operation per turn.

Strata belongs to the family usually called **code mode** or
**tools-as-code**: the agent writes one small program that composes several
tool calls, filters and combines the data inside, and returns only a small
final answer. Cloudflare described the same core move for MCP — convert
schemas to TypeScript APIs, compose in code, keep intermediates out of
context — and Prime Agent composes actions in a persistent Python kernel.
Strata's variation: TypeScript checked *before* anything runs, inputs and
outputs validated on *every* call, and a focus on repository work. Prior art
is surveyed in [research/typed-agent-prior-art.md](research/typed-agent-prior-art.md)
and [research/code-mode.md](research/code-mode.md).

A second, quieter promise is unification. Harness helpers, everyday
bash/CLI work wrapped as functions, and MCP tools all present the same
shape — typed `api.*` functions. Three different worlds, one interface.

The honest footnote travels with every claim: bash composes well and models
know it; type declarations cost tokens too. Everything below exists to test
the idea fairly, including the option of concluding against it. The decision
framework lives in [evaluation.md](evaluation.md).

## 2. System overview

```
Pi model
  │ TypeScript source
  ▼
Persistent TypeScript language service (checker)
  ├─ diagnostics → Pi; nothing executes
  └─ checked JavaScript
       ▼
Fresh worker per run: QuickJS/WASM (default) or direct Bun (opt-in)
  │ typed API call → structured message
  ▼
Capability broker: allowlist → input validation
  ▼
Connector: MCP server | CLI subprocess (argv) | native repo code
  ▼
Broker: output validation → worker
  │ local filtering / composition
  ▼
Bounded tool text → Pi (quiet success, loud error)
```

Component map:

- `src/pi/extension.ts` — Pi tool registration, lifecycle hooks, prompt.
- `src/session.ts` — composition root: checker, broker, history, reports.
- `src/compiler/workspace.ts` — persistent TypeScript checking and emission.
- `src/capabilities/` — manifest, schema tooling (`schemas.ts`), broker
  (`broker.ts`), static catalog (`catalog.ts`).
- `src/capabilities/mcp/|cli/|repo/` — the three connectors.
- `src/runtime/` — worker lifecycle, QuickJS and Bun executors.
- `src/trace.ts` — versioned developer trace, opt-in JSONL sink.
- `catalog/` — capability entries (core + records-on-demand twin split).
- `examples/benchmark/` — task contracts, budget guard, process
  supervision, grading, evaluator-access auditor.
- `test/fixture-mcp/`, `test/fixture-cli/` — deterministic fixture backends.

## 3. Pi integration

Strata is a Pi extension, not a fork. The pinned release
(`@mariozechner/pi-coding-agent@0.73.1`) is used unmodified; `bun run pi`
starts its CLI with `--no-extensions -e ./src/pi/extension.ts`, so broken
global extensions cannot block startup and exactly one extension loads.

The extension is one function receiving `ExtensionAPI` (`pi`). It keeps its
state in local variables (session, catalog index, loaded set) and hooks four
moments via `pi.on()`:

- `session_start` — read `STRATA_CONFIG`, connect backends, start the
  checker, build the session. Failures are saved as a startup error string,
  not thrown.
- `before_agent_start` — append usage instructions plus generated API
  declarations to the system prompt. This is how the model learns the API.
- `tool_call` — used only by the strict test profile (`STRATA_STRICT=1`),
  which blocks `bash`/`read`/`write`/`edit`/`find`/`grep`/`ls` so the model
  must use the typed path. Normal use leaves Pi tools alone.
- `session_shutdown` — abort runs, close connectors, dispose the checker.

Four tools are registered with `pi.registerTool` (name, description,
TypeBox parameter schema, `execute` returning `{ content, details }`,
errors thrown):

- `typed_program({ source })` — check and run a complete module exporting
  zero-argument `main()`. Success content is `{ result, program }` only;
  failures throw with repair fields. Full metrics ride in `details` for the
  benchmark trace without entering model context.
- `program_details({ program })` — logs and metrics for a finished program
  by id, from bounded host history (last 20). Used for debugging, not for
  answers.
- `search_capabilities({ query, limit? })` — lexical search over the local
  catalog. Executes no module code.
- `load_capability({ id })` — connect a catalog entry, hot-add its
  declarations, return the `@c/<id>` import block.

## 4. Running a program

`session.run(source, { signal?, timeoutMs?, executor? })` executes five
steps in fixed order:

1. **Size check.** Sources over 32 KiB are rejected before any work.
2. **Type check.** The persistent language service (TypeScript 5.9.3,
   strict, ES2022, no Node/DOM ambient types, allowlisted filesystem)
   checks the module plus generated declarations. Any diagnostic returns
   file, line, column, and message with **zero capability invocations**
   (proven by fixture counters in tests). Suppression comments are
   rejected; `as any` compiles but buys nothing at the next step.
3. **Fresh worker.** One disposable worker per run. QuickJS/WASM sees only
   `api` bindings and bounded `console.log` — no `Bun`, `process`,
   filesystem, `fetch`, or host module loading. Direct Bun (opt-in,
   `STRATA_EXECUTOR=bun`) runs the same program where ambient authority
   stays reachable. No state survives between runs. Defaults: 5 s total,
   64 MiB interpreter heap, 100 attempted calls, 2 KiB logs, 8,192-char
   results, 24,000-byte tool text.
4. **Guarded calls.** Each `api.*` invocation is a message to the broker
   (§5), never direct backend access. Cancellation via Pi's abort signal
   terminates the worker and aborts pending calls; effects already accepted
   by a server cannot be undone.
5. **Bounded answer.** Oversized results fail with "return a smaller
   result" instead of dumping data. The byte metric counts the exact
   serialized tool text through a fixed-point loop.

## 5. The broker: permission and shape on every call

`CapabilityBroker` owns three checks per call, in order. Metrics never
contain raw payloads; each call gets a correlated id (`<session>:p<n>.<seq>`),
duration, backend label, and a structured outcome — never prose parsing.

1. **Allowlist.** Operation names permitted per capability module, from
   trusted operator configuration (`STRATA_CONFIG`). A denied call never
   reaches the connector. Loading a module never grants invocation.
2. **Input validation.** AJV (draft 2020-12, formats, no coercion) against
   the operation's input schema. Failures are `input` errors with zero
   backend contact — including inputs smuggled through `as any`.
3. **Output validation.** Against the output schema when one exists, using
   the MCP `structuredContent` payload. Mismatches are `output` errors;
   the program receives an error, not bad data (a deliberately `broken`
   fixture operation tests this). Operations without a schema return
   `unknown` and the program must narrow it — honest typing, no fabrication.

Further outcome kinds: `transport` (the road failed: spawn, exit code,
non-JSON stdout, MCP error), `denied` (resource rule before any effect:
root escape, `.git`, symlink tricks, oversize), `cancelled` (abort
mid-call, in-flight calls marked rather than left dangling).

## 6. The checker: schemas into types, and what types cannot say

One source feeds two uses: JSON Schemas generate TypeScript declarations
for early feedback, and the same schemas drive runtime validation for
enforcement. Generation uses `json-schema-to-typescript`, one namespace
per operation (no cross-tool name collisions), original operation names
preserved as quoted properties (no normalization merges), plus a preamble
exposing only `console.log`. `setDeclarations()` hot-adds newly loaded
modules with a bumped version, so later compiles see them without restart.

TypeScript cannot express every schema constraint: no integer type
(`minimum`/`maximum` need runtime), string lengths, patterns, formats,
array caps. Descriptions become hover documentation, never proof; effect
hints are metadata, never permission. The README's "What is actually
typed?" table records these boundaries. The design consequence from the
walkthrough: types are help, the broker is enforcement, and `as any` is
tolerated precisely because runtime checks make it harmless — while
suppression comments are rejected because they hide the diagnostics needed
for repair.

## 7. Capabilities today

- **Deterministic fixture** (default): `customers`, `invoices`, `records`
  over synthetic data, plus test helpers (`untyped`, `broken`, `stats`,
  `slow`). Needs no setup; the smoke test and demo run against it.
- **CLI twin**: the same fixture data as a plain CLI (`test/fixture-cli/`),
  driven through bash by stock Pi and through typed calls by Strata on
  identical bytes. Twin parity is test-asserted.
- **Catalog**: two entries proving discovery — always-loaded core
  (`customers`, `invoices`) plus bulk `records` found via search and added
  via load. Only `cli-twin` backends load; anything else fails explicitly.
- **Native repo** (`@c/repo`, root-scoped, read-only): `readText`
  (bounded, truncated with true size), literal `searchText` (caps on
  matches, files scanned, file size; skips `.git`/symlinks/binaries),
  `gitStatus` (fixed argv, machine-stable flags), plus `gitLog(withFiles)`,
  `gitDiff`, `gitShow` for history inspection. Path policy resolves every
  input inside the canonicalized root with a second check after symlink
  resolution. Containment is best-effort host enforcement, not a sandbox
  (TOCTOU races and privileged-reader escapes are documented
  non-guarantees).

Missing by plan, not by accident: writes/edits/checks (gated on reads
proving value), `find`/additional listing filters (listFiles is already implemented), MCP-backed catalog entries, HTTP transports, auth configuration.

## 8. Executors and the containment distinction

QuickJS is the default baseline; direct Bun is opt-in behind the shared
executor contract. Contracts, checking, validation, policy, and tracing
are identical; only ambient authority differs, proven by a canary test
(Bun programs can write outside the root; QuickJS programs cannot).
Labels stay honest: Bun measures *cooperative API adherence*, never
enforced containment, and Pi-tool restriction alone never equals
containment either. An unrestricted-Bun diagnostic is deferred: it changes API usage and authority together, so it cannot isolate validation cost. Wrapper traces cannot count all ambient bypasses. Any future use needs a separate hypothesis and explicit evaluator-access limits; a clean argument-audit canary is insufficient.

## 9. Discovery without execution

Catalog files pair static `meta` (JSON-compatible literals, schemas
inlined) with `bindings` (input-to-argv mappers). Search extracts `meta`
through the TypeScript parser without executing the module — computed
values are rejected, so search handles data, never code. Load imports
only `bindings`, generates declarations before touching the broker
(generation failure leaves the broker unchanged), and caches the import
block. Known gap tracked as `029`: search currently shows entries the
allowlist would refuse; load refusal stays authoritative until search
filters or marks them.

## 10. Three stores, three audiences

- **Tool text** (model): quiet success, loud errors (§4). Measured by
  `bytesExposedToPi`.
- **Host history** (model on demand): last 20 programs, logs plus metrics
  snapshot, no raw results or source. Served by `program_details`.
- **Developer trace** (us, never the model): versioned program/call/load
  events with ids, durations, outcomes, and sizes only — opt-in JSONL
  (`STRATA_TRACE_FILE`), summarized by `examples/trace-summary.ts`.
  Wrapper logs describe mediated calls; they cannot evidence the absence
  of uninstrumented bypasses.

The program id joins all three: the model holds it from its result,
`program_details` serves it, the trace carries its full timing.

## 11. Benchmarking and current evidence

The runner (`examples/benchmark/`: contracts, budget guard with
pre-request reservations, process supervision with group kill, exact
final-answer grading, four-way verdicts) and the repo-2 trial harness
(counterbalanced cells, controller-held oracles, per-cell canary,
pinned manifests) implement the principles in
[benchmarking-principles.md](benchmarking-principles.md): frozen tasks,
held-out sets, independent oracles, complete traces, full-power
baselines, cost-per-success with nulls preserved, pre-registered caps.

The evaluator-access auditor (`examples/benchmark/audit.ts`) scans
recorded tool args for answer/canary names and parent-tilde traversal
(spread-safe by construction); the repo runner fails snooped cells, and
the auditor is regression-tested including a genuine historical catch —
a v1 fixture cell that wandered into `../twin.json` (harness snooping,
already failed on tool adherence at the time).

Latest evidence is reconciled in [repo-trials.md](repo-trials.md) with a sanitized 120-cell export. Dev+held-out overall successes were 23/24 per profile, but exact correctness was 24/24 stock and 23/24 for each typed profile. Typed profiles made fewer Pi tool calls at roughly 2–2.2× estimated cost and 2.35–2.72× total tokens. These are observed task/profile differences, not a causal estimate of declaration cost. Four path-prefix mismatches and two policy-audit flags explain the six overall unsuccessful cells across all stages. The close-out reused previously inspected tasks; it is regression feedback, not untouched confirmation.

## 12. Current trajectory

Next is 004 context attribution and compact declarations with the same semantic surface, followed by independent work and optionally a second model. 031 quiet success and both engines are already delivered. Do not add more difficulty merely to force failures or declare engines/seeded tasks settled. Policy-aware discovery (029), load lifecycle robustness (025), coverage sampling (013/032/033), caps (034), memory (030) and edits/checks (015) remain separately scoped. The [board](../.work/issues/index.md) and [handoff](handoff.md) own current ordering.
