# 040 — Resolve AppWorld date-time compatibility before comparison

Status: proposed follow-up, captured in the 2026-09-16 consistency review; no validation change authorized by this documentation task
Dependencies: existing AppWorld replay code and reported response examples; prerequisite for 037 task-solving acceptance and 042 comparison

## Evidence and hypothesis

[The spike report](../../docs/appworld-spike.md) records output rejection of timezone-free timestamps in the paid development trajectory. `src/capabilities/schemas.ts` installs standard AJV formats. Schema generation succeeded, but that did not establish response compatibility. This is a confirmed interoperability gap; its contribution to final task failure is not a controlled causal result.

## Decision needed

Choose whether to keep strict validation and declare this upstream format unsupported, or implement an explicit, narrowly scoped compatibility policy. Do not silently relax global validation, fabricate timezone information, or rewrite historical outcomes. Preserve schema provenance and report any adaptation in both comparison arms.

## Completion criteria

Recommended approach: reproduce first, then inspect the pinned upstream schema and response semantics. Prefer an explicit AppWorld-boundary adaptation only if it preserves the original value and has defensible semantics. Keep global defaults strict, document original versus effective schemas, and apply the same policy in both comparison arms. Never guess a timezone. If no sound adaptation exists, document the unsupported case and recommend a compatible task/backend under 037. Routine choices within an assigned fix should be resolved from this evidence; a broader semantic change needs a concrete recommendation.

- Reproduce accepted/rejected timestamp cases with a small synthetic fixture containing no protected task data.
- Document the selected semantics and affected operations; cover valid, timezone-free and malformed values with deterministic checks.
- Verify actual affected responses through replay, or document a reproducible unsupported result. The task-solving replay belongs to 037; closing this investigation with an unsupported finding does not imply pilot readiness.
- Preserve the inspected task as development-only and keep raw artifacts local. Any new model campaign needs a frozen matrix and spend cap.
