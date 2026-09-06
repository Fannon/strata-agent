# 026 — Correlated capability diagnostics and performance traces

Status: minimal slice delivered and measured with 027; context attribution remains under 004
Dependencies: existing broker/session; informs 009 evaluation and 012 permissions.
Source: user requested visibility into tool use, debugging and performance.

## Evidence

Broker/session metrics already cover aggregate compile/execution time, attempts, invocation counts, failure stages and byte counts. No per-call duration or durable correlated trace exists there. Benchmark artifacts are a separate facility. Connector errors, including repository DeniedError, are currently labeled transport; invoked means connector entry, not resource access. Model-report truncation can discard call detail.

## Plan

For 027, deliver minimal correlated executor/call timings first; a complete trace platform must not block the Bun comparison. Keep event semantics independent of QuickJS messages and identify the engine explicitly.

- [x] Define versioned session/program/call IDs and start/outcome events; record operation/backend, monotonic duration, result bytes/completeness and failure category. Identify connector dispatch separately from actual effects where observable.
- [x] Preserve structured resource-denial, validation, transport, timeout and cancellation outcomes across connector/broker boundaries; do not parse error prose to classify them.
- [x] Add an optional bounded local JSONL developer sink independent of model output. Specify redaction, retention, sink failures and dropped-event counters; default to no raw arguments, source, file content or sensitive paths.
- [x] Include compile/runtime, discovery/load and adapter timing; distinguish overlapping work and approval/queue time. Correlate existing Pi/benchmark model usage without inventing unavailable measurements.
- [x] Provide a small trace-summary command/example showing slow operations, failure categories and data reduction. No dashboard or telemetry dependency required initially.
- [x] Verify concurrent correlation, pre-dispatch denial, cancellation, trace truncation/sink failure and payload redaction with deterministic tests. Measure tracing overhead enabled/disabled.

## Delivery

Minimal slice delivered with the QuickJS baseline (engine is recorded explicitly
so 027 can compare). `src/trace.ts` holds contract v1 and the bounded JSONL sink
(`STRATA_TRACE_FILE` opt-in; allowlist-sanitized keys; failure/bounds count as
dropped, never throw). Broker records `callId`, `backend` (`mcp`/`cli-twin`/
`bun-native`), monotonic `durationMs` and `denied`/`cancelled` categories alongside
the existing policy/input/output/transport stages; `DeniedError`/`ResourceError`
live in `manifest.ts` so classification uses error identity, not prose. Session
assigns `<session>:p<n>` program IDs, emits program/load start/outcome events,
records run `outcome` (`ok`/`compile-error`/`cancelled`/`timeout`/`error`) from the
executor's structured result, and marks in-flight calls cancelled when the worker
is gone. `examples/trace-summary.ts` prints slowest calls, outcome counts and
byte totals. Tests: `test/integration/trace.test.ts` (7 tests: correlation,
policy vs denied, cancellation, concurrency, redaction, load timing, sink
failure). Full suite 75 pass.

Notes and limits: timeout is a run-level outcome; an in-flight call at timeout is
marked `cancelled` (result discarded) while a late connector completion records
the same category. There is no approval/queue time yet (no approvals exist), no
Pi/benchmark model-usage correlation (no new measurements invented), and no
retention policy beyond explicit file bounds. Tracing overhead enabled/disabled
is measured in the 027 comparison script, not yet run.

Acceptance: diagnose which operation failed or dominated a run from local events without inspecting raw file contents. Each recorded attempt has a terminal outcome, or an explicitly incomplete run on crash; no claim that traces prove absence of uninstrumented effects.
