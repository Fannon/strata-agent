# Architecture and investigation notes

## Decision

Strata is a Pi extension, with Bun as its host runtime and QuickJS/WASM inside a fresh Bun worker for every checked program. A persistent TypeScript 5.9.3 language service checks complete modules. MCP tool metadata is normalized before generating declarations or invoking operations. One broker owns local authorization, validation and per-call instrumentation across all loaded capability modules, keyed by capability and operation.

No Pi core blocker was found; no core files were changed. This prototype requires starting Pi under Bun. Node-hosted Pi support would need a different worker host or a Bun subprocess bridge, not a core fork.

## Pi investigation (2026-09-05)

Inspected the installed npm release `@mariozechner/pi-coding-agent@0.73.1`, its distributed implementation and examples before choosing the integration. The upstream repository URL currently redirects from `badlogic/pi-mono` to `earendil-works/pi`; the installed release is the compatibility reference.

| Question                  | Evidence and consequence                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extension entry point     | Default factory receives `ExtensionAPI`; register `typed_program`, `search_capabilities` and `load_capability` with `registerTool`. Existing tools stay active.                                                                                                                           |
| Lifecycle / session state | `session_start` initializes the connection/compiler; `session_shutdown` aborts and disposes them. Pi emits shutdown/start across reload and session replacement. Closures hold infrastructure; no session entries or replayed program variables. |
| Tool execution            | `execute(id, params, signal, onUpdate, ctx)` supplies cancellation. Errors must be thrown; returning a custom `isError` property does not set agent-loop error status.                                                                           |
| Permission interception   | `tool_call` can block a Pi tool. Nested MCP operations are not separate Pi tools and do not independently trigger this hook. Broker allowlist enforcement is therefore mandatory.                                                                |
| Process helpers           | `pi.exec` supplies captured stdout/stderr, signal and timeout; it is useful for ordinary commands but does not supply this typed runtime's structured broker message channel. Pi itself uses child processes.                                    |
| MCP                       | Pi README explicitly excludes built-in MCP; extensions may add it. The external pi-mcp-adapter also provides MCP scripting; its broader discovery/UI/runtime is unnecessary for this single normalized SDK adapter.                              |
| SDK                       | `createAgentSession`, `DefaultResourceLoader`, `SessionManager` and extension discovery APIs are available. The deterministic test uses the real `discoverAndLoadExtensions` loader; the live test uses the unmodified CLI.                      |
| TypeScript loading        | Pi uses `jiti/static` with aliases/virtual modules (including TypeBox). This transpiles extension code; it is not a compile-before-execute guarantee for agent programs. Strata checks those separately.                                         |

