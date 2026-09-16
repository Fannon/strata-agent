# 039 — Typed REST operations via client generation

Status: idea only, captured 2026-09-14 (user requirement; not authorized for implementation)
Kind: capability-transport follow-up
Source: user direction 2026-09-14 during the 037 AppWorld spike review
Dependencies: 012 scoped permissions (effect policy); 017 capability relationships; 035/037 enterprise scaling (demand signal)

## Direction and updated hypothesis

The earlier MCP/REST-only framing is superseded by the broader typed-function hypothesis in the README: local/CLI operations, MCP tools and REST APIs may share a composable interface. Prefer existing contracts and generated clients over bespoke adapters. This issue owns only the REST investigation; it neither removes existing local tools nor authorizes a universal adapter framework. REST is not a dependency of the current MCP experiment.

## Current gap

- MCP over stdio: delivered (`src/capabilities/mcp/connector.ts`); schemas
  pass through untouched and declarations derive from them.
- CLI adapters: delivered twin + catalog, but catalog entries only support
  `cli-twin` transport — every new CLI surface needs hand-written bindings.
- HTTP transport: not built (explicitly out of the 037 spike).
- OpenAPI importer / REST client generation: not built. There is no path
  from an OpenAPI document to a capability module today.

## Proposed direction (evaluate before building)

1. Survey mature OpenAPI client-generation libraries for the narrow job:
   turning endpoint definitions (paths, methods, params, request/response
   schemas) into typed functions. Candidates to inspect, not pre-selected:
   `openapi-typescript` (types only), `openapi-fetch` (typed fetch client),
   and whatever the OpenAPI-3.1 ecosystem currently recommends. Criteria:
   output must feed the existing declaration generator (`schemas.ts`) and
   broker validation; generated network clients may run in the trusted connector while sandboxed programs call typed bindings. Do not require a fetch-based client to run inside QuickJS. No new runtime dependency without justification.
2. Define the transport policy first: per-operation allowlist (same broker
   semantics as MCP), base-URL pinning, auth/secret handling that keeps
   credentials out of programs, prompts, traces and artifacts, timeouts and
   byte caps consistent with existing process supervision.
3. Only then build: OpenAPI → capability module synthesis plus an HTTP
   connector, behind the same `createSession`/broker path as MCP/CLI.

## Non-goals for the first slice

- No universal OpenAPI importer covering every exotic construct; start with
  the subset a concrete benchmark task needs and report the rest as gaps
  (same discipline as the AppWorld date-time finding).
- No auth-credential management system; secrets stay operator-side.
- No replacement of the MCP path; REST is the second typed transport, not
  a migration.

## Acceptance

A pinned OpenAPI document yields a capability module whose declarations,
broker validation, policy denials and traces behave identically to an
MCP-backed module on the same operations, verified by deterministic tests
plus one small live comparison. Until then this stays an idea, not a claim.
