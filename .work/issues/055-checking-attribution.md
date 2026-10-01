# 055 — Isolate checking from composition-interface and runtime costs

Status: DEFERRED — discovered while delivering 054; no new run or production change selected
Dependencies: 054 results; 052/053 only if their fixes are separately selected

## Question and hypothesis

054 compares native Pi Codemode with the actual checked Strata session across 20 task definitions. Both compose programs, but declaration rendering, tool output, module conventions and per-program execution guards differ. Lower whole-system token cost cannot establish that semantic checking itself saves tokens. GLM spends additional requests repairing type errors, including errors that strict TypeScript rejects although JavaScript would run.

Hypothesis: checking has useful prevention value on contract mistakes, while its repair burden depends on the model and strictness. Infer neither a universal success improvement nor a check-free cost advantage from 054's two interfaces.

## Proposed bounded follow-up, only if selected

Keep the same Strata declarations, task prompts, runtime validation, permissions, quiet-success reports and execution limits while changing only the semantic gate. Separate shared syntax/import/entry checks from semantic diagnostics. Use a disjoint development set and new untouched workflows for confirmation; retain compiler-only prevention reproductions based on naturally observed native field errors as explicitly controlled diagnostics. Include recovery instructions and state inspections in every arm. Avoid changing 052/053 contracts at the same time.

Freeze task-block comparisons and full requests/token/cache/time/cost/effect reporting. Preserve failed work and count type-style repairs separately from missing-field/argument errors and business-rule failures. A faster failed attempt does not establish improved workflow speed.

## Completion criteria

A versioned, authorized comparison isolates the gate with equivalent execution behavior; independently scores answers and effects; publishes all attempted work and uncertainty; concludes retain/narrow/remove within the measured workload. No implementation is currently selected.
