# 062 — Investigate accidental double invocation of exported main

Status: DEFERRED — discovered during the selected 061 run; no implementation or additional paid study authorized
Dependencies: current compiler/runtime entry-point contract; preserve 061 frozen evidence

## Observation

In `N6-glm-baseline-r1` (061), the generated module exports `main` and also ends with `main().then(v => v)`. The runtime invokes the exported entry point, so the module starts an additional invocation during evaluation. The fixture records its one invalid product reply, while the program report is successful and one correct credit is present. The answer fails exact business scoring because it adds an unrequested `creditId`.

The generated source has no explicit retry of the product read. Do not describe this attempt's completion as proof that GLM deliberately recovered from schema failure. The extra invocation is a plausible explanation for the invalid read and successful result within a single run; inspect call/worker evidence before asserting precise scheduling or rejection handling.

## Question and bounded future scope

Should the module contract explicitly forbid immediate calls to the exported entry point, diagnose this familiar script pattern, or document that module evaluation can initiate capability calls? Investigate whether background promises can outlive the selected result or produce duplicate effects/unhandled failures. Do not broadly prohibit legitimate module helpers or claim a syntactic heuristic guarantees single execution.

## Completion criteria if selected

Reproduce with a model-free non-idempotent fixture; explain actual evaluation/entry scheduling, call receipts and rejection propagation. Choose a shared contract, with regression tests for accidental double calls and legitimate top-level definitions. Retain historical benchmark scores. This issue does not authorize changing the live 061 protocol or production behavior during its run.
