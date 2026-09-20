# 047 — Stored program reuse and amortization

Status: research question captured from user direction 2026-09-20; not selected for implementation
Dependencies: 046 (cost mechanism: declaration context dominates per-request cost); 030 (optional memory, idea only); 044 (hybrid — reuse applies to both paths); 035 (discovery — finding a stored program is a retrieval problem)

## Question

Writing a typed program is expensive the first time (read declarations, draft, fix errors), but re-running a stored, parameterized program should be cheap. Could a library of proven programs turn the tradeoff around — from "write a program per task" into "retrieve and re-run a known-good workflow" — and amortize the authoring cost over many uses?

This is an amortization hypothesis, distinct from per-task composition efficiency (042/046). It directly targets the measured cost driver: if authoring happens once and reuse is cheap, the per-request declaration overhead matters less in aggregate.

## Conditions for a genuine typed win

- **Recurrence is real.** The same task shape must return often enough to pay back authoring. One-off tasks never amortize; measure the recurrence rate, don't assume it.
- **Parameterization works.** Stored programs need clean inputs (customer set, date range, thresholds), not hard-coded values — otherwise each "reuse" is really a rewrite. Adaptation cost counts.
- **Staleness is handled.** APIs change and permissions get revoked between storing and re-running. Detecting that and recovering (rather than failing opaquely) is its own experiment; contract-change and revocation stay separate from task efficiency, alongside 035.
- **The baseline gets memory too.** Ordinary agents can store shell scripts and snippets. The fair test is stored typed programs versus stored direct-tool scripts — not typed-with-memory versus direct-without.

## Landscape: other open evaluation questions this relates to

None selected; this section maps, it does not authorize. The board owns ordering.

- **044 (hybrid):** typed functions alongside ordinary shell/direct tools, measuring what the agent actually chooses. Reuse applies to both sides of a hybrid comparison.
- **035 (large-catalog discovery):** finding a few relevant functions — or stored programs — among thousands. Retrieval cost is part of any reuse accounting.
- **039 (typed REST via generated clients):** more operations behind the same interface; expands what stored programs could cover, not a prerequisite.
- **030 (optional memory):** agent memory outside typed runs; idea only, do not implement with current slices. 047 is the evaluation question that would motivate it.
- **Contract-change / revocation recovery:** how an agent recovers when an API changes or access is revoked between discovery and call. Separate from efficiency; required before reuse claims survive contact with reality.
- **Heavier-computation families:** 046's mechanism (declaration context rides along every request) predicts heavier local work would *not* close the cost gap — not currently justified.
- **Confirmation on untouched tasks + a second model (009/035 tracks):** any positive signal needs confirmation on tasks the agent hasn't seen, and portability beyond one model family.
- **Smaller ablations and comparisons:** 036 (prompt wording), 014 (Prime/IPython whole-system comparison), 015 (edits/checks/fallback), 021 (semantic-checking ablation). Each needs its own justification.

## Proposed experiment, only when selected

Freeze a recurring task family with parameterized instances (same shape, varying inputs). Give **both** arms durable memory: the typed arm stores programs, the direct arm stores scripts. Measure reuse rate, adaptation cost per reuse, staleness failures and recovery, and total cost per success **including authoring** — amortized over the family, not per first attempt. Reused tasks are regression material afterward; confirmation still needs untouched tasks. Produce a bounded matrix and spend proposal first; benchmark spend needs a frozen matrix and cap under the program ceiling.

## Completion and decision

Report reuse rate, adaptation vs. rewrite frequency, staleness behavior, and amortized cost per success by arm. Valid outcomes: reuse pays (narrow to recurring workflows and confirm), reuse ties (memory helps both equally — a useful null), reuse fails (retrieval/adaptation/staleness eats the saving), or stop. This question does not expand any current assignment or add an arm to a past comparison automatically.
