# 020 — Recommended sequence: 016 → 012 → minimal 011 → three-arm feasibility pilot

Status: ready as a sequencing recommendation (reworked 2026-09-05); remaining implementation not authorized
Kind: product/architecture sequencing and handoff
Source: user-supplied proposal; reviewed after completing 009A in `1513917`.

## Decision

**Architecture update (takes precedence over older sequencing below):** The enduring architecture is the typed capability layer: discoverable contracts, semantic checking, composable repository/API/MCP functions, runtime validation, permission-aware implementations and observability. The execution engine is an implementation choice. QuickJS remains the implemented baseline; direct Bun is a first-class planned alternative, without a prerequisite to prove QuickJS is slow. Execution containment is a separate concern. This documentation decision does not itself implement or select a runtime migration. Next planning sequence: reconcile delivered slices, select minimal 026 tracing plus 027 executor comparison, run deterministic checks, then matched repository trials under an explicit budget. Full observability and a new sandbox are not prerequisites. Preserve completed results and do not redo completed cancellation/read work.

Accept the direction: move toward useful repository work instead of expanding a synthetic benchmark. The evaluator repair is now delivered. Revise the pilot to include **stock Pi**, because typed-with-bash versus typed-only isolates shell removal but cannot establish improvement over ordinary Pi. Keep the scope narrow enough that a task is actually expressible with every arm's available operations.

## Recommended order

1. **016: verify through registered Pi tool, then repair.** Source inspection shows the shared execute wrapper drops AbortSignal. Add pre-aborted and mid-call tests through the actual registered tool, forward the signal if still missing, and verify the next execution works. If another agent already fixed it, establish that with the regression test and close the issue. Do not confuse process timeout in 009 with interactive cancellation inside Strata.
2. **012A: scoped read effects.** Declare workspace root, path/file-kind/symlink rules, byte/concurrency caps and denied resources. Keep Bun I/O behind trusted broker adapters. This implements the existing ambient-authority decision; it does not settle hardened filesystem containment by adding string/path checks. Record the limited local threat model or explicitly select stronger OS enforcement.
3. **011: minimum useful task.** Start with `fs.readText`, bounded literal `search.text`, and `git.status`. Task: inspect selected package fields, locate a named symbol, and report staged/unstaged/untracked changes in a seeded Git repo. If the task needs a directory tree or commit history, add `fs.list`/`git.log` or narrow the task honestly; don't mark the full original orientation example supported by only three operations.
4. **Mechanically distinct profiles, then a feasibility pilot.** A = stock Pi with its full normal scripting abilities; H = typed APIs plus normal tools; C = typed APIs with all direct effect tools (bash/read/write/edit and any equivalent extension) removed. Exact allowed reads/results must remain equivalent. Report unsupported work and attempted forbidden calls; do not quietly fall back in C. B, the single-operation ablation, is optional after the first useful workflow.

Run deterministic fixtures and grader preflight first. One run per arm can reveal wiring problems only. A small set of seeded variants/repeats helps expose fragile behavior before broader claims; freeze model/settings, prompts, output contracts and a spend ceiling before paid execution. Use 009-v2's artifact contract and independent expected results. No paid pilot has been authorized or run as part of this handoff.

## How to interpret the pilot

- H versus C: what removing shell access changes, and where missing capabilities matter.
- A versus C/H: whether the typed surface improves real work over stock Pi.
- Correctness, policy adherence, harness health and usage remain separate. Report preparation/runtime overhead as well as token cost.
- Reaching for bash is evidence of tool preference; it does not by itself prove training bias. Check instructions, API discoverability, missing semantics and task coverage first.
- No one-task/two-run result establishes superiority or a model capability ceiling.

## Explicitly later

Full synthetic repeat campaigns, warm sessions, 004 tuning, 014 whole-Prime comparison, 018 OS-sandbox prototype, 019 unload/snapshots and 017 relationship solving. Preserve these ideas; don't implement them to avoid an unfavorable native result. Cloudflare Code Mode's semantic-checking ablation is captured in 021 and should reuse meaningful tasks rather than displace this slice.

## Stop or replan conditions

If scoped reads need stronger enforcement than the selected local experiment permits, make that boundary decision explicit before I/O. If a pilot fails, classify task/API/implementation/model causes and revise the smallest responsible piece on development tasks. A missing cancellation bug is not a reason to stop the whole project: close it with evidence. Follow normal issue selection for new substantial implementation; avoid asking for approval for routine fixes already included in a selected slice.

Acceptance for this planning issue: concrete order, bounded task contract, honest three-arm question mapping, dependency links and reproducible handoff. The implementation issues own their own completion criteria.
