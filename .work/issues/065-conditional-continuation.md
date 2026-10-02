# 065 — Decide whether and how to continue from the research checkpoint

Status: SELECTED 2026-10-02 — bounded AppWorld study; environment/preflight and protocol freeze underway
Authorization: user subsequently said “ok, go ahead with it,” selecting the bounded continuation. Begin workflow selection and environment/preflight work. User chose the existing AppWorld integration as the fallback. This selects simulated application tasks, not live services or recurring-workflow/product validation. No service writes or unrelated backlog work selected.
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

## Selected preflight, October 2

Workspace has no AppWorld environment/data, despite the historical integration code. Installed Pi is 1.0.0, not the historical 0.99.1 comparator; production dependency remains 0.73.1. Typecheck and 22 focused finalization/recovery/entry-parity tests passed (151 assertions). This is not full-suite or Pi 1.0 compatibility certification.

Asked the user to identify a real recurring workflow/services, with the existing AppWorld integration offered as a bounded application-study fallback. AppWorld would be simulated application evidence, not a live-service recurrence/product validation. Check environment feasibility while that choice is pending. Any selected paid matrix needs new source/version pins, independent grading, frozen scope and a conservative campaign cap; preserve all prior evidence.

## Selected application study

Use installed Pi 1.0.0 native Codemode versus the current checked session, sharing the MCP surface, broker schema validation and read/auth/submission grants. Six new training-task families, three existing sibling worlds each, two models and two approaches: 72 evaluation attempts plus four separate calibration attempts. Conservative estimated model-cost cap: $2 including calibration. Source/data/environment hashes and protocol are frozen before paid calls. No reuse/discovery arm or shared-recipe tuning. See [protocol/report](../../docs/application-study.md).

Rebuilt ignored AppWorld source/environment/data at upstream `42b5bcf3cd334fee33f0c37c02070a9f5807add5`, Python 3.11.16, package 0.2.0.dev0, data 0.2.0, MCP 2.2.0. Model-free Pi 1.0 adapters and live MCP reads work for Spotify and Venmo/Phone. Initial grader controls exposed two harness mistakes: materializing task-input snapshots altered subsequent change-log saving, and AppWorld's frozen clock distorted timing. Fixed before paid calls; prior preflight artifacts preserved. Full upstream environment suite is not green (dependency/date and sandbox local-server failures); selected-path probes and independent grader controls must pass. This is not production extension certification.
