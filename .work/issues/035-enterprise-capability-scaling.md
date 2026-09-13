# 035 — Enterprise discovery and typed composition at catalog scale

Status: research/concept captured; experiment not selected
Source: user asks whether dynamic enterprise applications/APIs/permissions are a better fit than local CLI replacement.
Dependencies: 003 discovery, 012 authorization, 026 traces; informed by 004 context-cost findings. Does not displace the active 004 slice or authorize enterprise infrastructure work.

## Hypothesis and limits

Typed composition may be more useful for unfamiliar structured service APIs than familiar local CLI work: multi-service reads/joins can avoid passing intermediate objects through the model and may avoid repeated interface mistakes. Enterprise fit remains unmeasured. The existing repository trials show higher typed cost on their corpus; they do not establish enterprise benefit or failure.

Separate catalog scale (discovering relevant operations) from execution scale (composing calls/data). Native direct tools can use the same lazy discovery. A giant generated SDK in every prompt defeats the hypothesis; a small retrieved working set is essential. For simple one-call tasks, already aggregated endpoints, stable workflows better expressed as deterministic jobs, or APIs requiring judgment/approval after each step, code composition may add little.

See [primary-source research](../../docs/research/enterprise-capability-scaling.md). Vendor context-reduction examples are motivation, not Strata task-cost evidence.

## Existing OpenAPI / JSON Schema contracts

This is a material difference from CLI replacement: accurate existing contracts can supply operation/parameter/result structure and support generated TS declarations, validation and client bindings. Reuse them instead of redesigning each endpoint. Verify actual schema coverage/quality and supported dialects; runtime correctness, auth decisions, cross-service identity/units, pagination and error behavior are not guaranteed by a typed spec. Measure integration effort as well as task cost. The fixture experiment should ingest small OpenAPI documents (plus MCP metadata where useful) through a defined supported subset rather than hand-authoring only perfect TS interfaces. No production adapter/generator implementation is authorized here.

See [enterprise concept](../../docs/enterprise-capabilities.md) and [OpenAPI research](../../docs/research/enterprise-capability-scaling.md#existing-contracts-change-the-integration-economics).

## Proposed responsibilities

- Catalog/discovery indexes installed and discoverable operations; policy-aware filtering must not disclose unavailable application metadata. Start with lexical/domain retrieval and measure misses before graph/embedding infrastructure.
- Load only the selected declarations/bindings into the program's working set. Cache schema identity/version separately from tenant/principal policy context. Server-side catalog storage can be large while model-visible context stays small; retrieval/completeness still has a cost.
- Compiler checks against an explicit contract snapshot. API schema updates, operation disablement and grant revocation are different events; business data changes need not regenerate declarations.
- Every invocation validates arguments and current authority at the broker/service boundary, including resource/record scope where relevant. Discovery and successful compilation never grant access. Downstream services remain the authority for their business rules; access tokens and tool metadata alone do not capture all of them.
- On a stale contract, deny/reload/recheck or maintain explicitly supported versions. On revocation, deny subsequent protected effects without rerunning earlier writes. Define in-flight cancellation limits; revocation cannot undo an already accepted external action.
- Keep credentials outside generated programs; enforce network/host access separately where bypass resistance matters. Cooperative direct Bun is not sufficient for an untrusted multi-tenant claim.
- Preserve response provenance, pagination/completeness, rate/concurrency limits and partial failures. Do not fetch entire enterprise datasets just to demonstrate filtering; use server-side query/batch endpoints where available. Typed field shapes do not establish semantic compatibility of customer IDs, currencies or timestamps.
- Writes/approvals need idempotency and explicit partial-effect recovery; short programs do not create cross-service transactions. Start with reads.

## Small proposed experiment (when selected)

1. Model three synthetic business services (customer records, billing, support) with typed schemas and deterministic data. Task: join overdue invoices with relevant support cases and account owners into an exact review report. Include one single-call control and one server-aggregated endpoint control.
2. Add realistic distractor metadata at staged catalog sizes (e.g. 100/1,000/10,000 operations); only a small known subset is needed. Do not implement thousands of fake adapters. Freeze held-out request phrasing and independently computed answers.
3. Compare lazy-discovered direct tool calls with lazy-discovered typed composition using identical discovery results, API access and backend data. Keep model, policy and runtime constraints explicit; all-tools-in-prompt is a secondary diagnostic, not the only baseline. Static-checking on/off is a separate ablation.
4. Change allowed operations/record access and one schema between discovery, compilation and invocation. Independently assert denial before unauthorized mock effects, stale-schema recovery, no cross-principal cache reuse, and no replay of completed actions. Simulated cancellation must document already-dispatched work.
5. Measure task correctness/cost/latency, retrieval recall, discovery rounds, visible schema/context bytes, model responses, broker calls, upstream bytes/rate-limit events, stale-contract recovery and forbidden effects. Distinguish request authorization from actual record-level service checks.

Acceptance: evidence identifying whether benefits come from lazy discovery, composition, checking or structured backends. A small working set at large catalog size alone is not task-level superiority. Report negative controls and failures. Only then decide whether to expand enterprise support or keep the project focused on Pi experiments.

## Current implementation gap

Strata has a small static local catalog and additive loading, operation allowlists and repository-specific resource checks. It has no complete dynamic enterprise catalog subscription, contract replacement/unload lifecycle, per-principal policy cache, live business-resource authorization or cross-service approval/recovery system. Existing MCP connectivity is a starting adapter, not proof these features exist. 025/029 become relevant if dynamic discovery is selected; 017 dependencies/supersession remain demand-driven.

## Benchmark reuse follow-up

[037](037-enterprise-benchmark-reuse.md) proposes AppWorld for cross-app state-graded composition and BFCL for invocation/relevance diagnostics. Reuse existing APIs and graders before inventing a custom suite; catalog-size and live-permission tests remain separate controlled extensions.
