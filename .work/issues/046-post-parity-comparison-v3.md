# 046 — Bounded post-parity comparison v3 (versioned rerun)

Status: PROPOSED MATRIX FROZEN, calibration pending — no full run yet
Dependencies: 045 (delivered compat fix + regression); 042 (v2 preserved unchanged, confounded record)

## Question

Does the 045 parity fix change the v2 outcome (typed 9/18 vs direct 15/18 strict)? v2 ran with the typed arm rejecting naive datetimes the direct arm accepted. v3 reruns the identical cells with both arms now sharing the compat setting through the real entry points.

## Frozen v3 matrix

- File: `.work/appworld/pilot-v3-matrix.json` (local, git-ignored like v2; sha256 `032b1adf…fd27`). Generated from v2 matrix: same 6 dev tasks × 2 arms × 3 reps = 36 cells, same seeded order, same per-cell allowManifests, cell ids prefixed `v3-`.
- Seed: `046-v3-order-v1`. Model: `meta/muse-spark-1.3-contributor`, thinking medium. Caps: 40 requests/cell, per-cell $2.00, agent timeout 1700s.
- Code version: post-045 (`f5def60` + fix). Only delta since v2: `sessionFromConfig` forwards `compat.acceptNaiveDateTime` (045). Prompts, manifests, reset/save/grade path unchanged.
- Tasks remain development-only (same inspected-through-v2 dev tasks); v2 artifacts untouched. No generalization claim follows; a positive signal would need confirmation on untouched tasks (009/035 tracks).

## Decision rule (same screening rule as 042)

Typed strict completion no lower than direct, with ≥15% lower total cost per success or median latency, and no worse observed unauthorized-effect count. Report paired task results and tails; 36 cells cannot establish superiority. Outcomes: positive signal → propose confirmation on untouched tasks; narrow signal → narrow hypothesis; negative/inconclusive → report, stop or select one justified follow-up.

## Spend

- v3 estimate from v2 actuals ($0.3645/36 cells ≈ $0.0101/cell): full v3 ≈ **$0.40–0.60**, worst-case reservation ≈ $1.60 at measured rates.
- Cumulative: prior ≈ $0.84192 (reported, not reconciled) + v3 ≈ $0.50 → ≈ **$1.35**, inside the user-authorized €5 total (tracked conservatively in USD; $5.00 cap < €5 at any plausible rate).
- Staging: 2-cell calibration (`e85d92a_1` typed+direct, the task where typed went 0/3 in v2) ≈ $0.03 first; full 36-cell run only if calibration cells complete cleanly through the fixed entry points.

## Acceptance

- Calibration 2/2 cells complete with valid result.json + upstream grading.
- Full v3 36/36 attempted within budget; ledger + pilot-summary committed as sanitized summaries only (raw runs stay local).
- Paired analysis recorded; v2 preserved; no claim beyond dev tasks.

## Alternatives (not selected)

Heavier-computation task family, hybrid 044, REST integration, catalog scaling — each needs its own justification after v3 reads out. Narrowing or stopping remains valid.
