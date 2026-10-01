# 060 — Bounded prompt/helper/presentation/feedback tuning trials

Status: SELECTED 2026-10-01 — user requested hypotheses, actual tests, overall improvement attempt and a documented report
Dependencies: 054 frozen baseline; 036 prompt hypothesis; 056 helper; 057 feedback; 059 alias-only presentation

## Authorized scope

Test four isolated experimental changes against the current checked session with both existing models: a short correct pagination recipe/example; a tested typed pagination prelude; alias-only model-facing declaration deduplication with full compiler contracts retained; smaller compiler rejection feedback. Keep production defaults and 049/051/054 source/result evidence unchanged. Prototype the relevant parts of 036/056/057/059 in a new harness; this does not select unrelated catalog adapters, operation-level loading, effect receipts 053 or finalization 058.

Use six previously inspected workflows as development material (J1, A1, A4, W1, W2, R2), one fresh attempt per arm/model: 60 development attempts across baseline and four candidates. Choose a candidate combination by complete answer/effect correctness, requests/tokens/time/cost and practical benefit, not by token reduction alone. Confirm against a fresh baseline on six newly defined workflows with three repetitions and both models: 72 confirmation attempts. Treat confirmation definitions as untouched until the candidate is selected/frozen. Existing fixtures may be reused, but new task structure must go beyond amount/name changes. Holdout and controller oracles stay out of the agent's imports/context.

Freeze sources, actual tasks, prompts, selection rule and limits before paid calls. At most one development matrix; preserve failures rather than replacing them. A negative result or inability to select a useful combination is a valid outcome; do not make production changes to force a win.

## Accounting and completion

Continue the existing €5 allowance, with $0.246816 estimated spend so far. Use a simple $3.75 cap for new work, eight requests/cell, 4096 output tokens/request, 262144 payload bytes/request, 180 seconds/cell and four concurrent workers. Muse medium / GLM low fixed within comparisons; complete usage and source hashes required. Report all development costs separately from confirmation, including failures, formats, effects and practical tradeoffs.

Complete with a reproducible prototype, independent answer/state checks, sanitized results, a retain/narrow/revert recommendation and updated README/report/handoff. Commit/push the documentation inventory first as requested; no paid calls occurred during that inventory.
