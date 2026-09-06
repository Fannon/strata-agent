# 019 — Harness-state snapshots and rollback for catalog loads

Status: deferred (until wrong-load/restart costs justify it)
Kind: reliability follow-up to [003](003-tool-discovery.md)
Source: prime-agent comparison 2026-09-05 (assistant + user)
Dependencies: [003](003-tool-discovery.md) (done).

## Architecture review correction (2026-09-05)

Prefer a concrete unload/revocation contract over a generic snapshot framework if this becomes necessary. Loading uses trusted configured allowlists; it does not dynamically acquire a broader grant. Removing a module while calls are in flight requires explicit cancellation/revocation semantics and connector disposal; restoring a list of IDs or declaration text is insufficient. This concern differs from repairing load/shutdown races, and neither reverses external effects. No current measurement justifies adding rollback now; [020](020-next-sequence.md) defers it.

## Confirmed observations

- `load_capability` mutates the live session (broker modules, declarations text); there is no snapshot or revert. A bad load (wrong entry, overly broad allow) can only be undone by restarting Pi.
- Prime-agent snapshots REPL namespaces with rollback support; the analogous unit here is *harness* state, not program state (programs are already stateless per run).
- Effects already sent to servers cannot be rolled back by any snapshot — same boundary as cancellation today.

## Hypotheses (not confirmed)

- Snapshotting `{loaded module ids, declarations text, allow view}` before each load, with an `unload_capability` (or rollback-to-snapshot) tool, covers the realistic failure (wrong/overbroad load) without touching the broker's per-call guarantees.
- Removal is straightforward: broker drops the module, declarations regenerate from the remainder, worker bindings follow `surfaces()` automatically.

## Open questions

- Is one-step rollback enough, or a stack of snapshots?
- Should unload be a model-visible tool (more context surface) or an operator command?
- How does rollback interact with in-flight executions using the removed module?
- Does the benchmark need a wrong-load recovery task to measure this (see [009](009-baseline-hardening.md))?

## Next step when selected

Define the snapshot shape and removal semantics, then implement `unload` with tests proving post-rollback programs cannot reach the removed module while earlier modules keep working.

## Completion criteria

- Wrong-load recovery demonstrated without session restart.
- In-flight behavior defined and tested.
- No change to the load≠allow rule or v1 baseline artifacts.
