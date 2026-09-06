# Typed composition across dynamic enterprise capabilities

Reviewed 2026-09-06. Primary-source research and experiment proposals; no enterprise performance or security result is established for Strata here.

## Verified prior art

Cloudflare distinguishes two Code Mode patterns. A single code tool includes TypeScript declarations for every upstream operation and fits manageable catalogs. Its search/execute pattern instead queries an OpenAPI document inside the execution environment, returning selected definitions before composing authenticated requests. Credentials remain in the host callback, where authorization still belongs. This separation is directly relevant: moving thousands of declarations into one tool description does not remove their context cost. [Cloudflare patterns](https://developers.cloudflare.com/agents/model-context-protocol/codemode/)

Cloudflare reports exposing over 2,500 endpoints through two tools with approximately 1,000 interface tokens. This is vendor-reported interface footprint, not total workflow tokens, discovery latency, correctness, or an independent comparison with lazy direct tools. Retrieved schemas and results still consume context. [Cloudflare API MCP server](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/)

Anthropic describes generating discoverable TypeScript files for MCP operations, loading selected definitions, and filtering intermediate data in code. Its example reports 150,000 to 2,000 tokens. Treat this as an illustrative vendor result, not evidence of universal savings or a benefit attributable specifically to semantic TypeScript checking. [Anthropic engineering](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Existing contracts change the integration economics

OpenAPI describes HTTP operations, parameters, bodies, responses and security requirements. OpenAPI 3.1 Schema Objects use the JSON Schema 2020-12 model with OAS-specific additions. This supplies reusable source material for declarations and validation, rather than requiring a new typed interface inferred from CLI text. Descriptions differ in completeness and accuracy; support must be defined for the actual dialect, references, serialization and response variants. A security-scheme description is not a live authorization decision. [OpenAPI 3.1.1 specification](https://spec.openapis.org/oas/v3.1.1.html)

Architectural inference: reuse source contracts and existing SDKs where they fit, adapting only for concrete discovery, execution, result-bound or policy needs. The claim that enterprise APIs are usually well typed is customer-dependent and should be sampled, not assumed. Generated structural types cannot establish cross-service business meaning or runtime correctness. Measure schema coverage and integration effort alongside task performance.

## Dynamic availability and authorization

MCP's 2025-11-25 tools specification already provides paginated discovery and optional tool-list change notifications. Output schemas are optional, so MCP connectivity alone does not guarantee useful result types. [2025 tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

The 2026-07-28 tools specification explicitly permits the available set to vary with authorization presented on each request, while prohibiting variation caused merely by connection state or unrelated requests. It recommends deterministic ordering and describes change notifications. These protocol-version-specific provisions should not be assumed implemented by Strata's current adapter. [2026 tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

MCP's HTTP authorization specification defines transport authorization and runtime scope challenges. It does not supply an organization's entire resource, field, approval or cross-application data policy. Those remain implementation responsibilities; successful authentication is insufficient evidence that a particular business action is permitted. [Authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

## Fit hypotheses and limits

**Promising:** a large catalog where each task needs a small subset, followed by several predictable operations, pagination, joins or aggregation. Discovery can keep irrelevant definitions out of context; execution can keep unnecessary intermediate records out. These are separate mechanisms. A typed program may connect unfamiliar enterprise APIs more reliably, but generated types cannot resolve business meaning, incompatible identifiers or missing schemas.

**Weak fit:** a few familiar operations, one-shot lookups, tasks needing model interpretation after almost every result, or APIs already offering the complete aggregate query. Discovery, compilation and generated code can become pure overhead. Fixed, frequently repeated business processes may deserve a maintained workflow rather than newly generated orchestration.

Dynamic catalogs increase potential value and maintenance burden together. A declaration describes an observed contract, not continuing permission. Proposed handling should distinguish schema changes, connector removal, expired credentials and resource denials. Cache identities must include tenant/principal scope where relevant. Check current authorization at each effect; never treat discovery or compilation as a grant. Already completed writes cannot be undone simply by revoking the next call. These are architectural inferences, not shipped guarantees.

## Small discriminating experiment

Use deterministic CRM, billing and support fixtures before adopting real customer integrations. Independently vary catalog size, selected-operation count, workflow depth, payload size and availability changes. Include an easy lookup, paginated cross-service aggregation, ambiguous operation discovery, and revocation between discovery and invocation. Use plausible distractors and unfamiliar held-out names instead of padding a catalog with meaningless duplicates.

Compare eager direct tools where feasible, **lazy direct tools with the same discovery**, and typed composition over the same backends and authorization. A semantic-checking ablation can then isolate checking from composition. Measure discovery recall, task correctness, total tokens/cost, latency, upstream calls, repair attempts, unauthorized effects and trace completeness. Large catalogs alone should benefit both lazy approaches; typed composition must earn an additional advantage. This is a proposed follow-up experiment, not a reason to infer enterprise success from current repository trials or immediately build a general enterprise platform.
