# 053 — Distinguish completed actions from pre-existing state during recovery

Status: DEFERRED — discovered in selected GLM repeat 051; no implementation or new trial selected
Dependencies: 051 (observed recovery errors), 012 (effect authorization), 047 (replay and recurring workflows)

## Evidence and question

In 051's second always-check partial-payment recovery, checking had rejected the seed before any calls. The world already contained an older payment for the same invoice. The model checked whether *any* payment existed for that invoice, skipped the required new payment, and returned the expected success answer. The independent state grader correctly failed it. Its recovery program passed TypeScript checking and runtime validation.

In the second after-failure recovery, the intended additional payment was present and no duplicate was added, but the model returned total payments rather than the new amount requested. These are business-meaning failures, distinct from code errors and schema failures. Never-check's second recovery also computed the total, but its final response corrected the amount while violating the required answer format.

How should recovery evidence identify the action completed in this attempt, rather than merely show that some related state exists? An invoice ID alone did not distinguish an old payment from the requested new payment. The current fixture provides a readable ledger and call traces but no backend-enforced action idempotency key.

## Possible scope if selected

Explore clearer action receipts, stable request/idempotency identifiers where the backend supports them, and comparisons against a known pre-attempt state. Measure whether those signals improve recovery over existing traces with a capable baseline receiving the same evidence. Do not treat amount equality, a successful response, or a type-correct predicate as proof that the intended new action happened.

## Completion criteria if selected

Distinguish an older matching payment, a completed current-attempt payment, a rejected attempt with no effect, and an uncertain outcome. Verify actual final state independently of the agent's answer, including omissions and duplicates. Document limits for services without readable state or idempotency support. Preserve frozen 049/051 evidence; this follow-up does not authorize new capabilities, production changes or paid calls.
