# 057 — Give smaller, actionable compiler feedback

Status: DEFERRED — post-054 proposal; no implementation or benchmark selected
Dependencies: 054; 031 bounded program details; 015 patch proposals remain separately scoped

## Evidence and hypothesis

Checked GLM produced 28 rejected programs and 161 reported diagnostics. Sixty-three TS18046 diagnostics concern unknown page/row values, often after a helper's generic response type was already wrong. They were not evidence of faulty exception handling. GLM spent extra model requests repairing code; local compiler time was approximately 171 ms/attempt across checks/repairs.

Hypothesis: leading with an actionable cause and relevant API shape can reduce repeated rewrites and output/context cost while preserving the same compile gate.

## Scope if selected

Present the primary diagnostic with source location and the expected API/response fields. Make remaining diagnostics available on demand; do not blindly hide unrelated errors or claim the first diagnostic is always the root cause. Distinguish no calls from this rejected program from effects of earlier programs. Preserve full diagnostics and call evidence in local audit/details. Consider a concise repair example before adding a source-patch tool; that larger feature is not implicitly selected.

## Acceptance if selected

Demonstrate that diagnostics are understandable without losing relevant errors or effect evidence. Compare unchanged compiler decisions with different feedback on new tasks; report repair requests, tokens, latency, cost, answer/effect correctness and diagnostic retrieval. Keep quiet clean checks and frozen baseline evidence.
