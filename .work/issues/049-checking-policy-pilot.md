# 049 — Updated Pi baseline and checking-policy pilot

Status: DELIVERED 2026-09-30 — 36/36 strict successes, estimated model cost $0.024197942; no further run selected
Dependencies: 021 (checking hypotheses), 048 (modern Pi baseline), verified QuickJS experiment harness

## Authorization and scope

The user requested a baseline after updating Pi, followed by a few experiments on the proposed directions and checking only after failure. Use OpenRouter `meta/muse-spark-1.3-contributor`, medium thinking, up to €5 for this batch. This is a new batch authorization; historical approximately $1.21 remains a separate unreconciled estimate. Keep cost controls simple and log actual usage. No other model or provider fallback.

## Frozen pilot design

- Installed global Pi: **0.99.1**; repository package remains pinned to 0.73.1. All paid cells use the global 0.99.1 executable and an isolated local profile.
- Runtime: QuickJS for all Strata policies; native Pi uses its own QuickJS Codemode. Native Pi is a whole-system comparator, not an isolated compiler ablation.
- Two natural composition tasks: invoice aggregation and payment reconciliation, three fresh repetitions each, four profiles (native Codemode, always check, never check, check after failure): **24 cells**.
- Two seeded repair tasks: invalid result use after a simulated write, and successful-looking wrong output from a misspelled field, two fresh repetitions each, three Strata policies: **12 cells**. These intentionally seeded failures measure repair behavior, not natural model error frequency. Each cell executes its seed once before asking the model to recover; seed time/calls/effects are recorded separately and included in execution totals.
- Baseline first: the six natural native-Pi cells and six always-check cells before experimental policies. Rotate profile order within later task/repetition blocks.
- Same declarations and tool description across the three Strata policies; identical schema validators, broker grants, source restrictions, executor and fixtures. Policy changes only semantic checking and feedback timing. Never disable runtime validation or authorization.
- Correctness: controller-held exact final JSON plus final simulated payment state, healthy process completion and complete usage. Wrong or duplicate payments fail independently of the final answer. Raw fixtures/transcripts/profile credentials stay ignored under `.work/`.
- Limits: 8 model requests/cell, 4096 output tokens/request, 180 seconds/cell, batch stop at $4.50 reported usage or unknown usage. At the ECB reference $1.1355/€ (September 29/30), $4.50 leaves margin under €5; [source](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html). No web/classifier model calls inside scripts.
- Mechanism probe: deterministic valid, invalid, partial-effect, silent-wrong-output, dead-branch, business-rule and response-contract controls before paid trials. Optional stored-program replay on changed synthetic worlds measures reuse feasibility only; it does not establish recurrence, retrieval or amortized model-cost superiority.

## Decision rules and limits

Report all attempted cells, strict successes, requests, actual usage/cost, latency, diagnostics/repairs and simulated effects. A policy change requires no lower observed natural-task completion and a useful reduction in total work; seeded recovery is reported separately. Small development-only samples cannot establish general superiority. A type-correct wrong answer is an explicit negative control. After-failure checking cannot diagnose successful-looking failures unless an independent grader or user detects them; no automatic replay after errors.

Model-free environment baseline: `bun run check` passed after restoring pinned dependencies. Full suite on macOS/Bun 1.4.0-canary.1: **168 pass / 28 fail**, 196 tests, 1367 assertions. QuickJS runtime tests passed; most failures concern direct-Bun temporary module resolution, plus BFCL local-data setup and a benchmark HTTP integration setup. Follow-up tracked in 050; do not expand this pilot into a portability fix.

## Results

See the [pilot report](../../docs/checking-policy-pilot.md) for the full evidence and limits. All 12 baseline cells passed before the 24 experimental cells ran. Natural tasks: native / always / never / after-failure each 6/6, at total estimated costs $0.004408 / $0.003807 / $0.003702 / $0.004436 and 13 / 13 / 13 / 15 model requests. Always-check found no semantic errors in naturally generated programs. One after-failure run had a syntax error caught by the common parser; it recovered without invoking the semantic checker.

Seeded repair: all three policies passed 4/4 across the two task families, with no duplicate or wrong final payments. Always-check blocked both erroneous seeds before execution; never and after-failure performed an earlier simulated write before the later error. Never recovered without compiler diagnostics. After-failure diagnosed the thrown error but did not activate on the silent wrong empty result; explicit verification prompts enabled repair in that family.

Model-free: 21 mechanism controls and 10 stored-workflow replays behaved as expected. Reuse was feasible in both checked and unchecked paths; no retrieval/recurrence or amortization claim. Typecheck passed; focused verification 30/0 with 165 assertions. Full-suite baseline failures remain 050; no general portability work performed.

Versioning: initial 049-v1 startup failed HTTP 401 with zero reported cost because Pi 0.99.1 changed environment-reference syntax. Preserved locally. Corrected 049-v2 froze the same intended matrix and sources before successful cells; all 36 cells healthy with complete usage. Source hashes and installed-Pi fingerprints are local. The report's cost is a token-rate estimate, not a provider bill; historical approximately $1.21 is separate.

Decision: no completion benefit or clear economic advantage from always checking on these small natural tasks; optional checking is plausible, while early checking still prevents some partial effects and silent mistakes. Production sessions continue to always check. No new model trial, release or dependency upgrade selected.

## October 1 interpretation review

Documentation updated from the same frozen 049-v2 artifacts; no further calls or code changes. [Expanded lessons](../../docs/checking-policy-pilot.md#what-we-learned-from-the-run) distinguish descriptions from enforcement, prevention from later diagnosis, and execution success from task correctness. The benefit of declarations themselves was not isolated. Skipping semantic checking retained their token cost and did not address the earlier application comparison's context overhead.

Trace inspection also narrowed the recovery claim: in all four unchecked partial-effect attempts, the model queried `listPayments` and confirmed that the requested new payment already existed. It did not rerun the original faulty script. This supports state-aware task recovery under the explicit prompt and visible synthetic ledger, not a general script-repair or replay guarantee. Reuse remains feasibility evidence under 047; production policy and broader confirmation remain unselected.
