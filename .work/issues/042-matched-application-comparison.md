# 042 — Compare typed composition with equally capable direct tools

Status: v2 executed 36/36 cells (numbers preserved below); 2026-09-19 review: negative OBSERVED result with confirmed validation-policy confound — NOT a healthy matched comparison; no confirmation follows; 045 delivered 2026-09-19
Dependencies: 037 completed task-solving replay; 040 compatibility disposition; verified execution environment

## Question

On application tasks requiring several related calls, does checked TypeScript composition improve task completion, cost or latency relative to direct tools with the same discovery and access? Simple calls and server-side aggregation are controls where composition may add little. This tests the combined typed-program interface, not the isolated causal effect of typechecking.

## 2026-09-19 review note (supersedes "healthy negative" conclusion; preserves all recorded numerical outcomes)

No regrade or rerun. Pilot v2 measured typed strict 9/18 ($0.261013 total, $0.0290014/success) and direct 15/18 ($0.103518 total, $0.0069012/success) — unchanged. This review found a real mismatch: `src/pi/extension.ts` `sessionFromConfig` MCP branch destructures id/command/args/allow, creates the session with {executor, declarations}, and IGNORES `config.compat.acceptNaiveDateTime`; `src/pi/direct-tools.ts` reads that setting and uses it for output validation. `paid_driver.py` sets compat for both. Existing offline parity tests compare broker/direct replay, not actual Pi entry points. Supervisor synthetic repro (`.work/pi-agent/review-20260919/verify-entry.ts`, mock MCP response `{at:'2020-01-01T00:00:00'}` with actual `sessionFromConfig` and compat true): typed outcome error/failure output while the actual registered direct tool succeeds on the same mock response; the default strict validator rejects. NO runtime fix applied.

Thus v2 is a negative observed result with a confirmed validation-policy confound, not a healthy matched comparison. This is not proof typed composition would win after fixing it; all failures and the success gap cannot be attributed solely to the mismatch. Prior offline/manual-replay compatibility fix is delivered but not wired through the typed model path. Metrics/evidence limits: typed tool_execution_end 191 total (144 with structured metrics, all outcome ok; 47 without); visible 2198 backend invocations, 2199 call attempts, 442 validation failures (441 output, 1 input). Zero traceDropped does not establish completeness. Direct 256 recorded attempts include 13 input failures not invoked (the records lack an explicit invocation flag; do not label all 256 as backend invocations). Programs can catch failures without successful recovery; the counters alone do not establish the cause of the extra work. Zero destructive-hint direct records and zero visible typed policyFailures do not prove no unauthorized effects (metadata/grant checks only, not task-intent audit). Pilot preloaded per-app sets 54/81/98, not all 98; no lazy discovery. Baseline shell/files vs typed strict remains a difference; no per-cell latency measurement. Review spend: $0.007880732 + $0.014327204 + $0.009713860 = $0.031921796, all paid worker sessions; prior reported cumulative approximately $0.81. No new benchmark cells.

Next: 045 delivered the real-entry regression and compat fix (parity demonstrated offline); any new comparison still needs a separately proposed versioned bounded run (frozen tasks/settings/caps), keeping v2 unchanged with reused tasks development-only.

## Offline deliverables (historical; gate 3 now partial — see review note above)

Feasibility gate status 2026-09-16: **GO for gate-3 offline preparation** (gates 0-2 delivered: Windows platform venv verified with byte-identical 98-op manifest, 040 adaptation live-verified with 0 validation failures, dev task solved twice from reset with 2/0 grading). This go covers offline parity work only — direct-tool arm, deterministic parity checks, dry-run matrix and spend proposal. A paid pilot (gate 4) still needs a frozen matrix and spend-cap approval and is not authorized by this recommendation.

