# 063 — Evidence for completion of required business actions

Status: DEFERRED — discovered in 061; no implementation or extra paid experiment selected
Dependencies: 053 bounded receipts, 058 explicit finalization; a caller-defined effectful workflow with meaningful acceptance conditions

## Observation

`N3-ling-candidate-r2` computes the correct `{credits:[...]}` answer and explicitly selects it, but its source never calls `creditCustomer`. Exact answer grading passes; independent final-state grading fails on a missing credit. Compiler, schema and serialization checks cannot detect this business omission. Receipts describe actions attempted; an empty receipt set does not establish that all requested actions were performed. There is no runtime error to trigger recovery advice.

## Hypothesis and possible selected scope

For a concrete critical workflow, a final completion step could compare explicit caller-defined required actions or postconditions with receipts and current-state reads. An alternative is a shared prompt reminder to execute writes and verify their responses before finalization. Compare these separately rather than making finalization universally infer business intent from arbitrary returned JSON. Receipts alone do not verify final business state; a reported action list can represent a plan rather than execution.

## Completion criteria if selected

Use a bounded non-idempotent workflow with missing, duplicate and wrong-value controls. Declare expected effects independently of the model's returned answer. Measure whether the shared approach catches omissions without adding unsafe replay, blocking legitimate read-only results or hiding cost/turn/time increases. Include new model/task evidence and keep output correctness distinct from actual effect correctness. Preserve 061 scores and production defaults.

## Proposed order

Consider 062's model-free entry/scheduling investigation before broader effectful claims, then this workflow-specific hypothesis if the user selects a critical-task study. Broader new-API portability and native comparison remain under 061; this discovery activates neither.
