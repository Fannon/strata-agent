# 008 — Benchmark backend spike: deterministic CLI twin selected

Status: done (2026-09-05, commit e64e313)
Kind: spike feeding [002](002-typed-cli.md)
Source: review 2026-09-05 (assistant + user)
Dependencies: task/interface direction from [001](001-benchmark.md); feeds the backend choice in [002](002-typed-cli.md).

## Current interpretation (2026-09-05 reconciliation)

The selected backend spike is done as a deterministic CLI twin. A second real MCP integration was not built; the original title/candidate observations below describe the pre-spike state. Real repository semantics now belong to [011](011-native-repository-capabilities.md), rather than reopening the completed fixture choice.

## Motivation

The current fixture is synthetic and MCP-only. Issue 002 must pick one shared backend for CLI-through-bash versus typed-function comparison. A second, slightly real fixture would test whether the manifest/broker/declaration path handles real-world schemas (nullable fields, unstructured text, exit-code-style errors) before committing to the benchmark backend.

## Confirmed observations

- Only `test/fixture-mcp/server.ts` exists; all byte-reduction evidence comes from it.
- `README.md` vision includes typed CLI wrappers; none are built, and the broker contract for process exit codes/stderr is undefined.

## Candidates (not decisions)

- Read-only SQLite or filesystem MCP with 2–3 operations (e.g. `search`/`getRecord`), pinned version, seeded data.
- Fixture-data-over-tiny-CLI plus equivalent typed capability (fully deterministic, less realism).
- One real CLI with structured output (more realism, version/environment variance).

Hypothesis: a read-only data lookup is the smallest operation set that exercises truthful `unknown` vs. validated types, failure translation, and policy denial. Not yet evidenced.

## Open questions

- Which backend gives deterministic assertions without pinning an uncontrolled external CLI version?
- How should stderr/exit-code/parse failures surface as typed-runtime errors (carried `isError` vs. thrown broker error)?
- Does this fixture become the 002 benchmark backend, or is it throwaway scaffolding?
- What stays read-only, and what allowlist entries does the spike need?

## Next step when selected

Agree with 001 on 2–3 equivalent operations and deterministic checks, then build the spike behind the existing `CapabilityConnector` interface. No discovery, HTTP/auth, or general CLI framework.

## Completion report (2026-09-05)

**What was built and why:** instead of a second MCP server, the spike built a deterministic **CLI twin** of the fixture (`test/fixture-cli/cli.ts`: `customers --country`, `invoices --customer-ids`, `records --count`) plus a generic process-based `CapabilityConnector` (`src/capabilities/cli/connector.ts`). Rationale: 002's first candidate approach is exactly this — controlled CLI-vs-typed comparison on identical data — and a new transport exercises the architecture's central claim (manifest/broker are protocol-independent; only the connector knows about processes) without touching the compiler, broker, or shipped MCP path.

**Contract (matches 002's requirements):** typed input maps to an argv array, never a shell string; stdout must be pure JSON (diagnostics on stderr); exit≠0, bad JSON, and spawn failures become broker `transport` errors with truncated stderr; allowlist policy and AJV validation still run before any process spawns. Like MCP payloads, CLI stdout is materialized in host memory — recorded as shared follow-up under 005/007, not solved here.

**Evidence:** 8 new tests in `test/integration/cli-connector.test.ts`, full suite 31 pass / 0 fail, `bun run check` clean, fixture demo unchanged. Coverage: typed invocation, cross-process composition, 10k-record byte reduction via CLI transport, compile-time enum rejection with zero spawns, runtime range rejection before spawn, policy denial before spawn, exit-2/stderr translation, unstartable-command transport error, and CLI↔MCP twin parity on identical inputs (guards the two backends against silent drift).

**Recommendation for 002:** adopt this CLI twin as the benchmark backend — it gives identical data through `bash <cli>` (stock Pi) and `api.*` (Strata), deterministic assertions, no server-version variance, and a real process boundary. Open question answered: 3 ops (`customers`, `invoices`, `records`) suffice; stderr/exit-code mapping is `transport: exit <code>: <stderr…>`.

## Original completion criteria

- Second fixture runs through broker policy + AJV validation + declarations with tests for argument fidelity, failure translation, and pre-execution denial.
- Written recommendation for the 002 backend choice (adopt spike, adapt it, or reject with reasons).
- Existing fixture demo and 22 tests unaffected.
