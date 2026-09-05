# strata-agent

**Strata is a coding agent that calls its tools from small TypeScript programs — checked before execution, authorized at every call.**

Coding agents often spend a tool call assembling shell commands to read files, list directories, inspect Git, and parse the resulting text. Strata explores a different interface: purposeful typed functions that return structured values, composed with ordinary TypeScript. The agent can fetch, filter and combine data in one checked program, returning only what the next reasoning step needs.

The intended payoff is fewer interface mistakes, less intermediate data in context, and fewer model round trips. Those are hypotheses. Bash already composes well, models know its conventions, and compilation/declarations add overhead. The experiment is worthwhile even if the result is a narrower useful tool or a better understanding of Pi and agent harnesses.

Strata currently extends [Pi](https://github.com/earendil-works/pi), with Bun hosting a TypeScript checker and fresh QuickJS executions. It adds `typed_program`, `search_capabilities`, and `load_capability`. Programs call schema-derived `api.*` functions; a broker validates inputs/outputs and applies local operation allowlists. MCP, a deterministic CLI twin, and a minimal multi-module catalog work today. Pi's normal tools remain available.

**Next experiment:** replace common repository-inspection shell scripts with a small filesystem/search/Git API. Prefer Bun's native host APIs for file work and mature engines behind typed adapters where useful. No model-authored shell does not require eliminating Git subprocesses. Native repository capabilities, scoped filesystem grants, and a strictly typed tool profile are planned, not shipped. Bun APIs are not exposed directly to generated programs.

The deterministic demo reduces 1,947,738 capability bytes to about 400 bytes of Pi tool content. A first fixture pilot recorded 9/12 accepted cells; it used single attempts and permissive grading. Neither establishes better overall task success or cost. The [evaluation plan](docs/evaluation.md) defines fair stock-Pi and Prime/IPython comparisons, held-out repository tasks, total-cost accounting, and criteria to continue, narrow or stop.

Read the [technical concept / ACD](ACD.md), [implemented architecture](ARCHITECTURE.md), and [primary-source research](docs/research/typed-agent-prior-art.md). The local implementation order and TODOs live in [.work/issues/index.md](.work/issues/index.md); that board is gitignored and may be absent in a fresh clone.

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

### Benchmark backend: CLI twin

The same fixture data is also available as a CLI (`test/fixture-cli/cli.ts`) for stock-Pi-versus-Strata comparisons on identical data. Stock Pi drives it through bash; Strata drives it as typed `api.*` calls:

| Bash (stock Pi) | Typed (Strata) | Deterministic check |
| --- | --- | --- |
| `bun test/fixture-cli/cli.ts customers --country DE` | `api.customers({ country: "DE" })` | customers `== [{"id":"c1","country":"DE"}]` |
| `bun test/fixture-cli/cli.ts invoices --customer-ids c1` | `api.invoices({ customerIds: ["c1"] })` | invoices `== [{"id":"i0","customerId":"c1","amount":12000}]` |
| `bun test/fixture-cli/cli.ts records --count 10000` | `api.records({ count: 10000 })` | 10,000 records; scores `> 0.98` select IDs `[99, 199, 299, 399, 499]` |

Select it with a twin config (command/args are fixed to the twin script; only `allow` is operator input):

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

CLI/MCP twin parity is asserted in tests, so the two backends cannot drift apart silently.

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

Bun hosts Pi, the language service, MCP connections, and worker scheduling. Programs execute **inside QuickJS compiled to WebAssembly**, not directly in Bun. They see standard ECMAScript computation and the generated capability bindings, without `Bun`, `process`, filesystem libraries, `fetch`, or host module loading. The worker can be terminated without terminating Pi; QuickJS has an interrupt handler and a memory limit.

This is a constrained execution environment, **not a claim of a hardened security sandbox**. Pi extensions and configured MCP servers remain trusted host code. See [ARCHITECTURE.md](ARCHITECTURE.md) for the alternatives, trust boundaries, and limitations.

### Persistence and limits

The compiler service, declarations, MCP connection, broker and validators persist for the Pi session. Each execution gets a fresh worker and interpreter. The session API supports cancellation, and session shutdown aborts execution and pending broker calls; shutdown closes the MCP connection and disposes the language service. Cancellation cannot undo an operation already accepted by a server. Known integration gap: the current Pi tool wrapper drops Pi’s per-tool abort signal, so interactive tool cancellation does not yet reach this path; repair is planned before broader workloads.

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
- `src/capabilities/catalog.ts`: single-file TS catalog, static `meta` extraction, lexical search.
- `catalog/`: capability entries (core + records-on-demand twin split).
- `src/runtime/`: Bun worker lifecycle and QuickJS execution.
- `src/session.ts`: composition root, hot-add (`load()`), and bounded reports.
- `test/fixture-mcp/`: deterministic server, including deliberately broken and denied operations.
- `test/integration/`: compiler/runtime/MCP and real Pi loader tests.
- `examples/benchmark.ts`: exploratory A/B/C fixture runner (protocol v1); grader/repeat improvements are planned.
- `examples/`: deterministic demo, declaration generation and opt-in model smoke test.

The tests cover the seven core claims: compile rejection without calls, typed invocation, composition, invalid output rejection, honest untyped results, context-volume reduction, and policy interception. Additional checks cover cancellation, timeout recovery, host API exclusion, schema name collisions and lifecycle integration.

There is no Pi core fork, native repository API, dynamic authorization, persistent typed REPL, object store or additional agent planning/memory system. Discovery stays minimal: lexical search, static allowlists and `cli-twin` catalog entries. The next stages are cancellation/evaluator repair, scoped native repository reads, and repeated comparisons before broader editing or discovery work. See the [ACD](ACD.md#delivery-and-decision-gates) and local [.work/PLAN.md](.work/PLAN.md).
