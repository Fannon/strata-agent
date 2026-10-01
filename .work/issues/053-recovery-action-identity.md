# 053 — Distinguish completed actions from pre-existing state during recovery

Status: DELIVERED 2026-10-01 — selected implementation complete; model-free production/session/Pi integration verified
Dependencies: 051 (observed recovery errors), 012 (effect authorization), 047 (replay and recurring workflows)

## Evidence and question

In 051's second always-check partial-payment recovery, checking had rejected the seed before any calls. The world already contained an older payment for the same invoice. The model checked whether *any* payment existed for that invoice, skipped the required new payment, and returned the expected success answer. The independent state grader correctly failed it. Its recovery program passed TypeScript checking and runtime validation.

In the second after-failure recovery, the intended additional payment was present and no duplicate was added, but the model returned total payments rather than the new amount requested. These are business-meaning failures, distinct from code errors and schema failures. Never-check's second recovery also computed the total, but its final response corrected the amount while violating the required answer format.

How should recovery evidence identify the action completed in this attempt, rather than merely show that some related state exists? An invoice ID alone did not distinguish an old payment from the requested new payment. The current fixture provides a readable ledger and call traces but no backend-enforced action idempotency key.

## Possible scope if selected

Explore clearer action receipts, stable request/idempotency identifiers where the backend supports them, and comparisons against a known pre-attempt state. Measure whether those signals improve recovery over existing traces with a capable baseline receiving the same evidence. Do not treat amount equality, a successful response, or a type-correct predicate as proof that the intended new action happened.

## Completion criteria if selected

Distinguish an older matching payment, a completed current-attempt payment, a rejected attempt with no effect, and an uncertain outcome. Verify actual final state independently of the agent's answer, including omissions and duplicates. Document limits for services without readable state or idempotency support. Preserve frozen 049/051 evidence; this follow-up does not authorize new capabilities, production changes or paid calls.

## Additional 054 evidence (October 1 documentation follow-up)

W1 checked GLM repetition 2 made five correct payments, returned an empty list after an incorrect total-ledger-entry-count filter, then inspected the now-paid invoices and denied having added payments. This was a wrong report after successful effects, without an uncertain backend reply. The proposed receipts should therefore also identify completed effects of successful earlier programs when later reasoning changes. IDs/amounts/outcomes must come from observable responses or state verification; never promote an uncertain call attempt to a confirmed receipt. 054 scores and sources remain frozen. This extends the deferred question, not its implementation authorization.

## Delivered implementation

A bounded host ledger records program/call identities, write/unknown classification, requested arguments, accepted responses and response-validation provenance. Statuses distinguish confirmed acknowledgements, not-executed denials/rejections and uncertain dispatches. program_effects supplies paginated evidence and grant-filtered operations declared read-only for state inspection; errors include a small retained-current-request summary. Completed calls stay acknowledged after later failures/cancellation. Known reads avoid receipt payload copying. History/evidence bounds and eviction are explicit; late outcomes cannot rewrite completed evidence.

Tests distinguish old/current payments and verify actual ledger state after an invalid MCP reply without replay; schema/transport uncertainty, denials, cancellation, budgets and retention are covered. No automatic retry/rollback, new backend idempotency guarantees or durable restart ledger. [Contracts and limitations](../../docs/results-and-recovery.md). No paid efficacy benchmark selected.
