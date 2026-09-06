# strata-agent

> **Research experiment, not a product.** Strata tests one idea about how coding agents should call tools. It is not built for daily work. It may end with "this only helps in narrow cases" or "bash was fine" — that counts as a result.

**In one sentence:** Strata lets an agent call its tools from one small TypeScript program, instead of piecing together many shell commands.

Today an agent often works like this: run a shell command, read the text, run the next command, parse again. That works, but each step is a new trip to the model, and large results fill up the context.

Strata tries this instead: the agent writes a short program with typed functions like `api.customers({ country: "DE" })`. The program can fetch, filter, and combine data in one go, and return only a small final answer.

Three hopes behind this:

* Fewer mistakes, because inputs are checked before anything runs.
* Less noise in context, because filtering happens inside the program.
* Fewer round trips, because several calls fit in one program.

Three honest doubts we keep:

* Bash already composes well, and models know it.
* Type declarations cost tokens too.
* Our evidence so far is small — toy data and easy tasks prove the wiring works, not that Strata wins.

How it looks in practice: Strata is an extension for [Pi](https://github.com/earendil-works/pi), a coding agent. It adds one main tool, `typed_program`, plus two helpers to find and load more functions (`search_capabilities`, `load_capability`). Pi's normal tools stay available. Bun runs the checker and the workers; by default programs run inside a fresh QuickJS interpreter with no `fs`, `fetch`, or `process`.

What works today: a deterministic test fixture, the same data as a plain CLI for fair comparison, a tiny two-entry catalog, and read-only repository helpers (`readText` with line ranges, literal `searchText`, `gitStatus`, `listFiles`, `gitLog`). What does not exist yet: write support, real discovery at scale, hosted sandboxing, or any claim of production safety. See [Project map and scope](#project-map-and-scope) and [What we measure](#what-we-measure).

Details on what has been measured — and what has not — live in [Benchmarking](#benchmarking).

For background, read the [technical concept / ACD](ACD.md), [implemented architecture](ARCHITECTURE.md), [next-agent handoff](docs/handoff.md), and [prior-art research](docs/research/typed-agent-prior-art.md), including [Cloudflare Code Mode](docs/research/code-mode.md). Planning details live in `.work/issues/` (checked in) — start with the [issue board](.work/issues/index.md).

## Get started

Requires **Bun** (tested with 1.4.1 on Linux). No API key or external service is needed for the fixture demo and integration tests.

```sh
git clone https://github.com/Fannon/strata-agent.git
cd strata-agent
bun install --frozen-lockfile
bun run check
bun test
bun run demo
```

The demo starts a local MCP fixture subprocess, composes customer and invoice calls, then filters 10,000 records inside the program. It prints the final results and capability-bytes / Pi-bytes measurements. `bun run generate` refreshes the checked-in [fixture declarations](src/generated/fixture.d.ts); runtime declarations are generated from the connected server at session startup.

### Use it in Pi

```sh
bun run pi
```

This runs the pinned Pi CLI under Bun with the Strata extension. Use your usual Pi model configuration. The default capability is the deterministic fixture; no MCP setup is needed. Try:

> Use typed_program to find DE customers, fetch their invoices, and return only invoice IDs with amounts above 10000.

The model receives the generated API declarations in its system prompt. A `typed_program` call looks like:

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

Programs are ordinary TypeScript modules with an exported zero-argument `main()`. Return a JSON-serializable value; `console.log()` is available for small diagnostic messages. There are no notebook variables between runs. Type errors return filename, line, column and TypeScript diagnostics, with **zero capability invocations**.

### Test with a real model

The opt-in smoke test uses OpenRouter, trying these models in order:

1. `meta/muse-spark-1.3-contributor`
2. `z-ai/glm-5.3-flash`
3. `deepseek/deepseek-v4-flash-0731`

Set `OPENROUTER_API_KEY` in your environment, then run:

```sh
bun run test:agent
```

This makes live model requests. It creates an isolated Pi profile, reads current model metadata from OpenRouter, and asks the agent to demonstrate a compile-time rejection followed by a valid three-operation composition. It asserts the observed tool results and records model usage. Local transcripts, the model profile, and the summary are in gitignored `.work/`. The ordinary test suite never calls a model. Verified with Muse Spark on 2026-09-05: compile rejection and three-call composition passed, with 1,947,909 capability bytes reduced to 557 tool-content bytes. No fallback was needed.

### Connect your own MCP server

Create a local JSON file and set `STRATA_CONFIG` to its absolute path:

```json
{
  "id": "catalog",
  "command": "/absolute/path/to/mcp-server",
  "args": ["--stdio"],
  "allow": ["search", "getRecord"]
}
```

```sh
STRATA_CONFIG=/absolute/path/to/config.json bun run pi
```

The model can then `import { api } from '@cap/catalog'`. Use exact original MCP tool names: `api.search(...)`, or `api['search-records'](...)`. Names are preserved as quoted TypeScript properties, avoiding collisions caused by camel-casing or punctuation replacement. Duplicate names are rejected.

Configuration is trusted operator input. `allow` is an explicit local allowlist; missing operations are denied even if the server advertises them as read-only. This configuration connects one **stdio** MCP server. Multi-module discovery exists for the local CLI-twin catalog; MCP-backed catalog entries, authentication configuration and HTTP transports are not built yet. The MCP SDK controls the subprocess environment; Strata does not expose environment variables to generated programs.

## Benchmarking

This is where we report honestly what the numbers show and how to reproduce them. Short version: filtering inside a program works; whole-task wins are unproven.

### Current state

* **Demo (deterministic, no model):** about 1.9M bytes of raw fixture data shrink to about 400 bytes of tool output. This proves bulk filtering inside a program, not better task success or lower cost.
* **Early fixture pilot (historical):** 9/12 cells passed, but with loose grading and single tries. Keep it as history, not as a claim.
* **Fixture runner v2:** exact answer checks, repeated cold sessions, spending reservations, offline tests. No paid v2 baseline has run yet.
* **Repository pilot:** 27/27 on 3 easy tasks across stock Pi / typed-QuickJS / typed-Bun ($0.013). This proves wiring, not advantage — the tasks were too easy and declarations dominated tokens on tiny payloads.
* **Executor comparison (deterministic):** QuickJS and opt-in Bun (`STRATA_EXECUTOR=bun`) keep the same contracts, checks, and policy. Bun is tens of ms faster per run — noise next to model latency. Bun measures cooperative use of the nice API, not enforced containment. See [docs/executors.md](docs/executors.md).
* **Live smoke (opt-in, paid):** compile rejection with zero calls, then a valid 3-call composition. Verified 2026-09-05 with Muse Spark (1,947,909 bytes → 557 bytes). Transcripts stay local in `.work/`.

The [evaluation plan](docs/evaluation.md) defines the fair next comparison — same tasks and settings across stock Pi and both executors, full cost counting — and when to continue, narrow, or stop.

### How to benchmark

Same data, two ways. Stock Pi uses the CLI through bash. Strata uses the same data as typed `api.*` calls:

| Bash (stock Pi) | Typed (Strata) | Deterministic check |
| --- | --- | --- |
| `bun test/fixture-cli/cli.ts customers --country DE` | `api.customers({ country: "DE" })` | customers `== [{"id":"c1","country":"DE"}]` |
| `bun test/fixture-cli/cli.ts invoices --customer-ids c1` | `api.invoices({ customerIds: ["c1"] })` | invoices `== [{"id":"i0","customerId":"c1","amount":12000}]` |
| `bun test/fixture-cli/cli.ts records --count 10000` | `api.records({ count: 10000 })` | 10,000 records; scores `> 0.98` select IDs `[99, 199, 299, 399, 499]` |

CLI/MCP twin parity is asserted in tests, so the two backends cannot drift apart silently. To try the twin by hand in Pi:

```json
{
  "transport": "cli-twin",
  "allow": ["customers", "invoices", "records"]
}
```

```sh
STRATA_CONFIG=/absolute/path/to/twin.json bun run pi
# then: import { api } from '@cap/cli'
```

Plan a fixture run without spending (dry run is the default):

```sh
bun examples/benchmark.ts --dry-run --cells T1:A,T1:B,T1:C --repeats 3
```

Paid runs need explicit flags. See the [runner contract](docs/benchmark.md) for budget reservations, result meanings, and limits:

```sh
bun examples/benchmark.ts --run --max-cost-usd 5 --cells T1:A,T1:B,T1:C --repeats 3
```

Other checks:

* `bun run demo` — deterministic composition and byte counts, no model needed.
* `bun run test:agent` — opt-in live smoke with `OPENROUTER_API_KEY` (creates an isolated Pi profile, keeps transcripts local).
* `bun examples/executor-compare.ts` — deterministic QuickJS vs Bun comparison, no model needed.
* `bun examples/repo-pilot.ts` — seeded repository trial harness (see its header for caps and limits).

The ordinary test suite uses a loopback fake provider and never calls a paid model.

### Discovery: search and load further capabilities

The extension always registers `search_capabilities` (lexical search over the local `catalog/`) and `load_capability` (adds an entry to the live session and returns its `@cap/` import block). Loading never grants invocation: every call still passes the configured allowlist and schema validation. The first catalog holds the twin split for benchmarking: always-loaded core (`customers`, `invoices`) with bulk `records` discovered on demand.

```json
{
  "transport": "catalog",
  "preload": ["cli"],
  "allow": { "cli": ["customers", "invoices"], "cli-records": ["records"] }
}
```

```sh
STRATA_CONFIG=/absolute/path/to/catalog.json bun run pi
# then: search_capabilities "bulk records" → load_capability "cli-records"
# → import { api } from '@cap/cli-records'
```

Catalog files are single-file TypeScript: a standardized `meta` export (pure static data, extracted without executing the module) plus `bindings` (argv mappers, imported only on load). Only `cli-twin`-backed entries are supported; anything else fails with a clear error.

### Troubleshooting

- **Bun required:** Strata runs Pi under Bun (`bun run pi`). Under plain Node the extension throws `Strata requires Bun. Start with bun run pi.` Tested with Bun 1.4.1 on Linux.
- **Broken global Pi extensions:** `bun run pi` passes `--no-extensions` so a broken user-level package (e.g. `npm:pi-lean-portal` failing with `Cannot find module '@earendil-works/pi-server'`) cannot abort startup; the Strata extension still loads via explicit `-e`. Manage globals with `pi list` / `pi remove <source>`.
- **`STRATA_CONFIG`:** must be an absolute path to the JSON file. Unset, empty or whitespace-only selects the deterministic fixture — no MCP setup needed.
- **Model keys:** `check`, `test`, `demo` and declaration generation are local. Interactive Pi needs its configured model credentials; the opt-in smoke and benchmark runners use `OPENROUTER_API_KEY`.

## How it works

```text
Pi model
  │ TypeScript source
  ▼
Persistent TypeScript language service
  ├─ diagnostics → Pi; nothing executes
  └─ checked JavaScript
       ▼
Fresh Bun worker + QuickJS interpreter
  │ typed API call → structured message
  ▼
Capability broker: local policy → input validation
  ▼
MCP connector → server, or CLI connector → fixture process
  ▼
Broker: output validation → worker
  │ local filtering / composition
  ▼
Bounded JSON result + logs + metrics → Pi
```

MCP metadata first becomes a protocol-independent `CapabilityModule`. This manifest feeds both declaration generation and runtime bindings. The broker depends on a small connector interface rather than MCP types, so the compiler and validation path can serve both implemented MCP and CLI-twin connectors. Native repository adapters will reuse this contract; resource-aware policy still needs implementation.

### What is actually typed?

| Protocol information | TypeScript API                   | Runtime behavior                                    |
| -------------------- | -------------------------------- | --------------------------------------------------- |
| `inputSchema`        | Schema-derived parameter type    | AJV validates before connector invocation           |
| `outputSchema`       | Schema-derived `Promise<Result>` | Uses `structuredContent`; AJV validates it          |
| No `outputSchema`    | `Promise<unknown>`               | Returns the MCP result envelope; caller must narrow |
| Tool descriptions    | Generated JSDoc                  | No type inference from prose                        |
| Effect annotations   | Manifest metadata                | Never sufficient to grant access                    |

TypeScript cannot express every JSON Schema constraint: integers, bounds and other constraints still need runtime checks. Type assertions can bypass static checking, so the broker validates even a program using `as any`. Diagnostic-suppression comments are rejected. JSON Schema generation uses `json-schema-to-typescript`; validation uses AJV's 2020-12 implementation with formats. Local schema references are supported; external file/HTTP references fail setup rather than fetching dependencies. Schemas that cannot be compiled fail setup instead of silently degrading to a fabricated type.

### Why Bun plus QuickJS?

QuickJS is the current executor, not a product requirement. The lasting interface is the typed capability layer spanning repository operations, APIs and MCP. Direct Bun is a planned alternative using the same contracts, semantic checker, permission-aware functions and instrumentation. Import checks alone do not establish containment. See the [ACD](ACD.md#permission-aware-functions-and-execution-alternatives).

Bun hosts Pi, the language service, MCP connections, and worker scheduling. Programs execute **inside QuickJS compiled to WebAssembly**, not directly in Bun. They see standard ECMAScript computation and the generated capability bindings, without `Bun`, `process`, filesystem libraries, `fetch`, or host module loading. The worker can be terminated without terminating Pi; QuickJS has an interrupt handler and a memory limit.

This is a constrained execution environment, **not a claim of a hardened security sandbox**. Pi extensions and configured MCP servers remain trusted host code. See [ARCHITECTURE.md](ARCHITECTURE.md) for the alternatives, trust boundaries, and limitations.

### Persistence and limits

The compiler service, declarations, MCP connection, broker and validators persist for the Pi session. Each execution gets a fresh worker and interpreter. The session API supports cancellation, and session shutdown aborts execution and pending broker calls; shutdown closes the MCP connection and disposes the language service. Cancellation cannot undo an operation already accepted by a server. Pi's per-tool abort signal is forwarded through the tool wrapper to the session, so interactive tool cancellation reaches execution; covered by registered-tool pre-abort and mid-call tests.

Default limits: 32 KiB source, 5 seconds execution including worker startup, 64 MiB interpreter heap, 100 attempted capability calls, 2 KiB captured logs, an 8,192-character result, and 24,000 bytes of final tool content. Oversized results return an error asking for aggregation. Compilation is synchronous and has no hard deadline; the execution timer starts after typechecking. MCP payloads are materialized in host memory before interpreter delivery, so the interpreter limit is not a host-process memory quota.

### What we measure

Every program report includes source bytes, compile duration, diagnostics, execution duration, attempted operation names, actual connector invocation count, validation/policy failures, capability result bytes, and exact UTF-8 tool-content bytes exposed to Pi. Raw capability bytes mean the serialized MCP result envelope, excluding JSON-RPC and transport framing. Intermediate payloads never appear in metrics.

The live smoke test additionally records Pi's model usage. Generated declarations and the program source also consume context; the byte-reduction metric does not count those or prove total token/cost savings.

## Project map and scope

- `src/pi/extension.ts`: Pi tool, prompt and lifecycle integration.
- `src/compiler/workspace.ts`: persistent TypeScript checking and emission.
- `src/capabilities/`: manifest, schema tooling and policy/validation broker.
- `src/capabilities/mcp/`: metadata adapter and MCP SDK connector.
- `src/capabilities/cli/`: process-based connector (argv arrays, JSON stdout, exit/stderr translation).
- `src/capabilities/repo/`: native read-only repository connector (root-scoped `readText` with line ranges, literal `searchText`, fixed-argv `gitStatus`, `listFiles`, `gitLog`) with best-effort path containment.
- `src/capabilities/catalog.ts`: single-file TS catalog, static `meta` extraction, lexical search.
- `catalog/`: capability entries (core + records-on-demand twin split).
- `src/runtime/`: Bun worker lifecycle and QuickJS execution.
- `src/session.ts`: composition root, hot-add (`load()`), and bounded reports.
- `test/fixture-mcp/`: deterministic server, including deliberately broken and denied operations.
- `test/integration/`: compiler/runtime/MCP and real Pi loader tests.
- `examples/benchmark.ts` and `examples/benchmark/`: protocol v2 runner, exact task grading, trace assessment, request guard and process supervision.
- `examples/`: deterministic demo, declaration generation and opt-in model smoke test.

The tests cover the seven core claims: compile rejection without calls, typed invocation, composition, invalid output rejection, honest untyped results, context-volume reduction, and policy interception. Additional checks cover cancellation, timeout recovery, host API exclusion, schema name collisions and lifecycle integration.

There is no Pi core fork, dynamic authorization, persistent typed REPL, object store or additional agent planning/memory system. Discovery stays minimal: lexical search, static allowlists and `cli-twin` catalog entries. The next stages are matched seeded-repository trials across stock Pi and both executors within an explicit spend cap, and any list/log operations harder held-out tasks earn, before broader editing or discovery work. See the [ACD](ACD.md#delivery-and-decision-gates) and local [.work/PLAN.md](.work/PLAN.md).
