# 050 — macOS/Bun baseline failures

Status: discovered 2026-09-30; deferred, no fix selected
Dependencies: required only if reusing affected Bun executor or evaluation paths

Model-free baseline after `bun install --frozen-lockfile`: `bun run check` passed; `bun test` reported 168 pass / 28 fail, 196 tests and 1367 assertions on macOS/Bun 1.4.0-canary.1. Direct-Bun cases primarily failed to import generated temporary `.mjs` files (`ResolveMessage: Cannot find module ... from ''`). BFCL local subset setup and benchmark HTTP integration also failed. QuickJS runtime and actual-entry validation-parity cases passed.

Hypotheses: Bun temporary-module behavior and/or sandbox permissions differ from the historical tested environment; the other setup failures may have independent causes. These are observations, not a verified diagnosis. The current 049 pilot uses QuickJS and a separate verified model driver, so a broad repair is not a prerequisite.

If selected, save complete output, reproduce affected classes with permitted local subprocess/loopback access, distinguish runtime from sandbox/setup causes, and apply a narrowly scoped fix. Completion requires relevant regressions passing and an updated environment record; no general macOS support claim from a partial fix.
