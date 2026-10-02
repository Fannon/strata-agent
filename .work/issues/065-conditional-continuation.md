# 065 — Decide whether and how to continue from the research checkpoint

Status: DELIVERED 2026-10-02 — bounded AppWorld comparison completed; recommend retaining the pause
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

At the initial preflight, the workspace had no AppWorld environment/data, despite the historical integration code. Installed Pi is 1.0.0, not the historical 0.99.1 comparator; production dependency remains 0.73.1. Typecheck and 22 focused finalization/recovery/entry-parity tests passed (151 assertions). This is not full-suite or Pi 1.0 compatibility certification.

Asked the user to identify a real recurring workflow/services, with the existing AppWorld integration offered as a bounded application-study fallback. AppWorld would be simulated application evidence, not a live-service recurrence/product validation. The user subsequently selected AppWorld; that clarification is resolved. Any selected paid matrix needs new source/version pins, independent grading, frozen scope and a conservative campaign cap; preserve all prior evidence.

## Selected application study

Use installed Pi 1.0.0 native Codemode versus the current checked session, sharing the MCP surface, broker schema validation and read/auth/submission grants. Six new training-task families, three existing sibling worlds each, two models and two approaches: 72 evaluation attempts plus four separate calibration attempts. Conservative estimated model-cost cap: $2 including calibration. Source/data/environment hashes and protocol are frozen before paid calls. No reuse/discovery arm or shared-recipe tuning. See [protocol/report](../../docs/application-study.md).

Rebuilt ignored AppWorld source/environment/data at upstream `42b5bcf3cd334fee33f0c37c02070a9f5807add5`, Python 3.11.16, package 0.2.0.dev0, data 0.2.0, MCP 2.2.0. Model-free Pi 1.0 adapters and live MCP reads work for Spotify and Venmo/Phone. Initial grader controls exposed two harness mistakes: materializing task-input snapshots altered subsequent change-log saving, and AppWorld's frozen clock distorted timing. Fixed before paid calls; prior preflight artifacts preserved. Full upstream environment suite is not green (dependency/date and sandbox local-server failures); selected-path probes and independent grader controls must pass. This is not production extension certification.

## Delivery and decision

Frozen implementation `c8d9acb`; completed 72 evaluation attempts (six definitions × three existing worlds × two models × two approaches), plus four calibration attempts. [Report](../../docs/application-study.md); [sanitized evidence](../../docs/evaluations/application-2026-10-02.json). Both arms share MCP grants and broker validation; native uses actual installed Pi 1.0 Codemode. No production changes or evaluation-driven tuning.

Muse native/checked primary 15/18 vs 15/18, requests 8.50/8.78, tokens 110,677/271,144, measured median/P90 62.34/89.47 vs 74.00/103.28 seconds, cost/attempt $0.008891/$0.023632, cost/success $0.010669/$0.028359. GLM primary 15/18 vs 11/18, requests 6.89/6.61, tokens 66,380/≥194,043, median/P90 43.02/76.05 vs 62.23/101.59 seconds, cost/attempt $0.005360 vs $0.012850–$0.015148 and /success $0.006432 vs $0.021027–$0.024787. Capability invocations: Muse native/checked 784/869; GLM 782/972. State grades 18/18 in every row, with the two interrupted grades recovered from original servers; one checked timing unavailable per model. Strict delivery 15/15/14/4 across the four rows.

Two attempts timed out around an interrupted/suspended turn; exact cause not established. Both remain failed, no paid replacement. GLM has one unreported request, bounded with frozen limits/rates; zero-request Muse costs zero. Preserved original result bytes and accounting amendments. Resumed only remaining cells with unchanged sources. Total 575 requests, estimated cost $0.940859–$0.982228 under $2. Replay audit: 74 fully accounted attempts plus two reconciled, source/input hashes unchanged, 32 exact evaluation deliveries plus two calibration. Twenty evaluation compiler rejections had no capability invocations. Complete token/cache/reasoning and family accounting in report/data; missing measurements explicit.

Decision: no general advantage here. Paired sensitivity excluding the interrupted instance retains the substantial cost penalty. Keep the research artifact and typed contracts; do not expand generic orchestration/catalog/memory work. Concrete workflow/reuse or isolated checking research would need separate selection. New deferred 067 records caller-defined final answer shape, prompted by seven primary-successful checked GLM object/scalar mismatches; no implementation selected.

Final cleanup follow-up: the original interrupted API servers survived the process-group kill. Recovered their independent grades from saved states without restarting agents: both task answers incomplete/wrong, domain state unchanged. Stopped the four verified owned server processes. All 72 state grades now available; two timings and one request's usage remain unavailable. Original primary failures preserved. 068 captures detached-server supervision, deferred. Recovery snapshots replayed in the complete audit; no additional model calls.
