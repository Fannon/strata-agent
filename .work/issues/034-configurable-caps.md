# 034 — Operator-configurable caps for result, logs, and tool text

Status: deferred pending measured cap failures or operator requirement; follows 031
Kind: configurability follow-up
Source: user discussion 2026-09-06 — current caps are reasonable guesses, not science.

## Observation

031 fixed the shape (quiet success, loud error) but not the sizes. Three
budgets remain hardcoded:

- `main()` return value: 8,192 chars (`src/runtime/worker.ts`,
  `src/runtime/bun-runner.ts`).
- `console.log`: 2 KiB total (same files).
- Whole tool answer: 24,000 bytes (`src/session.ts`).

The right size depends on model and task. A small-context model wants less;
a large-context analysis task may justify more.

## Proposal

Move all three into operator configuration (session options with env/config
defaults, e.g. `STRATA_RESULT_CHARS`, `STRATA_LOG_BYTES`,
`STRATA_TOOL_BYTES`), validated at session startup (positive integers and explicit per-field ceilings. Result chars and log/tool UTF-8 bytes are different units: never sum them directly. Enforce serialized output bytes including JSON/envelope overhead at runtime; quiet success excludes logs, while error/details have separate shapes).
Record effective caps in the run manifest and per-cell artifacts so trials
stay reproducible.

Explicitly not included: program-selected limits. The program must never
raise its own ceiling — caps are operator trust decisions, like the
allowlist. A program requesting more gets the same budget error as today.

## Completion criteria

- [ ] Caps configurable per session with sane defaults (current values).
- [ ] Startup validation with clear errors; effective values in manifest/trace.
- [ ] Tests: custom caps honored, invalid config fails fast, program cannot
  escalate.
- [ ] Docs: one paragraph in README limits section.
