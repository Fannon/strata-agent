# 041 — Establish Windows support and repair verification gaps

Status: compiler-separator fix landed 2026-09-16 under gates 0-2 (diagnosis-driven, not a general port); 12 failures remain classified below, still not selected for implementation
Dependencies: none for diagnosis; relevant before using this checkout on Windows

## Evidence

At `c5e0b7e`, Windows/Bun 1.4.2: `bun run check` passes; `bun test` exits 1 with 67 pass, 95 fail, 743 assertions, 162 tests across 25 files. No model calls were made. Historical Linux verification is not a current cross-platform pass.

Observed failure classes include explicit POSIX-only benchmark process supervision and compiler TS6053/TS2318 errors claiming the TypeScript standard library is missing. The referenced `node_modules/typescript/lib/lib.es2022.d.ts` exists. `src/compiler/workspace.ts` compares TypeScript paths against `libDir + "/"`; mixed Windows separators are a plausible cause, not yet isolated. Many executor and integration assertions fail downstream of compile rejection. Do not assume all 95 failures share that cause or represent independent runtime defects.

## Diagnosis and narrow fix (2026-09-16, gates 0-2)

Root cause isolated: `libDir` carries Windows backslashes while TypeScript hands the language-service host forward-slash paths, so `path.startsWith(libDir + "/")` never matched and every stdlib read returned `undefined`. Fix in `src/compiler/workspace.ts`: separator-normalized comparison only; the `lib.*.d.ts` basename gate is unchanged, so the compiler filesystem allowlist is preserved (no traversal: `[\w.]` admits no separator). Platform-neutral — a no-op on POSIX.

Result on Windows/Bun 1.4.2 at `8d3163f`+fix: `bun run check` clean; `bun test` **155 pass / 12 fail / 167 tests across 26 files** (was 67/95). The 12 remaining failures are pre-existing environment classes, none in gates-touched code:

- Benchmark supervision/caps/dry-run/offline-selection (5): POSIX signal/process semantics.
- `environment reports actual installed versions`, `offline runner reports the actual selection`: test-harness `new URL(...).pathname` yields `/C:\...` on Windows — path construction in the test, not product code.
- `symlink kind never collides`: Windows symlink privilege/semantics.
- `git presence: only ENOENT is absent`: Windows `stat` errno differs (ENOTDIR expectation).
- BFCL `pinned subset loads`, `record-all server round-trip`, 2 unnamed: same spawn/loopback/pathname environment family (not individually root-caused; no product code from gates 0-2 involved).

Windows AppWorld notes (same session): platform venv works (Python 3.14.7 + pinned source + `mcp==2.2.0`); upstream console needs `PYTHONUTF8=1`; harness gained `--python` and a `relative()`-based locality check. No claim of general Windows support: the 12 above plus any untested paths remain open.

## Proposed work and completion criteria

- Decide and document supported runtime/test platforms.
- Reproduce the compiler path issue minimally and preserve the compiler filesystem allowlist when fixing normalization.
- Separate intentionally POSIX-only tests from Windows regressions; keep unsupported coverage explicit rather than silently counting skips as passes.
- Re-run the complete suite on supported platforms and classify remaining failures. Reconcile discovered test counts with historical reports without rewriting their revision-specific results.

This review records the gap; it does not authorize a portability implementation or benchmark campaign.
