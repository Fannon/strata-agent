# 065 — Decide whether and how to continue from the research checkpoint

Status: DEFERRED — recommendation captured 2026-10-02; no implementation or experiment selected
Authorization: user asked whether continuing is worthwhile and what to continue with; this authorizes assessment/documentation, not the proposed runs or fixes.
Dependencies: current evidence under 054/060/061; existing scope under 047/055/062/063/044

## Assessment and hypotheses

Mechanism demonstrated, narrow value observed, general advantage unproven. Continuing is worthwhile as a bounded test of a specific question. More generic adapters, catalog/memory machinery, executor work or model-specific tuning are not justified by current evidence.

Preferred practical hypothesis: a real recurring workflow over unfamiliar service contracts and substantial intermediate data could earn typed composition's context/repair costs. Candidate shape, not an identified user need: read-only reconciliation/reporting across two services. Actual service access, a recurrent caller need and independently verifiable outcomes must exist before selecting a campaign.

Pure research alternative: 055 can isolate the incremental benefit/cost of semantic checking on naturally authored new workflows. 049/051 already held declarations/runtime controls constant in a small policy pilot, including controlled prevention; do not describe 055 as the first isolation study. It targets the broader remaining question and is not a universal prerequisite.

## Proposed working order, only when selected

1. Identify one real recurring workflow, accessible through the existing MCP path where practical, with explicit acceptance conditions. Prefer read-only work initially. If no concrete need exists, retain the pause or separately select the bounded 055 research question.
2. Define a native-Pi/script versus checked-Strata comparison on equivalent access and data. Use new task instances, the shared interface across models and independent outcomes; establish compatibility for the chosen version/adapter. Freeze scope, matrix and spend before paid calls. Native Pi remains free to compose scripts.
3. If recurrence is real, apply 047's reuse evaluation: stored programs versus stored scripts, counting authoring/retrieval/adaptation and failures. This does not require implementing generic memory/catalog infrastructure or testing reuse and discovery simultaneously.
4. Investigate 062 before stronger effectful claims; pursue 063 only for a selected critical workflow with caller-defined postconditions. Neither expands the initial read-only question into a general completion framework.
5. Consider 044 hybrid only if observed workflow/tool-choice friction justifies another arm. Do not assume it wins. Discovery, transport expansion and checking attribution remain separate questions.

055 is an alternative research route when compiler attribution is the selected question, not a gate before steps 2/3. Its implementation and matrix remain owned by that issue. Existing 047/061 own reuse/generalization experiments; this issue selects among paths rather than duplicating their implementation scope.

## Decision and stopping criteria

Choose the question and concrete acceptance threshold before implementation. Every comparison must publish sample/distinct-task counts, primary answer/effect correctness, strict output diagnostics, model requests, separate capability invocations, token/cache/reasoning accounting, elapsed time and estimated cost/per-success including failures. Preserve negative results and historical sources.

Continue only when the bounded result reveals useful task-level value or resolves a meaningful research uncertainty. Do not repeat tuning merely to rescue an unfavorable result. If the use-case comparison shows no worthwhile benefit, retain the capability layer as a learning artifact and pause. Any positive task-level claim needs untouched-task confirmation and cross-model evidence appropriate to its scope.

## Completion criteria if selected

A concrete workflow or research question, versioned protocol and caller-approved bounds; completed comparison with independently checked outcomes; explicit continue/narrow/stop decision. Capturing this issue does not authorize service writes, new adapters, additional model spend or any deferred implementation.
