# 038 — Diagnose missing typed-program reports before evaluator reuse

Status: follow-up recorded 2026-09-14; implementation not selected separately
Dependencies: 004 slice C evidence; 009 runner contracts

## Evidence

The September 13 R-CALL confirmation recorded two compact R-CALL-2 cells with correct answers and compliant policy but `Missing structured typed_program report` harness errors. Preserve both failures and the negative/inconclusive verdict. See [004](004-harness-tuning.md#slice-c--confirmation-result-ran-once-2026-09-13-author-paid-frozen-matrix-above).

## Bounded next work

Inspect those local traces without exporting private model text. Identify whether the report was absent at execution, lost in Pi event serialization, or misclassified by the evaluator. Reproduce with a deterministic regression before modifying production or grading behavior. Fix only the demonstrated cause, retain old artifacts, and version any changed protocol. No paid rerun or historical regrade follows automatically.

Acceptance: a trace-grounded diagnosis and deterministic regression/fix, or a documented reason the error cannot be reproduced. Resolve before reusing the affected evaluation path in a new comparison; an independent AppWorld runner need not inherit it.