Primary references: [Pi extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [extension examples](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions), [SDK documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [loader implementation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/loader.ts). Locally inspected `permission-gate.ts`, loader, execution helpers, SDK docs and agent-loop/tool wrappers in the installed packages.

The existing [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) is relevant prior art: inspected its `mcp-code.ts` and `mcp-script-worker.mjs`. Its script path uses a Node worker, message-based tool calls, cancellation and bounded output, with search/describe support. That confirms composition is already useful in the Pi ecosystem. Strata's particular experiment is a persistent TypeScript compiler plus schema-derived callable declarations and a protocol-independent manifest/broker, hosted by Bun. We reuse the official MCP SDK rather than pulling in that extension's wider feature set.

## Responsibilities and dependency direction

`session.ts` creates the compiler and broker, runs checked code, and bounds the resulting report. Pi is a thin caller of this session interface. The executor knows the broker conversation; it does not know MCP. The broker depends on `CapabilityConnector` and normalized operation schemas; the MCP connector implements that contract using the official SDK. A second transport — a process-based CLI connector — implements the same contract without touching the compiler, broker, or executor: typed inputs become argv arrays (never shell strings), stdout must be pure JSON, and exit codes, stderr, parse failures, and spawn errors all surface as broker `transport` failures. This is what the benchmark compares against bash on identical data.

The manifest contains original operation names, input/output schemas, descriptions and effect hints. An operation's runtime binding is an entry in a generic generated API object. Quoted property names preserve arbitrary MCP names, including names that would collide under normalization. Duplicate protocol names are rejected. Each generated schema gets its own namespace and forced root type name to avoid collisions between schema titles and definitions. The broker holds any number of modules: operations are keyed by capability and name, so same-named operations in different modules stay isolated, and duplicate capability ids are rejected at load. `surfaces()` exposes the loaded set to the worker, which binds one frozen `api` object per `@cap/` module for that run.

The declaration generator is independent of MCP. It uses established JSON Schema tooling, not custom schema inference. AJV validators are compiled once per broker, with no mutation/coercion of inputs. Draft 2020-12 semantics are used; unsupported dialects or unresolved references fail setup. TypeScript represents the portions the generator can express; runtime validation remains the authoritative schema check.

The MCP connector paginates `tools/list` and preserves `structuredContent`, the untyped envelope, `isError`, and serialized byte size. It uses the SDK's generic `request` for `tools/call`: the higher-level `Client.callTool` also validates output, which would hide validation-stage accounting from the broker. Protocol envelope parsing remains the SDK's responsibility. See the [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Compiler contract

Programs are complete TypeScript modules, with imports and `export async function main()`. This avoids rewriting top-level returns or inventing REPL semantics; compiler locations refer directly to submitted source. The language service replaces one virtual source file and retains library/declaration state across runs. It uses strict checking, ES2022 libraries, no Node/DOM ambient types, and an allowlisted compiler filesystem. Only capability declarations and TypeScript standard libraries are visible.

A diagnostic prevents emission/execution. Suppression directives are disallowed. Type assertions remain legal TypeScript and do not bypass broker checks. Imports from host packages and dynamic imports are rejected; the runtime independently enforces its module allowlist. Declarations are hot-addable: `setDeclarations()` replaces the capability text with a bumped version so later compiles see newly loaded modules. Language-service completions and API discovery UX are not implemented.

TypeScript 7.0.2 was current in npm during investigation, but its package exposes the newer compiler architecture. The MVP pins 5.9.3 for its established synchronous language-service API. This is a dependency choice, not a Pi blocker.

## Execution alternatives

| Candidate                            | Assessment                                                                                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct Bun worker running emitted JS | Lowest friction, but it exposes ambient host process/filesystem/network capabilities. Type declarations alone cannot remove runtime access.                                                                                                        |
| Node worker / child process          | Good lifecycle isolation; still needs an execution environment that removes ambient host authority. Adds a second runtime if used from Bun.                                                                                                        |
| Node `vm` context                    | Familiar API, but a context is not a security sandbox. Host-object exposure and timeout behavior require care.                                                                                                                                     |
| QuickJS in Bun worker (chosen)       | Separate interpreter object world, explicit JSON bindings, module allowlist, heap/stack limits and interrupt handler. Worker termination adds responsive cancellation during infinite loops. Costs interpreter startup and serialization overhead. |

QuickJS is WebAssembly-hosted, with documented memory management and pending-job APIs; see [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten). Runtime functions return interpreter promises. The worker drains jobs and receives broker responses through messages. Each run owns and disposes its interpreter handles. No host object or function is passed directly into the interpreter: bindings exchange strings/JSON and interpreter handles.

## Authorization and trust

The locally configured allowlist grants specific operation names for one capability. MCP annotations are descriptive, never authorization evidence. A denied call does not reach the connector. Inputs are validated before transport; typed outputs require structured content and successful schema validation. An untyped result is `unknown`, including the original MCP envelope. Server `isError` results fail clearly without dumping payloads.

Programs can reach only broker bindings and bounded logging. Even computed access to hidden globals or a call to the underlying binding must pass broker policy and schema validation. The allowlist is per capability module; loading a module never grants invocation. Catalog search yields statically extracted data and never executes module code — the single sanctioned execution point is the connector build on `load_capability`. Pi's normal tools are a separate, intentional escape hatch and retain Pi's own interception behavior.

This is not a hardened hostile-code execution service. Pi extensions, dependency code, configuration, schema compilation and MCP servers execute with host trust. The host materializes MCP responses before the interpreter memory cap applies. Compiler work is synchronous and not preemptible; a source-size limit is not a compiler CPU quota. Interpreter/engine bugs are outside this prototype's guarantees. There is no OS-level sandbox or network namespace.

## Lifecycle and reporting

Cancellation terminates the worker and aborts pending requests. Shutdown aborts active executions, waits for run completion, disposes compiler state and closes every loaded connector. Mid-session loads regenerate declarations and return the new module's import block, so the model needs no prompt reload; declaration generation runs before the broker mutation, leaving no partial state on failure. A new session gets new infrastructure. A failed program loses only its worker/interpreter state. Effects already sent to servers cannot be rolled back by cancellation.

Reports include source size, durations, diagnostics, attempted calls with names/stages, actual connector call count, result-envelope bytes and final tool-text bytes. The report is snapshotted so a late cancellation response cannot mutate a returned metric. Logs and diagnostics are bounded, and oversized results fail with feedback. Metrics do not include raw results. The exact byte counter includes its own serialized field via a short fixed-point calculation; it excludes Pi protocol wrappers and system-prompt declarations.

The deterministic test fixture covers typed/nested/enumerated input, untyped output, large results, deliberate output violations, a denied effect, counters and cancellation. Fixture counters independently establish zero invocation for compile and policy rejection. Live-model checks are opt-in and keep transcripts local under `.work/`.

## Decisions since the MVP (2026-09-05)

**Benchmark backend: deterministic CLI twin, not a real CLI.** A real CLI would add version and environment variance that confounds exactly the comparison the benchmark exists to run. The twin serves identical data through `bash <cli>` (stock Pi) and `api.*` (Strata) with deterministic assertions and a real process boundary. Rejected and recorded; a real CLI stays an option once the controlled comparison is established.

**Catalog format: single-file TypeScript with static extraction.** Alternatives considered: JSON descriptors plus separate TS bindings (safe but two files to drift), TS files with a pure-const convention enforced only by discipline (single-file DX but security theater — search would execute), SQLite/FTS5 storage (verified working in `bun:sqlite`, zero deps — kept as the documented upgrade trigger at ~50 entries or measured ranking failures), and GraphRAG/embeddings (an LLM-indexing pipeline for narrative corpora; disproportionate at catalog scale, deferred until lexical methods demonstrably fail). The chosen middle holds: `export const meta` must be JSON-compatible literals (builder calls are rejected, so schemas are inlined), extracted via the compiler API without execution; `bindings` import only on load.

**Co-designed discovery (path C).** Wiring `search`/`load` without anything to discover would be unmeasurable; the twin split (core always-loaded, bulk `records` on demand) makes the wiring arrive with its own measurement as benchmark condition D. The full-twin transport and all v1 baseline artifacts are untouched, so the baseline stays comparable.

**What was built.** Multi-module broker with per-capability isolation, session hot-add (`load()`), `search_capabilities`/`load_capability` extension tools, `STRATA_CONFIG` `catalog` shape (`preload`, per-id `allow`), twin/CLI transports, and the paired benchmark runner (`examples/benchmark.ts`). Deliberately not built: dynamic authorization, MCP-backed catalog entries, dependency auto-pull, warm-session reuse, benchmark repeats.

## Evidence and what remains experimental

The deterministic demo composes two operations in one program and reduces a 10,000-record response from 1,947,738 bytes to approximately 400 bytes of Pi tool text (timings change the exact report size). The required A–G tests and actual Pi extension-loader integration pass.

This proves the vertical mechanism, not overall superiority to stock Pi. The paired benchmark (`examples/benchmark.ts`, protocol v1 in `.work/issues/001-benchmark.md`) ran 12 cells on a fixed model for $0.0062 with no fallbacks: 9/12 pass. Typed conditions used fewer tokens and tool calls on lookup/dependent tasks and composed as instructed; recovery contrasts a quoted CLI error against a zero-call compile rejection. The large-filter task failed identically in all conditions on ambiguous `{"total"}` wording — a pre-registered checker kept as a failure, with rewording filed as follow-up. A live discovery run (search → load → composed program) returned the fully correct large-filter answer. Single attempts only, cold processes, no denied-effect task: repeats, warm sessions, and wider tasks are filed follow-ups. Persistent objects, dynamic authorization, additional adapters, and agent orchestration remain deliberately deferred.

Live smoke verification on 2026-09-05 also passed with OpenRouter `meta/muse-spark-1.3-contributor`: intentional invalid input was rejected before calls, then a valid program performed three calls and returned the expected customer, invoice and record IDs. Its raw capability data was 1,947,909 bytes; Pi tool content was 557 bytes. No other tools were invoked. The fallback models were not needed. The local transcript and usage summary are in `.work/agent-smoke*`; model cost fields are Pi estimates, not a billing reconciliation.
