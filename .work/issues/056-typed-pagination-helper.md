# 056 — Reduce pagination and generic-type repair work

Status: DEFERRED — proposed in the authorized post-054 documentation review; no implementation or paid trial selected
Dependencies: 054 evidence; 005 execution limits; 055 if attributing gains to checking

## Evidence and hypothesis

Of 60 checked GLM attempts on 20 definitions, 19 encountered compilation rejection, producing 28 rejected programs. Sixteen rejected programs declared their own pagination helper (`all`, `page`, `pageAll`, `paged`, `listAll`, `paginate` or `pageno`). Diagnostics repeatedly concerned invented `items`/`rows` fields, incompatible generic return types, unknown page/row values and nullable cursors. This association does not prove that a helper would remove every rejection.

Hypothesis: a tested helper with inference from the actual API response removes repetitive cursor and generic-type work while preserving precise row types. The model can spend its code on business rules.

## Scope if selected

Prototype a bounded read helper, for example `collectPages(api.listInvoices, page => page.invoices)`, with inferred invoice rows. This spelling is a proposal, not a shipped API. Use declared pagination contracts; do not assume every remote service has this response shape. Keep every underlying invocation in the existing broker, grants, schemas, trace and program budgets. Detect repeated cursors, stop on the declared terminal cursor and enforce page/record bounds. No automatic retries of writes or general untyped result escape.

Compare a helper with a small correct inline example on disjoint development tasks. Account for helper declaration/context cost, implementation complexity and any changed call limits. A model-independent helper is preferable to different prompt policies selected per model unless evidence supports the latter.

## Acceptance if selected

Verify complete pagination and exact row-type inference, nullable cursor handling, repeated-cursor/record limits and preservation of missing-property diagnostics. Test against fresh tasks with both models, counting answers/effects, formatting, requests, tokens, time and all costs. Preserve 054 as the unchanged baseline; use a new version rather than replacing its failures.