Parity facts the offline work can reuse: the 040 output-compatibility policy (`accept-naive-date-time`, outputs only, strict global default) is implemented as a broker/session option and recorded in every replay `summary.json` — apply the identical setting in both arms. Operation metadata, reset/save/grade path (controller + `world.save()` + `world.evaluate()` aggregates) and the 98-name allowlist are shared as-is. Known inspected task `82e2fac_1` stays regression-only; the pilot needs uninspected tasks.

1. Implement a bounded benchmark-local direct-tool arm over the same MCP operations. Share operation metadata, search/load results, grants, input/output validation (including any explicit compatibility adaptation), reset state and upstream grader with the typed arm. Direct calls must not bypass validation that can reject typed results.
2. Make discovery parity real. The production catalog currently supports CLI-twin entries, not arbitrary MCP catalogs. Use the smallest experiment-local shared discovery/load surface; do not build a general enterprise catalog. If that is not feasible, propose a clearly labeled identical-preloaded comparison and its limits before spending; never call preloading lazy discovery.
3. Keep pure computation available in both arms. Predeclare whether the direct arm may use ordinary scripts and how those scripts access data. Match reachable backend operations and external restrictions, document unavoidable differences, and do not manufacture a benefit by removing ordinary baseline abilities. Use default QuickJS for the typed arm initially; do not mix executor or declaration tuning into this comparison.
4. Add deterministic checks for matching tool visibility/results, reset and save behavior, deliberate invalid outputs, forbidden-effect accounting, incomplete runs, missing usage and budget refusal. Treat success, policy and harness health as separate fields. Confirm whether any reused grading path inherits 038.
5. Produce a dry-run matrix and a concise parity table. Record task/model/runtime/schema versions and adaptation provenance. Keep raw requests, protected data and task solutions local; commit only permitted sanitized summaries and reproducible harness code.

## Gate-3 offline report (2026-09-16, no model calls)

Direct reference arm delivered: `examples/appworld/direct.ts` connects to
the same MCP server (identical `listTools` discovery), validates with the
same factory + shared 040 setting, and records the same failure
categories without bypasses. Core (`runDirectCalls` + `$call`/`$path` +
`$select` runtime wiring) is unit-covered. Controller gained
`--direct-script` mode reusing the save/grade path; both arms record the
040 policy in `summary.json`. Committed parity tests
(`test/integration/appworld-parity.test.ts`): 4 pass — validation-matrix
agreement, allowlist denial without invocation, ref wiring.

Live parity (fresh worlds, dev task `82e2fac_1`, local artifacts
`out-direct-prefixA` / `out-typed-prefixB` / `out-direct-probe` /
`out-direct-neg`):

| Check | Typed arm | Direct arm | Agreement |
| --- | --- | --- | --- |
| Manifest (discovery output) | 98 ops | 98 ops | byte-identical |
| Output-compat policy | accept-naive-date-time | accept-naive-date-time | identical summaries |
| Read prefix (profile→passwords→login→library) | ok | 4/4 ok | — |
| Library rows across fresh worlds | 8 rows | 8 rows | identical ids/titles/likes/song_ids |
| Naive datetimes live | accepted, 0 failures | accepted, 0 failures | — |
| Invalid input live | (unit: input-fail) | input-fail, not invoked | zero-effect both |
| Allowlist denial | policy-fail, not invoked (unit) | policy-fail, not invoked (unit) | — |
| isError/throw | transport (unit) | transport (unit) | — |

Discovery decision: **labeled identical-preloaded comparison**. The
production catalog only indexes cli-twin entries; wiring arbitrary MCP
catalogs into it would be the general enterprise catalog, explicitly out
of scope. Both arms share the live `listTools` manifest + full 98-name
allowlist; lazy-discovery cost is excluded from the pilot and stays with
035. Computation predeclare for the pilot: typed arm composes in-program;
direct arm gets the same 98 MCP operations as individual tools and may
use ordinary Pi scripting (stock Pi abilities preserved per 043/044) —
script data access and any delta from typed-arm sandboxing to be logged
as an explicit remaining difference. 038 does not carry over: grading is
upstream `evaluate()`, not the repository evaluator.

