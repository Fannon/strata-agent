# 031 — Quiet success, loud error, on-demand details

Status: done (implemented 2026-09-06; 130 pass / 0 fail)
Kind: context-efficiency slice (typed_program report shape)
Source: user discussion — success needs only the result; errors need repair feedback; logs/metrics stay out of context unless asked.

## Decision

- Success tool text: `{ result, program }` only. No logs, no metrics in model context.
- Error tool text: `{ error, program, outcome, diagnostics?, calls?: [{operation, failure}], logs? }` — enough to fix the next try, still bounded, no full metric dump.
- Full per-program logs + metrics stay in host memory (bounded, last 20) and in the developer JSONL trace. The model fetches them only via an explicit `program_details` tool.
- `details` field of the Pi tool result carries the full metrics snapshot for the benchmark trace (content stays quiet; measurement stays complete).

## Work

- [x] `src/session.ts`: quiet `text` on ok, loud-but-trimmed `text` on error; bounded history map + `details(programId)`; `bytesExposedToPi` = byte length of the quiet/loud text.
- [x] `src/pi/extension.ts`: `typed_program` returns quiet content + metrics in `details`; new `program_details({ program })` tool reading session history.
- [x] `examples/benchmark/protocol.ts`: accept quiet success shape; read metrics from `event.result.details` with fallback to old full-envelope text (backward compat for historical traces).
- [x] Tests: quiet-text assertions, history bounds, `program_details` round-trip, benchmark compat (old + new shapes).
- [x] Docs: short README note in Benchmarking + extension tool descriptions.

## Acceptance

- [x] `bun run check` clean, full suite green including updated `runtime.test.ts` byte-equality and `benchmark-pi.test.ts` real-CLI integration.
- [x] Success tool text contains no `metrics`/`logs` keys; error text contains repair fields and no raw payloads.
- [x] Benchmark still records capabilityCalls/rawBytes for typed arms on new-shape traces.
