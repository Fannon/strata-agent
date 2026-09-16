# 041 — Establish Windows support and repair verification gaps

Status: proposed, discovered 2026-09-16; not selected for implementation
Dependencies: none for diagnosis; relevant before using this checkout on Windows

## Evidence

At `c5e0b7e`, Windows/Bun 1.4.2: `bun run check` passes; `bun test` exits 1 with 67 pass, 95 fail, 743 assertions, 162 tests across 25 files. No model calls were made. Historical Linux verification is not a current cross-platform pass.

Observed failure classes include explicit POSIX-only benchmark process supervision and compiler TS6053/TS2318 errors claiming the TypeScript standard library is missing. The referenced `node_modules/typescript/lib/lib.es2022.d.ts` exists. `src/compiler/workspace.ts` compares TypeScript paths against `libDir + "/"`; mixed Windows separators are a plausible cause, not yet isolated. Many executor and integration assertions fail downstream of compile rejection. Do not assume all 95 failures share that cause or represent independent runtime defects.

## Proposed work and completion criteria

- Decide and document supported runtime/test platforms.
- Reproduce the compiler path issue minimally and preserve the compiler filesystem allowlist when fixing normalization.
- Separate intentionally POSIX-only tests from Windows regressions; keep unsupported coverage explicit rather than silently counting skips as passes.
- Re-run the complete suite on supported platforms and classify remaining failures. Reconcile discovered test counts with historical reports without rewriting their revision-specific results.

This review records the gap; it does not authorize a portability implementation or benchmark campaign.
