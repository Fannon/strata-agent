# Repository trial report: dev + held-out rounds (2026-09-06)

Model: `meta/muse-spark-1.3-contributor`, thinking off. Protocol repo-2
(hardened runner: guard reservations, process supervision, final-only
grading, controller-held oracle, canary, pinned manifest). Dual-ledger
budgeting: guard admits on worst-case reservations, the cap deducts reported
actuals (reservation fallback when usage is missing). All artifacts local-only
under `.work/repo-pilot/`; this file reports threatened-validity notes too.

## Matrices

- **Dev** (2026-09-06T07-19-51): R-EXPORT-1/2, R-LOG-1/2, R-LOC-1/2 ×
  stock-pi / typed-quickjs / typed-bun × 2 repeats = 36 cells.
- **Held-out** (2026-09-06T07-44-55): R-EXPORT-3/4, R-LOG-3/4, R-LOC-3/4 ×
  same profiles × 2 repeats = 36 cells. Frozen at commit, never edited after.
- Two earlier attempts are preserved as invalid runs (flat-ledger
  starvation, zero-cost model config) at $0.00 actual combined.

## Results

Dev (36 cells, ledger $0.0513, key delta $0.0465):

| profile | success | cost | tokens | tool calls | elapsed med/max |
| --- | --- | --- | --- | --- | --- |
| stock-pi | 11/12 | $0.0110 | 172,652 | 84 (bash+read) | 10s / 29s |
| typed-quickjs | 11/12 | $0.0191 | 358,048 | 33 programs | 10s / 32s |
| typed-bun | 12/12 | $0.0212 | 431,947 | 40 programs | 15s / 36s |

Held-out (36 cells, ledger $0.0578, key delta $0.0455):

| profile | success | cost | tokens | tool calls | elapsed med |
| --- | --- | --- | --- | --- | --- |
| stock-pi | 12/12 | $0.0101 | 140,182 | 60 (bash+read) | 9s |
| typed-quickjs | 12/12 | $0.0227 | 376,765 | 35 programs | 13s |
| typed-bun | 11/12 | $0.0250 | 419,190 | 39 programs | 14s |

Combined (72 cells): stock 23/24, quickjs 23/24, bun 23/24. No timeouts,
no blocked attempts, no missing accounting; one canary touch (below).

## Findings

1. **Correctness is tied; efficiency is not.** All three setups solve
   essentially everything. Typed arms make ~2.5× fewer tool trips at ~2.3×
   the tokens and ~1.8× the cost — declarations dominate every program.
   The tested trade is *fewer round-trips for more context per trip*.
2. **Path normalization is unspecified — twice bitten.** Dev:
   typed-quickjs answered `./core.ts` for `core.ts`. Held-out: typed-bun
   answered `./src/text.ts` for `src/text.ts`. Same contract gap, two
   independent occurrences. The API never states whether relative paths
   carry a leading `./`, and two models guessed differently on two days.
3. **The canary works, and curiosity is normal.** One stock cell read the
   `.canary` dotfile (correct answer anyway; flagged per the stated rule).
   The canary held no oracle, so nothing leaked — but the episode shows
   exploratory dotfile reads are ordinary agent behavior, not attacks.
   Interpretation must keep "accessed evaluator material" separate from
   "benefited from it."
4. **Trial infrastructure findings.** (a) Flat worst-case reservations
   starve cells on 1M-context models — fixed by the dual ledger plus
   fitting per-cell caps. (b) A missing `cost` block in the runner-written
   model config made Pi price everything at $0, which would have blinded
   the ledger — fixed; the ledger now reconciles against key deltas
   ($0.051 vs $0.047, $0.058 vs $0.046). (c) Independent oracle
   recomputation caught a human date-arithmetic error before it fossilized.

## Limits (threats to validity)

- Tasks are easy by design so far: single-figure tool calls, small files,
  unambiguous oracles. They measure wiring and efficiency, not the
  hypothesized typed advantage on hard composition.
- One model, one day, 2 repeats: no variance or generality claims.
- Stock scripting is unconstrained (fair by design) but unmeasured in
  kind — we count calls, not cleverness.
- Our tasks are original, so training-data familiarity cuts the other way:
  the model knows bash idioms far better than our week-old API.

## Suggestions

**Benchmarks, in order:**
1. Fix the path contract first (normalize `rel` outputs — strip any
   leading `./` — or state the rule in each operation description), then
   treat the two prefix misses as fixed-forward, not oracle edits.
2. Harder instances that target the hypothesis: multi-hop chains where an
   early mistake breaks the answer, large intermediates where in-program
   filtering should beat shell text-shoveling, tasks that exceed a cap so
   narrowing/recovery is required, and at least one adversarial decoy set
   per family (we have the pattern; deepen it).
3. Report cost-per-success and trips-per-success as first-class metrics
   alongside success rate — on current evidence they discriminate more
   than correctness does.
4. Add a second model and a latency-variance look before any stop/continue
   claim; keep 2 repeats until uncertainty demands more.
5. Rename the canary to something boring (e.g. `.nocommit`) to separate
   curiosity reads from targeted reads — or keep the enticing name and
   study the difference. Decide explicitly; don't drift.

**Product, only if harder tasks show a gap:**
- Declaration tokens are the typed arms' main cost. If that persists,
  the fix is smaller surfaces (per-task operation subsets, terse
  descriptions), not a new engine.
- Nothing in 72 cells justifies edits/checks, memory, sandboxing, or
  catalog growth. Keep those gated behind measured need.
