# 016 — Restore Pi execute-signal forwarding

Status: done (2026-09-05; verified `4875c8c`→HEAD)
Kind: confirmed integration regression from code inspection
Source: concept review at `5079c4d`, 2026-09-05.
Dependencies: none; precedes longer native operations and pending approvals.

## Evidence

`src/pi/extension.ts` shared `tool()` wrapper defines `execute(_id, params)` and passes only params to its callback. `typed_program` calls `session.run(source, {})`. Pi supplies AbortSignal as the third execute argument, but it is dropped. Session/runtime already support the signal. Direct-runtime tests pass without exercising cancellation through the registered Pi tool. Discovery wiring introduced this wrapper.

## Fix and acceptance

- [x] Forward Pi's signal through the wrapper to `session.run`.
- [x] Test registered-tool execution with pre-aborted signal (zero effects) and abort during delayed capability (prompt cancellation, no later calls).
- [x] Verify next program succeeds and shutdown is clean; use observable behavior rather than helper-structure assertions.
- [x] Inspect search/load cancellation separately; file a follow-up if loading can register after shutdown. → [025](025-load-shutdown-race.md) (search is sync, no-op; load race characterized, fix deferred).
- [x] Remove README/ARCHITECTURE caveat once verified.

Verified: `bun run check` clean, full suite 55/55 including new `test/integration/pi-cancellation.test.ts` (pre-abort zero-invocation via `stats` counter; mid-call `slow` abort <9s then successful `customers` recovery).

No live model needed. Not fixed during this documentation-only pass.
