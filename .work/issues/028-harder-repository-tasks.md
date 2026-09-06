# 028 — Harder repository tasks that can tell the approaches apart

Status: proposed, awaiting review (user + second agent). No implementation
authorized yet except what is explicitly selected below.
Kind: task design first, small API addition second, paid trial last.
Source: user request after the 2026-09-06 trial (27/27 pass on all setups).
Dependencies: 011 (read slice), 012 (read policy), 027 (engines). Informs 009
(held-out evaluation) and the continue/narrow/pivot/stop gate.

## Background (plain terms)

The latest paid trial ran 3 easy tasks × 3 setups (stock Pi, typed QuickJS,
typed Bun) × 3 repeats: all 27 solved, $0.0117 total. When every setup solves
everything, the test cannot show differences anymore. The easy tasks stay as
regression checks, but we need harder tasks to learn anything new.

## Step 1 (proposed): two missing read operations

The current API can read a file, search text, and show git status. Harder
tasks need two more basics:

- **List files** in a directory (bounded depth, sorted paths, hidden-file and
  symlink rules, truncation flags like the existing operations).
- **Show git history** (bounded commit list with message, author, changed
  paths; fixed git arguments, no caller-controlled flags).

Both run inside the existing permission checks (repository root, denial
before any effect) and get the same deterministic tests as the current
operations (sorting, caps, binary/symlink behavior, denial, cancellation).
No model spend: pure implementation work, offline tests only.

## Step 2 (proposed, needs approval before any paid run): harder tasks

Draft task ideas, each with one exact machine-checkable answer:

- **T4 — Find all callers.** Given a function name, report every file and
  line that calls it. Needs search plus reading surrounding lines.
- **T5 — Summarize recent changes.** Given the last N commits, report which
  files changed and what kind of change each was (added, edited, renamed).
  Needs history plus listing.
- **T6 — Multi-hop question.** Read the package manifest, find the entry
  file, then report what it exports. Needs three dependent steps where an
  early mistake breaks the chain.

Trial design (same as before, tightened): the same three setups, 2 repeats
instead of 3 at first, $2.50 cap, exact-answer grading, artifacts kept local.
Stock Pi keeps its full scripting ability — a fair baseline, not a crippled one.

## Acceptance

- Step 1: new operations implemented with deterministic tests; full suite green.
- Step 2: at least one setup fails at least one cell (the ceiling is broken),
  while the old easy tasks still pass 100% (nothing regressed).
- If everything passes again, the tasks were still too easy: make them harder
  before drawing conclusions.

## Open questions for the reviewer

1. Are T4–T6 the right difficulty, or should one be replaced (e.g. a debugging
   task: find a bug from a symptom)?
2. Are 2 repeats enough for a first signal, or is that too few to trust?
3. Is the $2.50 cap still right, given harder tasks burn more tokens each?
4. Should the typed arms get the new operations only, or also keep the old
   three (yes — keep all of them; removing tools mid-comparison is unfair)?
