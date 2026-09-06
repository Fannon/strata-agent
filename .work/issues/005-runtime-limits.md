# 005 — Revisit resource limits before broader or hostile-input workloads

Status: backlog
Kind: conditional technical follow-up
Source: known limitations recorded during the first prototype; not a new user-requested implementation.
Dependencies: workload evidence or an explicit stronger-isolation requirement.

## Current priority (2026-09-05 reconciliation)

The planned native repository slice supplies a concrete large-workload trigger: enforce file/search/process stdout+stderr byte bounds and broker concurrency caps before host materialization. Include these in 011; the interpreter heap cap alone is insufficient. Compiler CPU isolation/OS containment remain separate threat-driven choices under 012. Define timeout/approval interaction and cancellation recovery. Do not require a hostile incident before bounding ordinary repository traversal/output.

## Benchmark supervision follow-up (1513917)

The fixture runner now bounds process stdout/stderr and kills its POSIX process group on deadline, overflow and Pi cell exit. It does not yet own a dedicated benchmark-parent SIGINT/SIGTERM cleanup path; abrupt parent termination and children that create their own sessions are outside this guarantee. If selecting runner lifecycle hardening, reproduce those cases and define cleanup before claiming full process-tree containment. This is separate from 016's Pi-to-typed-runtime AbortSignal regression. No additional implementation was included during handoff.

## Current observations

Programs execute in QuickJS/WASM in a Bun worker with timeout and interpreter heap limits. The TypeScript compiler still runs synchronously in the host. MCP responses are materialized in host memory before interpreter delivery. The existing limits are not a host-wide memory quota or an OS sandbox.

## Questions to investigate later

- Do representative workloads require compilation to move behind a cancellable process/worker boundary?
- Where can connector response-size limits be enforced before large host allocations?
- How should resource-limit failures appear in metrics and agent feedback?
- Are the current documented trust assumptions sufficient for the intended experiment?

## Next step when selected

Define the workload/threat requirement and reproduce one relevant failure before designing additional isolation. Avoid turning this into a general security framework.

## Completion criteria

Either document why current limits suffice for the selected workload, or implement one focused bound with tests proving cancellation/recovery and honest resource accounting.
