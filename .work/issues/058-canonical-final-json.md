# 058 — Deliver selected structured results without reformatting them

Status: DEFERRED — post-054 proposal; no runtime/output integration selected
Dependencies: 054 format evidence; 052 main result contract; 053 if effect receipts are included

## Evidence and hypothesis

Checked GLM scored 59/60 answer/state successes but only 36/60 pure JSON successes. Twenty-three otherwise successful attempts lost strict success solely to the final wrapper. Native GLM had seven otherwise successful wrapper failures, plus one unparseable JavaScript literal with correct-looking content/effects. These are separate from incomplete pagination and incorrect payment claims.

Hypothesis: canonical host serialization of an explicitly selected computed result can prevent wrappers and quoting mistakes without another prose-to-JSON repair turn.

## Scope if selected

Design an explicit selection/finalization path for a successful structured program result, with optional explanation delivered separately. Verify actual Pi host integration before promising an implementation. Do not automatically select the last tool result, treat every valid JSON value as business-correct, or deliver a stale result after a later failure. Selection and delivery must remain auditable. Bound any result retention and account for additional tool/model requests or context.

## Acceptance if selected

Correct serialization without Markdown or JavaScript literals; explicit result identity; preservation of business/state grading and errors. Evaluate raw format compliance, substantive completion, turns/tokens/time/cost, including finalization overhead. Keep existing primary scores intact; do not retroactively regrade 054 through a new formatter.
