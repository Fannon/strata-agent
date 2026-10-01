# 058 — Deliver selected structured results without reformatting them

Status: DELIVERED 2026-10-01 — selected implementation complete; model-free production/session/Pi integration verified
Dependencies: 054 format evidence; 052 main result contract; 053 if effect receipts are included

## Evidence and hypothesis

Checked GLM scored 59/60 answer/state successes but only 36/60 pure JSON successes. Twenty-three otherwise successful attempts lost strict success solely to the final wrapper. Native GLM had seven otherwise successful wrapper failures, plus one unparseable JavaScript literal with correct-looking content/effects. These are separate from incomplete pagination and incorrect payment claims.

Hypothesis: canonical host serialization of an explicitly selected computed result can prevent wrappers and quoting mistakes without another prose-to-JSON repair turn.

## Scope if selected

Design an explicit selection/finalization path for a successful structured program result, with optional explanation delivered separately. Verify actual Pi host integration before promising an implementation. Do not automatically select the last tool result, treat every valid JSON value as business-correct, or deliver a stale result after a later failure. Selection and delivery must remain auditable. Bound any result retention and account for additional tool/model requests or context.

## Acceptance if selected

Correct serialization without Markdown or JavaScript literals; explicit result identity; preservation of business/state grading and errors. Evaluate raw format compliance, substantive completion, turns/tokens/time/cost, including finalization overhead. Keep existing primary scores intact; do not retroactively regrade 054 through a new formatter.

## Delivered implementation

The shared production Pi extension exposes finalize_result(program) and optional typed_program finalize:true. Selection is explicit and scoped to the latest completed successful program in this request, with active/closed/expired/stale guards. The host retains bounded immutable JSON and replaces the normally completed assistant answer using Pi's message_end hook; state/events/persistence agree, with original usage and thinking retained. New programs, external tools, user/steering requests and failed/truncated completions invalidate selection. Finalization does not certify business correctness.

Actual pinned Pi SDK tests cover inline/explicit selection, exact JSON despite model fences/prose, persistence, stale results, external tools and new requests. Inline selection adds no separate selection tool turn; explicit selection adds a tool call, and both retain the normal final provider request. No paid token/time/cost efficacy claim. [Implemented contracts](../../docs/results-and-recovery.md) document streaming and retention limits; existing primary benchmark scores remain unchanged.
