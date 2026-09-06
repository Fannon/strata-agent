# 017 — Dependencies, related tools and supersession

Status: deferred
Kind: catalog semantics idea
Source: user observation that tools may supersede others; earlier discovery discussion.
Dependencies: overlapping real capabilities or measured selection failures.

## Preserve these distinctions

- `dependsOn`: required runtime/install dependency, not permission inheritance.
- `related`: useful companion/alternative, not automatically loaded.
- `supersedes`: declared replacement for a version or part of a contract, not automatic equivalence/routing.

Today's catalog accepts dependsOn/related but does not resolve closures. Supersession is not implemented. Search extracts static metadata; loading executes trusted bindings. Metadata edges do not require graph retrieval, a package manager or a database.

## Trigger and eventual acceptance

Revisit when overlapping real operations or obsolete selections harm evaluated tasks. Define version/scope, compatibility evidence, migration hints, missing/cyclic dependencies and bounded expansion. Prefer display-only guidance first. Replacement/loading never inherits grants.

If selected, deliver an evidence-backed retrieval problem, minimal metadata contract, tests for partial replacements/cycles/stale references and zero grant escalation, plus measured task benefit. Until then focus on 011/009.
