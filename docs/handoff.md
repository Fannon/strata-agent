# Next-agent handoff

## Latest implementation — structured results and recovery, October 1, 2026

User selected recommendations 2 and 3: 058 explicit structured finalization, 053 action receipts, plus the narrow 052 prerequisite. Shared production implementation is complete, without model-specific branches or paid calls. [Contracts, usage and limits](results-and-recovery.md).

`typed_program` accepts optional `finalize:true`; `finalize_result(program)` explicitly selects the latest successful completed program in the current request. Session retains immutable bounded JSON; Pi message_end replaces final answer text while preserving provider usage/thinking. Completed events/state/persistence agree. New programs, other external actions, new user/steering requests and abnormal completions invalidate selection. Existing program_details/program_effects inspection preserves it. Inline selection has no separate selection turn; explicit selection adds one tool call; normal final model completion is still required. No real-model cost/completion improvement measured yet.

Broker receipts separately store bounded arguments/responses and accepted/not-executed/uncertain status for write/unknown operations, with output-schema provenance. Known reads skip payload copying. Errors include a small current-request retained recovery summary; program_effects pages evidence and allowed operations declared read-only. Earlier accepted calls remain acknowledged after later failures/cancellation, fixing the previous blanket cancellation classification. No auto-retry, rollback, durable resume ledger or new backend idempotency support. 20-program retention and evidence truncation/eviction are explicit.

Compiler rejects known invalid awaited root returns before effects; any/unknown/assertions/nested serialization still require runtime checks. Real payment/invalid-reply recovery verifies the backend ledger without replay. Typecheck passed; 73 focused tests/495 assertions across 11 files passed, including 18 new regressions. The final touched-source run passed 40 tests/187 assertions across runtime and both new integration files, including thinking preservation. Expanded coverage reproduced one known direct-Bun temporary-import failure under 050; no claim of a green full suite or full installed Pi 0.99.1 certification. Tests use pinned Pi 0.73.1 and scripted local responses, with no external provider access.

README/ARCHITECTURE/board updated. Frozen benchmark examples, published metrics and raw evidence remain unchanged; older matrices' production fingerprints intentionally differ now. Reproduce earlier campaigns from their recorded commits. Current recommendation: no new work selected; 061 cross-model/fair-native confirmation remains deferred.

## Prior delivery — 060 tuning, October 1, 2026

**User constraint:** optimize a model-independent Strata interface, not individual models. 060 selected one shared recipe, with no model-name branching; examples vary only by API schema. Muse/GLM rows identify the model using that profile. Keep model-specific prompts/helpers/policies out of future tuning; unseen-model confirmation is proposed in deferred 061, not selected.

[060](../.work/issues/060-strata-tuning-trials.md) is complete: 60 development attempts across baseline/recipe/helper/lean/feedback, then 72 confirmation attempts on six new definitions × three worlds × two arms × two models. Inventory checkpoint `730998c` was pushed before paid calls. [Report](strata-tuning-results.md), [sanitized 132-cell evidence](evaluations/tuning-2026-10-01.json), prototype in `examples/tuning/`. Retain recipe only as an experimental profile; helper added repairs/cost, lean failed correctness, smaller feedback never activated. Production defaults and earlier frozen sources/results are unchanged.

Every confirmation row covers six distinct definitions and 18 attempts; requests are model turns, tokens include cache/output, failures stay in averages:

| Model/profile | Answer + state | Strict | Effects | Requests/attempt | Tokens/attempt | Median seconds | $/attempt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muse baseline | 17/18 | 17/18 | 17/18 | 3.22 | 14,643 | 25.87 | $0.001459 |
| Muse recipe | 18/18 | 18/18 | 18/18 | 2.39 | 10,186 | 16.86 | $0.001039 |
| GLM baseline | 17/18 | 14/18 | 17/18 | 3.00 | 9,791 | 22.30 | $0.001342 |
| GLM recipe | 18/18 | 13/18 | 18/18 | 2.50 | 7,446 | 16.04 | $0.001009 |

Strict successes stayed 31/36 per arm. Two baseline failures were the same N2 allocation definition; no general reliability superiority. Muse cost ratio interval stays below parity; GLM's includes parity. This compares checked profiles, with shared program_details access, not native Pi or a checking ablation. Selection gates were frozen; the precise cost tie-break was decided after development before confirmation. Do not describe it as fully prespecified. Selection hash and limits are in the report.

