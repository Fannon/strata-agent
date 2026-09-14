# strata-agent

**Strata lets a Pi coding agent compose typed capabilities in small TypeScript programs.** Repository operations, configured MCP tools and CLI adapters return values that the program can filter, join and summarize before returning a result to the model.

The experiment asks whether useful contracts, static checking and code composition improve task success, cost or latency. Shell pipelines and ordinary scripts already compose well, so stock Pi retains those abilities in comparisons. Fewer tool calls or smaller returned payloads alone do not establish an advantage.

The typed capability layer is the enduring architecture; execution is replaceable. Bun hosts the checker and adapters. Generated programs use default QuickJS or opt-in direct Bun, with the same checker and broker validation. Direct Bun has ambient host authority and measures cooperative API adherence, not containment.

Implemented today: `typed_program`, `search_capabilities`, `load_capability`, `program_details`; bounded line-range reads, filtered literal search, listings, Git status/history/diffs/historical files; configured stdio MCP, a deterministic CLI twin, a small catalog, correlated traces and quiet success reports. Edits/checks, interactive grants, persistent program state and hardened hosted isolation remain future work.

**Current evidence (2026-09-13):** four repository trial stages recorded 120 cells on one model. Typed profiles used fewer Pi tool calls but more tokens and estimated cost; no task-level advantage is established. Dev+held-out costs were about 2–2.2× stock. A 36-cell paired development trial reduced typed cost per success by 26.4% with compact declarations (12/12 successes for both full and compact), but a 12-cell confirmation on the fresh R-CALL family was negative/inconclusive (stock 4/4, full 3/4, compact 2/4; all typed misses returned correct answers but failed on policy/harness checks). Compact stays opt-in (`STRATA_DECLARATIONS=compact`); full remains default. This does not establish a win over stock. See the [reviewed results](docs/repo-trials.md) and [sanitized evidence](docs/evaluations/repo-2-2026-09-06.json).

Strata shares the tools-as-code idea with prior work; see [research](docs/research/typed-agent-prior-art.md) and [Code Mode notes](docs/research/code-mode.md). A narrower useful tool or a well-explained negative result is a worthwhile outcome.

Read the [ACD](ACD.md), [implemented architecture](ARCHITECTURE.md), [how it works](docs/how-it-works.md), [handoff](docs/handoff.md) and tracked [issue board](.work/issues/index.md). Other `.work/` artifacts stay local.

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
* **Repository trials (repo-2):** four stages, 120 recorded cells; 116 exact answers and 114 overall successes. Typed profiles used fewer Pi calls but greater estimated cost/context. A 36-cell development run then showed −26.4% cost/success for compact versus full declarations (12/12 each); the 12-cell R-CALL confirmation was negative/inconclusive (stock 4/4, full 3/4, compact 2/4). See [reviewed report](docs/repo-trials.md); pooled stages are not independent confirmation. Earlier $0.013 hybrid and $0.0117 engine pilots are historical feasibility runs.
* **Executor comparison (deterministic):** QuickJS and opt-in Bun (`STRATA_EXECUTOR=bun`) keep the same contracts, checks, and policy. Bun is tens of ms faster per run — noise next to model latency. Bun measures cooperative use of the nice API, not enforced containment. See [docs/executors.md](docs/executors.md).
* **Live smoke (opt-in, paid):** compile rejection with zero calls, then a valid 3-call composition. Verified 2026-09-05 with Muse Spark (1,947,909 bytes → 557 bytes). Transcripts stay local in `.work/`.

The [evaluation plan](docs/evaluation.md) records the delivered context-attribution and compact-presentation work, the negative/inconclusive R-CALL confirmation, and the selected AppWorld compatibility experiment.

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

