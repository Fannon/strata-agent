# 044 — Uniform typed composition versus a hybrid tool interface

Status: research question captured from user direction; not selected for implementation
Dependencies: 042 trustworthy matched harness; 043 typed-function hypothesis; 036 only if prompt wording is separately varied

## Hypotheses

- Familiar tools: a new typed wrapper may impose translation, declaration and repair costs relative to established CLI/scripting workflows.
- Unfamiliar tools: explicit types may help an agent learn and use an interface it must discover anyway.
- Workflow composition: a uniform function interface may make combining tools easier even if individual familiar-tool calls become more expensive.
- Hybrid alternative: permitting typed programs alongside familiar shell/direct tools may beat either uniform approach by letting the agent choose. It may also add context, duplicated choices and interface-switching overhead.

These are competing hypotheses. Current cost results do not isolate familiarity, and training exposure is not directly known. Treat familiar/unfamiliar as an explicitly operationalized task/interface distinction, not a claim about proprietary training data.

## Proposed experiment, only when selected

Reuse a healthy 042 harness. Compare ordinary direct tools plus scripting, uniform typed functions, and hybrid access on identical tasks/resources. Include established local CLI controls, newly introduced service interfaces, and mixed dependent workflows. Define categories before inspecting results. Preserve semantic and backend parity, local computation, discovery, grants and budget rules. Do not make the ordinary baseline incapable of scripting or joining data.

Allow hybrid tool choice and record the actual path: typed programs, shell/direct calls, mixed sequences, context costs and repairs. Charge for both interface descriptions when both are exposed. Count all attempts. A hybrid win is a system-level result, not proof that typed functions caused the win; examine whether successful runs actually used composition.

Measure task completion, total cost per success, latency, unauthorized effects, adapter/setup effort and interface-switching behavior. Distinguish single-operation overhead from full-workflow benefit. Any later causal familiarity ablation must hold operation semantics and available information explicit; renaming functions alone does not recreate real-world unfamiliarity.

## Completion and decision

Before implementation, produce a bounded matrix, independent outcomes, parity table, operational definitions of familiarity and a spend proposal. Report results by workflow category and arm. Uniform, hybrid, narrow typed use or stopping are all valid outcomes. This question does not expand the next worker's offline 037/040 assignment or add an arm to 042 automatically.
