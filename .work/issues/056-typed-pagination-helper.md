# 056 — Reduce pagination and generic-type repair work

Status: narrow prototype delivered under 060 — not promoted; broader redesign/integration remains deferred
Dependencies: 054 evidence; 005 execution limits; 055 if attributing gains to checking

## Evidence and hypothesis

Of 60 checked GLM attempts on 20 definitions, 19 encountered compilation rejection, producing 28 rejected programs. Sixteen rejected programs declared their own pagination helper (`all`, `page`, `pageAll`, `paged`, `listAll`, `paginate` or `pageno`). Diagnostics repeatedly concerned invented `items`/`rows` fields, incompatible generic return types, unknown page/row values and nullable cursors. This association does not prove that a helper would remove every rejection.

Hypothesis: a tested helper with inference from the actual API response removes repetitive cursor and generic-type work while preserving precise row types. The model can spend its code on business rules.

## Scope if selected

Prototype a bounded read helper, for example `collectPages(api.listInvoices, page => page.invoices)`, with inferred invoice rows. This spelling is a proposal, not a shipped API. Use declared pagination contracts; do not assume every remote service has this response shape. Keep every underlying invocation in the existing broker, grants, schemas, trace and program budgets. Detect repeated cursors, stop on the declared terminal cursor and enforce page/record bounds. No automatic retries of writes or general untyped result escape.

Compare a helper with a small correct inline example on disjoint development tasks. Account for helper declaration/context cost, implementation complexity and any changed call limits. The user subsequently requires a model-independent approach: any helper must serve the shared API contracts without model-specific prompts or implementation branches.

## Acceptance if selected

Verify complete pagination and exact row-type inference, nullable cursor handling, repeated-cursor/record limits and preservation of missing-property diagnostics. Test against fresh tasks with both models, counting answers/effects, formatting, requests, tokens, time and all costs. Preserve 054 as the unchanged baseline; use a new version rather than replacing its failures.

## 060 outcome

The user subsequently authorized the bounded prototype only. See [tuning report](../../docs/strata-tuning-results.md) for the full hypotheses, comparisons, selection, confirmation and decisions, including all success/effect/request/token/time/cost evidence. Existing broader scope and acceptance criteria above remain proposals, not newly selected work. Production defaults are unchanged.