## Historical pilot v2 report (2026-09-16; interpretation superseded by review above)

The original narrative below is retained for audit. Its outcome/cost counts remain observations; its healthy-comparison, backend-call equivalence and unauthorized-effect conclusions must be read with the corrections above. The pilot ran 36 cells for approximately $0.36; reported cumulative program spend at that point was approximately $0.81.

v1 ($0.41) is superseded: it ran gmail/amazon cells under a stale
supervisor+spotify allowlist (zero backend calls possible there). v2
pins a per-app-set manifest per cell (gmail 54, amazon 81, spotify 98
ops). Raw cells local under `.work/appworld/pilot-v2/`; ledger +
`pilot-summary.json` retained.

Strict success = completed AND zero grader failures (controller run
rule); completed-only reported secondarily. One model
(`meta/muse-spark-1.3-contributor`, medium), 40-request cells, seeded
order, fresh world per cell:

| Arm | Strict /18 | Completed /18 | Cost | Cost/strict |
| --- | --- | --- | --- | --- |
| typed | 9 | 10 | $0.2610 | $0.0290 |
| direct | 15 | 15 | $0.1035 | $0.0069 |

Paired strict wins by task (typed–direct): `4ec8de5_1` 0–1, `9bf2c8a_2`
3–3, `ccb4494_1` 3–3, `e85d92a_1` 0–3, `eb5ad85_2` 0–2, `f691597_1`
3–3. Direct never worse; wins two tasks outright. Effort: provider
requests tied (214 vs 212); backend calls diverge — typed ≈122/cell
(2198 total, 442 validation failures absorbed inside ok-programs,
0 policy) vs direct ≈14/cell (256 total): the repair-loop overhead.
Guard stops: typed 8, direct 3. Unauthorized effects: none in either
arm on question tasks (zero destructive-hint calls). Harness health:
no transport crashes; one pilot-harness bug found and fixed mid-course
(v1 allowlist, above). Latency not measured per cell (requests proxy
only) — limitation.

Against the predeclared screening rule (typed completion no lower,
≥15% lower cost/success or latency, no worse effects): typed fails
bars 1 and 2. **Verdict: healthy negative for the typed hypothesis on
this pilot.** No confirmation under 009 follows; any follow-up (new
task family, hybrid arm under 044) needs its own justification and is
not selected here. v1's direction agreed (direct 6 vs typed 3 strict)
but is not evidence (broken tool universe).

Superseded proposal text (kept for audit; executed as v2 above):

Starting proposal: six development tasks, two per category (single-call/simple control, dependent read/aggregation, state-changing workflow), two arms, three fresh-world repetitions: 36 cells. Use only tasks not already inspected for answers; the known inspected smoke task stays regression-only. If the upstream corpus cannot supply a category, document the actual coverage instead of inventing official tasks. Confirmatory tasks remain untouched and separate.

Freeze exact task IDs, order/counterbalancing, model/provider/reasoning, prompts, executor, declarations, discovery rules, per-cell time/request/token caps and total cost reservation. Compute a concrete spend proposal from current model metadata; old development budgets are not automatically the pilot budget. Both arms use the same retry policy; retain all attempts.

Spend proposal (2026-09-16 OpenRouter metadata,
`meta/muse-spark-1.3-contributor`, medium reasoning): prompt $1e-7,
completion $2e-7 per token. Calibrated on the Sept-14 dev run actuals
(~361K in + ~39K out over 40 requests ≈ $0.044, i.e. ~$0.0011/request):
36 cells x 40-request cap ≈ 1440 requests worst case ≈ **~$1.60 at
measured rates**, inside the authorized 5€ total with headroom for
repeats. Enforce per-cell 40-request cap, hard stop at $5 cumulative
(key-delta reconciled), same retry policy both arms. Task IDs frozen at
pilot time by seeded sampling across the three categories (specs only;
ground truth/DBs sealed; inspected tasks excluded).

