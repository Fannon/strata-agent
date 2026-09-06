# 015 — Editing, project checks and optional shell fallback

Status: backlog
Kind: later product slice
Source: essential composable coding functions and user's optional bash fallback.
Dependencies: 011 usefulness, 009 decision gate, 012 stronger effect enforcement, 016 cancellation.

## Plan

- [ ] Design `workspace.applyEdits` with concrete paths, expected revisions and reviewable patches. Specify conflicts, per-file atomicity, partial batch effects and recovery; no implied multi-file transaction.
- [ ] Add only needed mkdir/copy/move/remove with explicit overwrite/destructive semantics.
- [ ] Define `project.runCheck` with named trusted profiles, fixed command/cwd/environment, bounded streams and process-tree cancellation. Repository scripts may write, spawn and use the network.
- [ ] Add bug-fix tasks graded by final diff, hidden tests and preservation of unrelated edits.
- [ ] Evaluate hybrid separately from strict mode. If `bash({script,...})` is exposed, use explicit broad execution grants/logs/budgets; no hidden fallback inside native functions.

Acceptance: failed mutation preconditions cause no unintended writes; cancellation/partial effects are explicit; child processes cleaned; checks cannot inherit read grants. Strict mode reports unsupported work, hybrid records fallback reasons/rate.

Open questions: first edit contract, OS isolation, diff approval UI and process supervision. No decision to add bash inside typed_program; today's ordinary Pi bash already serves hybrid experiments.
