# 061 — Confirm shared improvements across unseen models

Status: DEFERRED — captured from the user's post-060 design clarification; no new run or implementation selected
Dependencies: 060 shared recipe/prototype and frozen evidence; 055 only if checking attribution is also selected

## Requirement and hypothesis

Improve Strata as one shared tool/programming interface that uses the strengths of varying models. Do not optimize prompts, helpers or checking policies for individual model names. In 060, Muse and GLM already used the same recipe; task-specific examples came from the public schema. Their separate result rows were evaluation conditions, not distinct recipes.

Hypothesis: concise schema-derived examples and inferred contracts reduce common interface friction while letting each model choose its own composition strategy. This needs evidence beyond the two models used during selection.

## Possible scope, only if selected

Freeze the same shared baseline and candidate before testing at least one model not used for selection, on new workflow definitions. Keep capabilities, budgets, checking, schemas and scoring matched within each model. Provider-required API configuration remains distinct from Strata prompt/interface policy. Do not adjust the recipe after inspecting confirmation failures; subsequent changes need new development and confirmation evidence. Include strong and less capable models when the selected scope supports it; preserve each model's useful programming flexibility.

## Completion criteria

Publish per-model sample/distinct-task counts, answer/effect/format correctness, requests, input/output/cache/reasoning tokens, elapsed time and total/per-success estimated cost including failures. Evaluate whether the single candidate is useful across models; do not rely only on pooled averages that conceal regressions. Separate portability evidence from claims of general superiority or checking causality. A neutral/negative result is valid.

## Proposed order

If another tuning campaign is selected, establish this cross-model evaluation constraint before selecting new shared interface changes. Canonical finalization (058), action receipts (053), checking attribution (055) and large-catalog discovery (059) retain separate scope; this issue authorizes none of them.

## Ranked recommendation after the user's next-step question

First confirm portability before selecting more tuning. A useful next scope would include at least two previously untested model families with different capability levels, one frozen shared recipe, and new workflow definitions with different API shapes. Include a capable native-Pi comparison alongside checked Strata baseline and checked Strata plus recipe if the aim includes demonstrating an overall Strata advantage. Native Pi should receive equally helpful API/pagination guidance and equivalent operations; comparing a polished candidate against an unnecessarily weak prompt would confound the result. Each model's fixed provider configuration must be held across its arms.

Prioritize distinct workflow definitions over extra repetitions of the same fixture. Include multi-page joins, read-only aggregation, writes with existing state, and failure recovery. Freeze development/confirmation separation and score failures without replacement. Report model-specific outcomes without selecting model-specific policies.

This is a proposal recorded from the next-step discussion, not selection of a run. Following it, consider 058 explicit structured finalization (052 contract prerequisite), then 053 action receipts for critical writes. 059 larger-catalog discovery needs its own relevant workload; 055 remains the separate check-gate attribution study.

## Subsequent implementation order

The user chose recommendations 2 and 3 first: 058 finalization, 053 action evidence and the narrow 052 prerequisite are now implemented with model-free checks. The preceding ranked order describes the earlier proposal. A future selected 061 run must freeze the new shipped revision and decide explicitly which shared features each arm receives, including fair recovery evidence/finalization for the native comparison. No new benchmark is selected by that implementation delivery.