**Auth and execution (2026-09-16 update): user-authorized ≤5€ spend;
Pi auth resolved via stored `sk-or-` key injected as `OPENROUTER_API_KEY`
by a local wrapper (never persisted). v2 ran 36/36 for $0.36
(cumulative session ≈ $0.81). Results under "Pilot v2 results" above;
the blocker below is resolved.**

**Pilot blocker (2026-09-16): no model credentials in this environment**
(no `OPENROUTER_*` key, no Pi model config), so no paid cell can run
until the user provides them. Offline gate 3 is complete; the paid pilot
is the next action once credentials exist.

## Frozen pilot matrix v1 (seed `042-pilot-order-v1`, 36 cells)

Auth resolved 2026-09-16 (Pi `auth.json` holds an `sk-or-` key for
openrouter; injected as `OPENROUTER_API_KEY` via local wrapper, never
persisted). Model `meta/muse-spark-1.3-contributor`, `--thinking medium`
per user direction. Smoke cells (15-req cap, dev task `f691597_1`):
typed completed=true 1/1 ($0.0109), direct completed=false 1/1
($0.0149) — direct wandered in shell, so its prompt now carries the op
inventory (names only; same preloaded discovery as typed). Measured
~$0.011-0.015/15-req cell → 40-req cells ≈ $0.03-0.04 → 36 cells ≈
$1.10-1.45, inside 5€ with per-cell 40-req caps and a cumulative $5
stop from measured usage (`pilot.py` ledger).

Tasks (specs/instructions read for categorization only;
ground_truth/DBs sealed; inspected `82e2fac` excluded):

| Category | Task | Apps |
| --- | --- | --- |
| single | `f691597_1` (read gmail threads count) | supervisor,gmail |
| single | `e85d92a_1` (most-played song by artist) | supervisor,spotify |
| aggregation | `eb5ad85_2` (amazon spend last month) | supervisor,amazon |
| aggregation | `4ec8de5_1` (songs released this/last year) | supervisor,spotify |
| workflow | `9bf2c8a_2` (wishlist to cart) | supervisor,amazon |
| workflow | `ccb4494_1` (like queue songs) | supervisor,spotify |

Design deltas from the proposal: direct arm keeps stock Pi
shell/file tools (the capable baseline per 043/044) + one Pi tool per
MCP op with identical validation; typed arm stays `STRATA_STRICT=1`.
Asymmetry is logged, not hidden. Primary measures per 042 decision
rule; cost-per-success undefined (not zero) if an arm has zero
successes.

Primary measures: upstream task completion, total estimated cost divided by successful completions (including failed work), and end-to-end latency. Also record unauthorized effects, harness failures, tool/model/backend calls, declaration/discovery/program/result tokens where available, and integration effort. Zero successes means cost per success is undefined, not zero. Correct recorded calls are not completed tasks.

## Decision rule

Before the pilot, freeze a development screening rule. Suggested starting rule: typed completion is no lower in observed counts, with at least 15% lower total cost per success or median latency, and no worse observed unauthorized-effect count. Report paired task results and tails; a small pilot cannot establish equivalence or general superiority. A signal limited to composition tasks supports narrowing, not a universal claim.

- Positive, healthy signal: design untouched confirmation under 009; use pilot variance to select its size.
- Useful only in one task category: narrow the hypothesis and confirm that category.
- Harness/contract faults: repair deterministically and version the next experiment; preserve the original results.
- Healthy negative/inconclusive result: report it and decide whether to stop or select one justified follow-up. Do not automatically add transports, memory or tuning rounds.

Acceptance for offline preparation: reproducible arm-parity checks, an executable no-spend dry run, explicit remaining differences, and a reviewable matrix/budget proposal. Paid pilot acceptance is a separate report, not a requirement to finish the offline worker assignment.
