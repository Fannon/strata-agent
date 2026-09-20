# Next-agent handoff

Reviewed 2026-09-20 at `1f28a6b`. Read [AGENTS.md](../AGENTS.md), [README](../README.md) and the [issue board](../.work/issues/index.md). The board owns ordering. This is an unfinished research prototype.

## Current decision

Pilot v2 observed **typed 9/18 strict at $0.0290/success versus direct 15/18 at $0.0069/success** (preserved, confounded). The earlier "healthy negative" interpretation is superseded: a confirmed validation-policy mismatch made v2 an observed negative with a confound, not a clean matched comparison — the typed Pi `sessionFromConfig` MCP path ignored `compat.acceptNaiveDateTime` while the direct-tool extension applied it.

[045](../.work/issues/045-pilot-entrypoint-validation-parity.md) (delivered 2026-09-19) forwards compat through all real entry points with a permanent 4/4 regression; strict defaults and input validation preserved. [046](../.work/issues/046-post-parity-comparison-v3.md) (delivered 2026-09-19) reran the identical 36 cells post-fix: **typed 15/18 at $0.0141/success vs direct 15/18 at $0.0092/success**. The fix recovered completion (typed `e85d92a_1` 0→3, `eb5ad85_2` 0→3) but not cost — bar 2 of the frozen screening rule fails (~53% above direct, narrowed from v2's ~4.2x). Mechanism: typed halves model round trips (6.1 vs 12.3/cell) but triples cost per request ($0.0019 vs $0.0006); declarations dominate, and direct is cheaper on all six tasks including aggregation. `4ec8de5_1` defeats both arms identically. Verdict: narrowed negative/inconclusive, no confirmation. No further campaign selected.

## Evidence and limits

- Manual feasibility gates 0–2 are delivered: Windows environment verified, output-only compatibility exercised, development task solved twice from reset with upstream grading. Gate 3 is delivered via 045 actual-entry parity (real-entry 4/4 regression); gate 4 v2 ran with that confound (preserved), and gate 4 v3 reran post-fix to completion parity with a persistent cost gap (see 046).
- Visible typed metrics: 191 tool ends, 144 with structured metrics (all program outcome `ok`), 47 without. The 144 reports contain 2,198 backend invocations and 442 validation failures: 441 output, one input. Caught call failures can coexist with a successful program. These counts are not proof of complete error accounting or a causal explanation.
- Direct logs contain 256 recorded attempts, including 13 input failures rejected before invocation. Zero destructive hints and zero visible typed policy denials do not prove all effects were task-authorized.
- Both arms preloaded their app-specific operation sets (54/81/98); lazy discovery was not tested. Direct retained shell/files while typed was strict. Per-cell latency was not measured.
- Earlier repository trials also found no demonstrated overall advantage; compact declaration development gains did not survive confirmation. See [repository report](repo-trials.md) and [042](../.work/issues/042-matched-application-comparison.md).

## Recommended next assignment

[045](../.work/issues/045-pilot-entrypoint-validation-parity.md) and [046](../.work/issues/046-post-parity-comparison-v3.md) are both delivered 2026-09-19. No new comparison, heavier-compute probe, hybrid 044, REST integration or catalog scaling is selected: 046's mechanism (declaration context rides along every request) predicts heavier computation would not close the cost gap, and per-task costs give no category where typed pulls ahead. Narrowing or stopping remains valid. Any future model run needs its own version, frozen matrix and spend cap; preserve v2/v3 with reused tasks as development material.

The broader hypothesis is uniform typed functions over remote services and local CLI/filesystem operations, backed by a programmable runtime—not GUI automation. See [043](../.work/issues/043-api-composition-computer-environment.md) and [044](../.work/issues/044-uniform-versus-hybrid.md). The missing structured error reports warrant care; do not assume the existing [038](../.work/issues/038-missing-typed-program-reports.md) diagnosis automatically applies to AppWorld.

## Verification and environment

Supervisor check 2026-09-20: `bun run check` passes. Last recorded full suite **163 pass / 12 fail**, 175 tests, 1,292 assertions (baseline 159/12 at `1d8ed19` + 4 new 045 regression tests; failures match the documented Windows classes). No new full-suite run in this check.

The available AppWorld venv is `.work/appworld/venv-win` (Python 3.14.7, pinned upstream source, MCP 2.2.0). Set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`, pass the Windows interpreter explicitly, and use the matching per-app allow-manifest. Do not use the dead Linux venv or reintroduce the v1 stale-allowlist bug.

Synthetic audit reproduction: `bun .work/pi-agent/review-20260919/verify-entry.ts` (local diagnostic). The durable regression is committed: `test/integration/pi-entry-parity.test.ts` over the real-entry probe server `test/fixture-mcp/datetime-server.ts` (045, green).

## Spend and artifact discipline

Three Pi worker sessions for the 045 review cost **$0.031921796** total (18 + 18 + 12 requests); cumulative at that point ≈ **$0.84192** (unreconciled). 046 v3 added $0.3649 (calibration $0.0156 + 36 cells $0.3493), giving cumulative ≈ **$1.21** of the €5 authorization with ~€3.8 headroom. No benchmark cells ran in this check. The combined local ledger is `.work/pi-agent/review-20260919/combined-ledger.json`.

The user's €5 cumulative ceiling covers the whole program, including worker sessions. Per-session caps do not reset it. Before any further campaign, reconcile remaining allowance and currency explicitly. Use the selected OpenRouter Muse Spark model with medium thinking for delegated work. Never print credentials or commit raw transcripts, task answers, databases or generated datasets. Do not open ground truth or task databases to solve tasks. Commit only sanitized records and authorized code.
