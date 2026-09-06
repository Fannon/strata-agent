# 004 — Tune prompts, function APIs and documentation using benchmark evidence

Status: backlog
Kind: experiment-driven improvement
Source: user feedback, 2026-09-05
Dependencies: an untuned baseline from [001](001-benchmark.md); [003](003-tool-discovery.md) only for discovery-specific tuning.

## Current priority (2026-09-05 reconciliation)

Wait for 009's trustworthy grader/dev-set results. Do not tune APIs/prompts to permissive v1 checkers. Measure unfamiliar API/type usage versus tool-selection, capability-gap and compiler-cost failures before blaming model training. Limit the first cycle to two versioned API/prompt revisions, preserving held-out task families and reporting regressions. B/C separates composition, not typing alone; a matched individual-function or checking-disabled ablation would need its own justified experiment with runtime policy still enforced. Negative results can narrow the product or end expansion.

## Goal

Use the benchmark to improve the harness, exposed functions, descriptions and system prompt. This means iterative configuration/API/documentation improvement, not model-weight fine-tuning or automatic prompt self-improvement.

## Candidate variables

- System-prompt instructions for choosing typed_program versus ordinary Pi tools.
- Examples explaining imports, main(), structured results, composition and recovery.
- Function naming, parameter structure, return shape and caller burden.
- JSDoc length, generated declaration verbosity and discovery result descriptions.
- Compiler/runtime error wording and guidance for narrowing untyped output.
- Limits and defaults only where observed failures justify changes.

## Experiment discipline

Preserve the original prompt and API versions. Change one coherent factor at a time where practical and compare against the same baseline. Track correctness and retries as well as cost and latency. Hold out some tasks to avoid overfitting the harness to a few examples. Record improvements and regressions, including ordinary Pi-tool fallback. No autonomous optimization system is needed.

## Open questions

- Is the main failure mode tool selection, code generation, schema understanding or error recovery?
- Does a short usage example earn its added context cost?
- Which instructions belong in the system prompt versus local function documentation?
- Can better APIs eliminate an instruction rather than adding more prompt text?

## Next step when selected

Review baseline failures, choose one measurable hypothesis and propose a small comparison before changing the harness.

## Completion criteria

A versioned change with paired benchmark evidence, held-out checks and a documented retain/revert decision. Further substantial changes return to the issue board.
