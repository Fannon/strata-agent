# 032 — From task-first slices to solid coverage

Status: backlog, plan only (no implementation authorized)
Kind: coverage strategy track alongside 028
Source: user discussion 2026-09-06 — test-first is right, but real work has an open-ended tail.

## Problem

Task-first (`028`: freeze tasks, build only proven-missing ops) avoids
speculative building, but converges one gap at a time. Day-to-day work has an
unknown number of requirements. At some point we need enough breadth to handle
most of it — or enough flexibility to bend without breaking the experiment.

## Decision

Keep task-first for the core. Add a parallel coverage track that turns
surprises into a system instead of one-off ops:

1. **Primitives over specifics.** Prefer a few expressive building blocks
   (bounded read with ranges, list/find with glob + deterministic order,
   literal-then-pattern search, fixed-task check runner) over one op per
   need. Composition in TypeScript covers the rest. Two distinct caller workflows are a useful promotion heuristic, not an absolute gate; a critical correctness need or explicitly selected experiment can justify one. Avoid hiding arbitrary effects in task-local adapters.
2. **Borrow semantics, don't clone flags.** For mature tools (ripgrep, Git),
   wrap via fixed-argv adapters that preserve their filtering/status
   semantics behind bounded typed contracts — no flag-parity chase, no shell
   strings from the model.
3. **Miss log → promotion rule.** Every task failure caused by missing
   capability becomes a frozen record (what was asked, what existed, what
   would have sufficed). A miss repeated across tasks promotes to a
   capability proposal with caps, tests, and policy review. Single-use misses
   stay task-local.
4. **Hybrid fallback as a meter, not a hole.** `typed-first, measured bash
   fallback` profiles stay available for coverage sampling. Every fallback is
   logged with reason and rate. Compare fallback rates on a fixed representative cohort; task mix and instructions can change them without changing coverage.
   Rising or hidden fallback = stop and reconsider, not quiet surrender.
5. **Sample reality on purpose (feeds from `013`).** Periodically sample
   real session work (bounded local study, no raw transcript publication)
   and classify it against current ops: covered / composable / missing /
   out-of-scope. Publish only the classification counts and the miss log.

## What “solid” means (no hand-waving)

- Workflow closure over orient → navigate → verify → change on sampled
  tasks, with per-layer fallback rates reported.
- Unseen-task probe: a held-out sample solvable with zero new ops at or
  above a pre-registered bar (bar set before sampling, not after).
- Breadth stop rule: when three consecutive samples add only single-use
  misses, stop broadening and narrow the claimed scope instead.

## Relation to other issues

- `004` is the next efficiency experiment; 028 supplies completed baseline tasks. Coverage sampling can proceed independently when selected.
- `013` (session study) becomes the sampler, kept bounded and local.
- `015` (edits/checks/fallback) is where write-layer coverage lands, only
  when reads earn it. `017` (relationships) stays deferred until overlapping
  ops actually appear. `005/007` caps apply to every new primitive.

## Completion criteria (when selected)

- [ ] Miss-log format + promotion rule documented; first sampling run
  classified and published as counts only.
- [ ] No op added without two-task justification or explicit experiment tag.
- [ ] Fallback rate reported per pilot; stop rule evaluated at the gate.