The extension always registers `search_capabilities` (lexical search over the local `catalog/`) and `load_capability` (adds an entry to the live session and returns its `@cap/` import block). Loading never grants invocation: every call still passes the configured allowlist and schema validation. Search is policy-aware: it hides catalog entries with no usable grants (missing or empty `allow` entry, or names matching no declared operation) before ranking, so denied hits cannot crowd out allowed ones under `limit`, and it matches/displays only granted operations — module id/description stay discoverable when some declared operation is granted. Filtering is discovery UX only, not schema secrecy: `load_capability` returns full module declarations alongside a grant-filtered operation list, validates grants before serving cached declarations, and refuses denied ids (including grants naming no declared operation) the same way. Search requires a live session and fails closed after shutdown. The first catalog holds the twin split for benchmarking: always-loaded core (`customers`, `invoices`) with bulk `records` discovered on demand.

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

Deep-dive: [docs/how-it-works.md](docs/how-it-works.md) covers the full mechanism — run path, broker, checker, capabilities, executors, discovery, observability, and current trial evidence.

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

QuickJS is the default executor, not a product requirement. The lasting interface is the typed capability layer spanning repository operations, APIs and MCP. Direct Bun is implemented opt-in (`STRATA_EXECUTOR=bun`) using the same contracts, semantic checker, permission-aware functions and instrumentation. Import checks alone do not establish containment. See [docs/executors.md](docs/executors.md) and the [ACD](ACD.md#permission-aware-functions-and-execution-alternatives).

Bun hosts Pi, the language service, MCP connections, and worker scheduling. Programs execute **inside QuickJS compiled to WebAssembly**, not directly in Bun. They see standard ECMAScript computation and the generated capability bindings, without `Bun`, `process`, filesystem libraries, `fetch`, or host module loading. The worker can be terminated without terminating Pi; QuickJS has an interrupt handler and a memory limit.

This is a constrained execution environment, **not a claim of a hardened security sandbox**. Pi extensions and configured MCP servers remain trusted host code. See [ARCHITECTURE.md](ARCHITECTURE.md) for the alternatives, trust boundaries, and limitations.

### Persistence and limits

The compiler service, declarations, MCP connection, broker and validators persist for the Pi session. Each execution gets a fresh worker and interpreter. The session API supports cancellation, and session shutdown aborts execution and pending broker calls; shutdown closes the MCP connection and disposes the language service. Cancellation cannot undo an operation already accepted by a server. Pi's per-tool abort signal is forwarded through the tool wrapper to the session, so interactive tool cancellation reaches execution; covered by registered-tool pre-abort and mid-call tests.

Default limits: 32 KiB source, 5 seconds execution including worker startup, 64 MiB interpreter heap, 100 attempted capability calls, 2 KiB captured logs, an 8,192-character result, and 24,000 bytes of final tool content. Oversized results return an error asking for aggregation. Compilation is synchronous and has no hard deadline; the execution timer starts after typechecking. MCP payloads are materialized in host memory before interpreter delivery, so the interpreter limit is not a host-process memory quota.

### What we measure

Every program run records source bytes, compile duration, diagnostics, execution duration, attempted operation names, actual connector invocation count, validation/policy failures, capability result bytes, and exact UTF-8 tool-content bytes exposed to Pi. Raw capability bytes mean the serialized MCP result envelope, excluding JSON-RPC and transport framing. Intermediate payloads never appear in metrics.

Quiet success, loud error: on success the model sees only `{ result, program }` — no logs or metrics in context. Failures return repair fields (error, diagnostics, failed calls, logs). Full logs and metrics stay in host history (last 20 programs) and the opt-in JSONL trace, fetched on demand with the `program_details` tool.

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

There is no Pi core fork, dynamic authorization, persistent typed REPL, object store or additional agent planning/memory system. Discovery stays minimal: lexical search, static allowlists and `cli-twin` catalog entries. Delivered since the original plan: 025 load/shutdown guards, 029 policy-aware discovery, and fixture fingerprints for reproducible manifests. The selected next experiment is the 037 AppWorld offline spike (in progress, not delivered); further compact confirmation would need a separately frozen experiment under 009. See the [ACD](ACD.md#delivery-and-decision-gates), [handoff](docs/handoff.md) and tracked [issue board](.work/issues/index.md).