Tuning cost $0.135026586 over 350 requests; September 30/October 1 sequence $0.381842432, separate from the historical approximately $1.21. All 132 attempts healthy with complete usage; no paid failures replaced. Raw evidence under ignored `.work/tuning-20261001-v1/`. `bun run check` and 57 model-free preflight checks (including 18 SQL oracle comparisons) pass. Source/usage audit preserves 049/051/054 and installed Pi fingerprints. Do not mutate or prepare over existing evidence; inspected tasks are now development/regression material.

No further work selected. Potential separately selected work: 058 canonical final JSON, 053 action receipts for critical writes, 055 checking attribution, or broader 059 discovery. Recipe integration into the full production extension is separate from this prototype. No additional paid calls are needed to close 060.

## Prior delivery — 054, October 1, 2026

[054](../.work/issues/054-broader-composition-benchmark.md) is complete. The README/docs checkpoint was pushed as `7b64a4e` before benchmark work. Implemented `examples/composition/`, ran four disjoint development definitions (16 attempts), then 20 evaluation definitions × three worlds × native/checked × two models (240 attempts). No failures were replaced. [Report](composition-benchmark.md); [sanitized data](evaluations/composition-2026-10-01.json).

Muse medium: native 58/60 versus checked 60/60 answer/state success; requests 2.12/2.13, tokens 8614/6207, median time 10.46/10.87 s, cost/attempt $0.000844/$0.000653. Checked model cost is 22.6% lower, with a task-block interval below parity on this corpus. GLM low: native 56/60 versus checked 59/60; requests 2.17/2.57, tokens 6847/6004, median time 6.74/13.16 s, cost/attempt $0.000858/$0.000910. One native GLM primary failure is serialization-only; pure JSON successes were 49/60 native and 36/60 checked. Reliability differences remain uncertain.

Checked effects were correct in all 120 evaluation attempts. Native Muse made ten wrongly valued simulated payments (two repetitions of one task); native GLM omitted five required payments in one runaway program. No duplicate/unintended-target writes. Checked GLM made the correct payments but later denied having added them. Thirty-two compiler rejections preceded any calls from those programs; many were strict typing/inference repairs. Preserve quiet checking; this whole-system comparison does not isolate the semantic gate.

Paid work cost $0.204487 over 576 requests including development; combined with the prior pilots $0.246816. Frozen matrix/source hashes, all results, transcripts, profiles and state are local in `.work/composition-20261001-v1/`. Development controller sources/matrix were archived before usage/resume guard tightening; prompts, tasks, scoring and runtime were unchanged. Both requested reasoning settings were verified from every payload. Sources for 049/051 remain intact. Never run `--prepare` over existing evidence; a future authorized replay requires a fresh output directory/catalog and installed Pi path.

Verification: typecheck; 78 model-free contract/state/session checks; 72 independent SQL answer-oracle checks. Full-suite macOS/Bun baseline failures remain deferred under 050. The benchmark uses the production checked session but an experimental Pi 0.99.1 extension; the project still pins Pi 0.73.1, and full extension compatibility was not certified.

## Documentation follow-up and tuning inventory

The user requested updated docs/publication and ideas after the run, then explicitly asked about system prompts, function presentation and tool search. [Inventory/plan](glm-improvement-plan.md) now documents the actual full extension versus the 054 harness. Corrected the report’s “unknown caught errors” wording: the inspected TS18046 diagnostics concern unknown page/row values. Nineteen checked GLM attempts had rejections; sixteen rejected programs declared pagination helpers. Existing scores, sources and shipped runtime stayed unchanged; no paid calls.

## Selection record for the delivered tuning

Subsequent user authorization selected the narrow prototypes under 060, now delivered above. The inventory's broader prompt/discovery/receipt/finalization suggestions did not authorize additional implementation. Preserve that distinction; do not expand scope from the original working order.

## Historical checkpoints

The following dated records explain earlier decisions and environments. Statements about selected work/spend below describe those checkpoints, not the current assignment.

Reviewed 2026-09-22 against `4e2df5d` and accompanying documentation changes. Read [AGENTS.md](../AGENTS.md), [README](../README.md), the [wrap-up review](wrap-up.md) and the [issue board](../.work/issues/index.md). The board owns ordering. Recommendation: pause this unfinished research prototype; no further experiment is selected.

