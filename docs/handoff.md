# Next-agent handoff

Reviewed 2026-09-19 at `1d8ed19`. Read [AGENTS.md](../AGENTS.md), [README](../README.md) and the [issue board](../.work/issues/index.md). The board owns ordering. This is an unfinished research prototype.

## Current decision

The AppWorld pilot observed **typed 9/18 strict successes at $0.0290/success versus direct 15/18 at $0.0069/success**. Preserve those outcomes. The earlier “healthy negative” interpretation is superseded: a confirmed validation-policy mismatch makes this an observed negative result with a confound, not a clean matched comparison.

The typed Pi `sessionFromConfig` MCP path ignores `compat.acceptNaiveDateTime`; the direct-tool extension applies it. The driver configures both. The supervisor reproduced the difference using both actual entry points and a synthetic MCP response: typed rejects the timezone-free timestamp, direct accepts it. Strict defaults reject it as expected. Existing parity tests exercise the broker/direct replay path, so they missed this wiring gap.

No runtime fix was made during this review. Fixing the gap may not reverse the result, and the observed success difference cannot be attributed solely to it.

## Evidence and limits

- Manual feasibility gates 0–2 are delivered: Windows environment verified, output-only compatibility exercised, development task solved twice from reset with upstream grading. Gate 3 is partial because actual Pi entry-point parity failed; gate 4 ran with that confound.
- Visible typed metrics: 191 tool ends, 144 with structured metrics (all program outcome `ok`), 47 without. The 144 reports contain 2,198 backend invocations and 442 validation failures: 441 output, one input. Caught call failures can coexist with a successful program. These counts are not proof of complete error accounting or a causal explanation.
- Direct logs contain 256 recorded attempts, including 13 input failures rejected before invocation. Zero destructive hints and zero visible typed policy denials do not prove all effects were task-authorized.
- Both arms preloaded their app-specific operation sets (54/81/98); lazy discovery was not tested. Direct retained shell/files while typed was strict. Per-cell latency was not measured.
- Earlier repository trials also found no demonstrated overall advantage; compact declaration development gains did not survive confirmation. See [repository report](repo-trials.md) and [042](../.work/issues/042-matched-application-comparison.md).

## Recommended next assignment

[045 — Actual-entry validation parity](../.work/issues/045-pilot-entrypoint-validation-parity.md) is delivered 2026-09-19:

1. Permanent synthetic regression through real typed and direct Pi entry points is green (`test/integration/pi-entry-parity.test.ts` 4/4 over a real MCP probe subprocess).
2. Explicit compatibility policy is forwarded in `sessionFromConfig` for all transports while strict defaults and input validation are preserved; compat true/unset/false, malformed values and strict inputs covered.
3. Relevant offline checks are green (`bun run check`; full suite 163 pass / 12 fail = baseline 159/12 + 4 new, same documented Windows classes). No paid comparison ran; v2 unchanged.

Any subsequent model run needs its own version, frozen matrix and spend cap. Preserve v2; reused tasks are development material. Do not jump directly to confirmation, heavier-computation tasks, hybrid 044, REST integration or catalog scaling. Those need separate justification. Narrowing or stopping remains valid.

The broader hypothesis is uniform typed functions over remote services and local CLI/filesystem operations, backed by a programmable runtime—not GUI automation. See [043](../.work/issues/043-api-composition-computer-environment.md) and [044](../.work/issues/044-uniform-versus-hybrid.md). The missing structured error reports warrant care; do not assume the existing [038](../.work/issues/038-missing-typed-program-reports.md) diagnosis automatically applies to AppWorld.

## Verification and environment

Fresh supervisor checks: `bun run check` passes; AppWorld parity tests 4/4; full suite **163 pass / 12 fail**, 175 tests, 1,292 assertions (baseline 159/12 at `1d8ed19` + 4 new 045 regression tests; failures match the documented Windows classes).

The available AppWorld venv is `.work/appworld/venv-win` (Python 3.14.7, pinned upstream source, MCP 2.2.0). Set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`, pass the Windows interpreter explicitly, and use the matching per-app allow-manifest. Do not use the dead Linux venv or reintroduce the v1 stale-allowlist bug.

Synthetic audit reproduction: `bun .work/pi-agent/review-20260919/verify-entry.ts` (local diagnostic). The durable regression is committed: `test/integration/pi-entry-parity.test.ts` over the real-entry probe server `test/fixture-mcp/datetime-server.ts` (045, green).

## Spend and artifact discipline

Three Pi worker sessions for this review cost **$0.031921796** total (18 + 18 + 12 requests). The first two reached conservative reservation caps; the third completed. No benchmark cells ran. Prior cumulative spend was reported as approximately $0.81, giving approximately **$0.84192** cumulative; this is not a billing reconciliation. The combined local ledger is `.work/pi-agent/review-20260919/combined-ledger.json`.

The user's €5 cumulative ceiling covers the whole program, including worker sessions. Per-session caps do not reset it. Before any further campaign, reconcile remaining allowance and currency explicitly. Use the selected OpenRouter Muse Spark model with medium thinking for delegated work. Never print credentials or commit raw transcripts, task answers, databases or generated datasets. Do not open ground truth or task databases to solve tasks. Commit only sanitized records and authorized code.
