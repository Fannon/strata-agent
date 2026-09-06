# 007 — Bounded report loop and pre-delivery size caps

Status: backlog
Kind: conditional hardening slice of [005](005-runtime-limits.md)
Source: review 2026-09-05 (assistant); parent is [005](005-runtime-limits.md)
Dependencies: workload/threat trigger from [005](005-runtime-limits.md). Do not implement on speculation.

## Current priority (2026-09-05 reconciliation)

This remains a child of 005, not a competing roadmap. Prioritize real host input/output and concurrency bounds in 011. The fixed-point counter operates on a stable serialized report with only its numeric byte-count field changing; the old “one pass” expectation is not a defect demonstration. Establish a mathematical bound or a small deterministic cap if selected, rather than speculating about oscillation. Updating the historical 22-test wording does not change today's 41-test baseline.

## Confirmed observations

- `src/session.ts` finalizes `bytesExposedToPi` with a `do/while` fixed-point loop because `bytes(report)` includes the serialized metric field itself. Convergence in one pass is expected but iteration count is unbounded in code.
- `src/capabilities/manifest.ts` `bytes()` is `Buffer.byteLength(JSON.stringify(value))`; digit-width flips (e.g. 9999→10000) change the length being measured.
- MCP responses are materialized in host memory before interpreter delivery (documented in `README.md`/`ARCHITECTURE.md`); the 64 MiB QuickJS heap is not a host-process quota.
- The TypeScript compiler runs synchronously in the host with only a 32 KiB source limit as backstop, not a CPU quota.

## Hypotheses (not confirmed, needs repro)

- The fixed-point loop terminates in practice but deserves a bounded iteration count plus a test.
- A connector-level pre-delivery byte cap and/or streaming handoff would bound host allocation for hostile/large servers.
- Compiler CPU isolation is unnecessary for the benchmark workloads; unproven for hostile input.

## Non-goals

- No general security framework, OS sandbox, or network namespace in this slice.
- No change to trust model: extensions, config, schema tooling, MCP servers stay trusted host code.

## Next step when selected

Per 005: define the workload/threat requirement first, reproduce one relevant failure (loop non-convergence or host over-allocation or compiler stall), then design one focused bound.

## Completion criteria

- Bounded report loop (e.g. max N passes) with a regression test, or documented proof it cannot oscillate.
- Either a connector pre-delivery cap with cancellation/recovery tests and honest metric accounting, or documented evidence current limits suffice for the selected workload.
- No silent behavior change for the fixture demo and existing 22 tests.
