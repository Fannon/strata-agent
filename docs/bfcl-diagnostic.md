# BFCL invocation diagnostic (issue 037)

Strictly a diagnostic: does the model pick the right function, fill arguments
correctly, and abstain when nothing fits — over typed Strata programs? Not a
leaderboard score, not a scaling claim. See the verdict discussion in the
project summary: BFCL hands each question ~3 functions, so it cannot measure
retrieval across thousands of tools.

## Pin and subset

- Upstream: `ShishirPatil/gorilla` at `6ea5797`, Apache-2.0, local only under
  `.work/bfcl/` (never committed). File hashes recorded per run in `plan.json`.
- Subset (30 cases, file order, first 10 each):
  `BFCL_v4_simple_python.json` (single-call accuracy),
  `BFCL_v4_multiple.json` (function choice),
  `BFCL_v4_irrelevance.json` (abstention — no ground-truth file upstream;
  graded as zero recorded calls).
- Ground truth: upstream `possible_answer/` per-param value lists; multiple
  alternatives pass if ANY matches. Omitted params pass only when upstream
  lists `""` as acceptable.

## Harness

- `examples/bfcl/cases.ts`: loading + normalization. BFCL Python-isms map
  explicitly (`dict`→`object`, `tuple`→`array`, `float`→`number`, `any`→`{}`).
  Anything else throws visibly — schema gaps are reported, never papered over.
- `examples/bfcl/server.ts`: stdio MCP record-all server. No backend by design:
  BFCL grades the CALL, so invocations are appended to a JSONL record file
  and answered with canned `{ok: true}`.
- `examples/bfcl/grade.ts`: tolerance grading (exact names, per-param value
  lists, int/float spelling tolerance, extra params fail, alternatives any-match,
  irrelevance requires silence). BFCL-inspired rule, not official scoring.
- `examples/benchmark/bfcl.ts`: per-case guarded typed-only Pi sessions
  (`STRATA_STRICT=1`, model muse-spark, medium), dual-ledger cost accounting
  (actuals deducted, reservation fallback), dry-run default, explicit
  `--run --max-cost-usd` for live mode.
- Deterministic tests: `test/integration/bfcl.test.ts` (4 tests: normalizer,
  subset loading + ground truth, grading tolerance, server round-trip).

## Interpreting results

- Grade from RECORDED CALLS, never the final text — same discipline as BFCL.
- Incorrect answers are data; incomplete runs exit nonzero.
- Per-cell prompts are minimal and neutral; no per-case tuning (that would be
  fitting to the test). A second model tests portability only after the first
  signal. Distractor injection for scale would be a separate labeled experiment.

## Cost note

30 single-shot cells, ~1-2 requests each at small contexts: expected actual
roughly $0.02-0.05 under a $5 reservation cap (dual ledger, same discipline
as repo-pilot). No paid run has happened under this plan yet.
