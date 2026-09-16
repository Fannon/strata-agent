# 040 — Resolve AppWorld date-time compatibility before comparison

Status: proposed follow-up, captured in the 2026-09-16 consistency review; no validation change authorized by this documentation task
Dependencies: 037 AppWorld replay; prerequisite for its matched pilot

## Evidence and hypothesis

[The spike report](../../docs/appworld-spike.md) records output rejection of timezone-free timestamps in the paid development trajectory. `src/capabilities/schemas.ts` installs standard AJV formats. Schema generation succeeded, but that did not establish response compatibility. This is a confirmed interoperability gap; its contribution to final task failure is not a controlled causal result.

## Decision needed

Choose whether to keep strict validation and declare this upstream format unsupported, or implement an explicit, narrowly scoped compatibility policy. Do not silently relax global validation, fabricate timezone information, or rewrite historical outcomes. Preserve schema provenance and report any adaptation in both comparison arms.

## Completion criteria

- Reproduce accepted/rejected timestamp cases with a small synthetic fixture containing no protected task data.
- Document the selected semantics and affected operations; cover valid, timezone-free and malformed values with deterministic checks.
- Verify real response compatibility and a task-solving replay with upstream grading before claiming readiness for a matched pilot.
- Preserve the inspected task as development-only and keep raw artifacts local. Any new model campaign needs a frozen matrix and spend cap.