September 30 follow-up: the [later Pi MCP/Codemode note](research/pi-codemode-2026-09.md) records the announcement's chronology. The user then authorized [049](../.work/issues/049-checking-policy-pilot.md): baseline on installed Pi 0.99.1, followed by always/never/after-failure experiments. **36/36 strict successes**, estimated model cost **$0.024197942** for this batch. Natural profiles each 6/6; always-check found no semantic errors in model-generated programs. Seeded checks prevented partial effects and silent field mistakes; never-check recovered without compiler diagnostics. No clear cost/speed advantage from skipping checks. See the [report](checking-policy-pilot.md). Production defaults and dependency pin stay their original behavior; no further experiment is selected.

October 1 documentation review of the same run: [expanded lessons](checking-policy-pilot.md#what-we-learned-from-the-run) separate declarations, semantic prevention, runtime validation and task correctness. Declarations were supplied in every policy, so their own benefit was not isolated and skipping checking did not reduce declaration overhead. In all four unchecked partial-effect recoveries, Pi read the payment ledger and confirmed completion without replaying the original script; this depended on explicit verification instructions and observable state. Do not describe those cells as proving arbitrary compiler-free script repair or automatic replay safety. No additional model calls or implementation changes accompanied this review.

The experiment harness lives in `examples/checking/`; its policies are not production session options. Raw matrices, installed-Pi fingerprints, transcripts and state are ignored under `.work/checking-20260930-v2/`. `--prepare` needs a public OpenRouter catalog at `/tmp/strata-openrouter-models.json`; paid phases are explicitly `--baseline` then `--experiment`, with source hashes and resume-safe cell tracking. Do not rerun paid phases without a newly selected scope. Initial zero-token HTTP 401 artifacts are preserved under `.work/checking-20260930/`.

## Historical application decision (September 19)

Pilot v2 observed **typed 9/18 strict at $0.0290/success versus direct 15/18 at $0.0069/success** (preserved, confounded). The earlier "healthy negative" interpretation is superseded: a confirmed validation-policy mismatch made v2 an observed negative with a confound, not a clean matched comparison — the typed Pi `sessionFromConfig` MCP path ignored `compat.acceptNaiveDateTime` while the direct-tool extension applied it.

[045](../.work/issues/045-pilot-entrypoint-validation-parity.md) (delivered 2026-09-19) forwards compat through all real entry points with a permanent 4/4 regression; strict defaults and input validation preserved. [046](../.work/issues/046-post-parity-comparison-v3.md) (delivered 2026-09-19) reran the identical 36 cells post-fix: **typed 15/18 at $0.0141/success vs direct 15/18 at $0.0092/success**. The fix recovered completion (typed `e85d92a_1` 0→3, `eb5ad85_2` 0→3) but not cost — bar 2 of the frozen screening rule fails (~53% above direct, narrowed from v2's ~4.2x). Mechanism: typed halves model round trips (6.1 vs 12.3/cell) but triples cost per request ($0.0019 vs $0.0006); declarations dominate, and direct is cheaper on all six tasks including aggregation. `4ec8de5_1` has zero strict successes in both arms; one direct attempt passed grading but stopped at a budget guard. Verdict: narrowed negative/inconclusive, no confirmation. No further campaign selected.

## Evidence and limits

- Manual feasibility gates 0–2 are delivered: Windows environment verified, output-only compatibility exercised, development task solved twice from reset with upstream grading. Gate 3 is delivered via 045 actual-entry parity (real-entry 4/4 regression); gate 4 v2 ran with that confound (preserved), and gate 4 v3 reran post-fix to completion parity with a persistent cost gap (see 046).
- Historical v2 typed metrics: 191 tool ends, 144 with structured metrics (all program outcome `ok`), 47 without. The 144 reports contain 2,198 backend invocations and 442 validation failures: 441 output, one input. Caught call failures can coexist with a successful program. These counts are not v3 results or proof of complete error accounting or causality.
- Historical v2 direct logs contain 256 recorded attempts, including 13 input failures rejected before invocation. Zero destructive hints and zero visible typed policy denials do not prove all effects were task-authorized.
- Both arms preloaded their app-specific operation sets (54/81/98); lazy discovery was not tested. Direct retained shell/files while typed was strict. Per-cell latency was not measured.
- Earlier repository trials also found no demonstrated overall advantage; compact declaration development gains did not survive confirmation. See [repository report](repo-trials.md) and [042](../.work/issues/042-matched-application-comparison.md).

## Historical recommended assignment

[045](../.work/issues/045-pilot-entrypoint-validation-parity.md) and [046](../.work/issues/046-post-parity-comparison-v3.md) are both delivered 2026-09-19. No new comparison, heavier-compute probe, hybrid 044, REST integration or catalog scaling is selected: Declaration overhead and per-task costs provide no demonstrated winning category; they do not rule out gains on different workloads. The wrap-up recommendation is to pause until a concrete use case justifies a bounded test (including reuse under 047). Narrowing or stopping remains valid. Any future model run needs its own version, frozen matrix and spend cap; preserve v2/v3 with reused tasks as development material.

The broader hypothesis is uniform typed functions over remote services and local CLI/filesystem operations, backed by a programmable runtime—not GUI automation. See [043](../.work/issues/043-api-composition-computer-environment.md) and [044](../.work/issues/044-uniform-versus-hybrid.md). The missing structured error reports warrant care; do not assume the existing [038](../.work/issues/038-missing-typed-program-reports.md) diagnosis automatically applies to AppWorld.

## Verification and environment

October 1 repeat verification: `bun run check` passed; existing checking-policy tests passed **4/4, 49 assertions** before paid cells. No runtime changes or full-suite rerun. All 36 GLM cells completed with usage, no infrastructure replacements, and no limit stops; wrap-up checked documentation and frozen-source integrity.

Latest bounded-pilot verification (macOS/Bun 1.4.0-canary.1, 2026-09-30): `bun run check` passed; focused new checking-policy, production QuickJS-runtime and actual-entry parity tests **30 pass / 0 fail / 165 assertions**. The environment baseline before adding new tests was **168 pass / 28 fail**, 196 tests / 1367 assertions, mostly direct-Bun temporary-import failures plus unrelated BFCL/HTTP setup. [050](../.work/issues/050-macos-bun-baseline.md) owns that deferred work. This is not a green full suite or full updated-Pi compatibility certification; earlier Windows records below remain historical.

Wrap-up verification 2026-09-22, Windows/Bun 1.4.2: `bun run check` and `bun run demo` pass. Full suite with local subprocess access: **163 pass / 12 fail**, 175 tests, 1,292 assertions; failure names/classes match the documented Windows baseline. Initial sandbox restrictions caused additional subprocess failures. See [verification details](wrap-up.md#verification). No live model campaign or current Linux rerun was performed.

The available AppWorld venv is `.work/appworld/venv-win` (Python 3.14.7, pinned upstream source, MCP 2.2.0). Set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`, pass the Windows interpreter explicitly, and use the matching per-app allow-manifest. Do not use the dead Linux venv or reintroduce the v1 stale-allowlist bug.

Synthetic audit reproduction: `bun .work/pi-agent/review-20260919/verify-entry.ts` (local diagnostic). The durable regression is committed: `test/integration/pi-entry-parity.test.ts` over the real-entry probe server `test/fixture-mcp/datetime-server.ts` (045, green).

## Spend and artifact discipline

October 1 GLM repeat: estimated $0.01813044 over 76 requests. Combined with September 30 Muse Spark: **$0.042328382**, separate from the historical approximately $1.21 program estimate. No new model or follow-up trial selected. GLM low versus Muse Spark medium, cache/routing differences and catalog-based prices limit efficiency comparisons; neither estimate is reconciled billing.

September 30 batch: the user separately authorized up to €5 and asked to keep cost controls simple. The 36 completed Muse Spark cells used $0.024197942 in estimated token-rate cost, with complete usage and no other models. This is separate from the historical approximately $1.21 below and is not a reconciled provider bill. No further run is selected.

Three Pi worker sessions for the 045 review cost **$0.031921796** total (18 + 18 + 12 requests); cumulative at that point ≈ **$0.84192** (unreconciled). 046 v3 added $0.3649 (calibration $0.0156 + 36 cells $0.3493), giving cumulative ≈ **$1.21** of the €5 authorization with ~€3.8 headroom. No benchmark cells ran in this check. The combined local ledger is `.work/pi-agent/review-20260919/combined-ledger.json`.

The historical €5 cumulative ceiling covered that earlier program, including worker sessions; its per-session caps did not reset it. September 30 had the separate batch authorization recorded above. No new campaign is selected. Never print credentials or commit raw transcripts, task answers, databases or generated datasets. Do not open ground truth or task databases to solve tasks. Track only sanitized records and authorized code.
