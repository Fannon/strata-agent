# 046 — Bounded post-parity comparison v3 (versioned rerun)

Status: V3 DELIVERED 2026-09-19 — 36/36 cells, $0.3493; completion gap closed, cost gap persists
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

## Calibration readout (pilot-v3-cal, 2 cells, $0.0156)

Task `e85d92a_1` (v2: typed 0/3, direct 3/3 strict):

| Cell | Cost | Grading | Strict |
| --- | --- | --- | --- |
| typed r1 | $0.0114 | completed, 2 passes / 0 failures | YES (exit 0) |
| direct r1 | $0.0042 | completed, 2/0 | NO by exit code only (agentExit 78: guard cost-reservation stop after 4 requests) |

Typed solved a task it never solved in v2 — first evidence the parity fix matters. Direct's exit 78 is a harness artifact of the small calibration budget ($0.5 → per-cell $0.5 cap trips worst-case reservation accounting), not a task failure; v2 used per-cell $2.00. Full v3 reuses v2 budget params (4.5 total, $2.00/cell) for comparable guard behavior; strict counting stays by the frozen driver rule in both arms.

Cumulative after calibration: prior ≈ $0.84192 + $0.0156 ≈ **$0.8575** (unreconciled estimate), inside the €5 authorization.

## v3 readout (pilot-v3, 36/36 cells, $0.3493, 2026-09-19)

| Arm | Strict /18 | Completed /18 | Cost | Cost/strict |
| --- | --- | --- | --- | --- |
| typed | 15 | 18 | $0.2113 | $0.0141 |
| direct | 15 | 16 | $0.1380 | $0.0092 |

Paired strict (typed–direct): `4ec8de5_1` 0–0, `9bf2c8a_2` 3–3, `ccb4494_1` 3–3, `e85d92a_1` 3–3, `eb5ad85_2` 3–3, `f691597_1` 3–3. v2 was typed 9/18 ($0.0290/success) vs direct 15/18 ($0.0069/success).

Typed gains vs v2: `e85d92a_1` 0→3 and `eb5ad85_2` 0→3 strict; both are datetime-heavy tasks consistent with the parity fix. `4ec8de5_1` defeats both arms in v3 (typed 0/3 with 1/1 grading; direct 0/3: two genuine 1/1 misses plus one True/2/0 cut by guard reservation stop, exit 78). Direct held 15/18; its one v2 success on `4ec8de5_1` did not repeat (n=3 noise, no attribution).

Against the frozen screening rule: bar 1 (typed completion no lower) PASSES 15–15; bar 2 (≥15% lower cost/success) FAILS — typed $0.0141 is ~53% above direct $0.0092, though the gap narrowed from v2's ~4.2× to ~1.5×. Bar 3 (no worse effects) passes: zero destructive-hint direct calls (252 attempts, 14 failed, all non-destructive), zero typed policy-failure evidence in transcripts.

Verdict: parity fix recovered typed completion but not cost efficiency — still no positive signal for the typed hypothesis on this pilot; a narrowed negative/inconclusive. No confirmation follows. Raw cells local under `.work/appworld/pilot-v3/` (+`pilot-v3-cal/`); ledger + summaries retained. v2 preserved unchanged.

Spend: v3 $0.3493 + calibration $0.0156 = $0.3649 new. Cumulative ≈ $0.84192 + $0.3649 ≈ **$1.21** (unreconciled estimate), inside the €5 authorization with ~€3.8 headroom.

## Efficiency anatomy (free local analysis, no spend)

- Requests: typed 6.1/cell vs direct 12.3/cell — typed needs HALF the round trips.
- Cost/request: typed $0.0019 vs direct $0.0006 — typed costs 3× per request (declaration context in every prompt).
- Net: 1.5× cost per success at completion parity. Per-task costs favor direct on ALL six tasks, including aggregation `eb5ad85_2` ($0.039 vs $0.026).
- Hard task `4ec8de5_1` ("songs released in this or last year"): both arms fail identically (1/1 grading) — date-relative counting difficulty, arm-independent.

Mechanism: the typed interface wins interaction efficiency but loses token efficiency; declarations dominate. This predicts heavier computation would NOT close the cost gap (context rides along), so a heavier-compute probe is not currently justified. Hybrid 044 remains open but unselected. Stopping here is valid: narrowed negative with a measured mechanism.

- Calibration 2/2 cells complete with valid result.json + upstream grading.
- Full v3 36/36 attempted within budget; ledger + pilot-summary committed as sanitized summaries only (raw runs stay local).
- Paired analysis recorded; v2 preserved; no claim beyond dev tasks.

## Alternatives (not selected)

Heavier-computation task family, hybrid 044, REST integration, catalog scaling — each needs its own justification after v3 reads out. Narrowing or stopping remains valid.
