# 037 — Reuse an enterprise tool benchmark before building our own

Status: manual feasibility delivered; 042 pilot executed with negative observed results; actual Pi validation mismatch confirmed in the 2026-09-19 review, next proposed work under 045
Dependencies: 035 enterprise hypothesis; 025 lifecycle and 029 discovery fixes; 009 evidence protocol

## Decision

The user selected the recommended sequence on September 14 and explicitly authorized repository contents being sent to OpenRouter and Pi project edits. Use `meta/muse-spark-1.3-contributor`, medium reasoning, under supervisor review. Start with offline compatibility; a matched pilot follows a trustworthy state-graded replay, then a separately labeled catalog-size experiment. Initial Pi implementation session is bounded at 40 requests/$5 conservative reservations; this is development spend, not benchmark evidence. Raw delegation prompts/receipts stay in ignored `.work/pi-agent/2026-09-14/`.

Prefer an AppWorld feasibility spike for realistic cross-application composition. Use BFCL as a separate invocation/relevance diagnostic. See [primary-source comparison](../../docs/research/tool-catalog-benchmarks.md). Neither alone establishes that Strata scales to thousands of dynamically authorized operations. Reusing existing APIs and state graders is more valuable than inventing a benchmark designed around our strengths.

## Bounded next implementation

Current ordering is in the index: gates 0–2 are complete, 042 ran, and [045](045-pilot-entrypoint-validation-parity.md) is the proposed offline parity repair. The original sequence below is historical; it does not authorize another campaign or require repeating completed manual replay work. The cumulative €5 program ceiling supersedes historical per-session reservation examples.

Current evidence: [AppWorld](../../docs/appworld-spike.md) records a 98-operation inspection, two-call handwritten replay, save and upstream grading (task incomplete), followed by an unsuccessful development model run with date-time validation failures. [BFCL](../../docs/bfcl-diagnostic.md) records 30/30 corrected call verdicts, with guard-stopped sessions reported separately. Neither is a comparative win. [040](040-appworld-datetime-compatibility.md) tracks the compatibility decision before a matched pilot. The checklist below separates completed smoke mechanics from remaining acceptance work.

- [x] Record AppWorld revision and package/data versions (see spike report).
- [x] Verify the available environment matches those pins and record relevant code/data/bundle terms. Downloaded bundles, credentials, generated schema derivatives and task solutions stay local. Platform note: no WSL/Linux existed, so a Windows platform venv was built (Python 3.14.7, pinned upstream source + `mcp==2.2.0`, `PYTHONUTF8=1` for upstream console output); manifest from the Windows inspect is byte-identical to the pinned Linux one (98 ops). Original `venv` (Linux) untouched.
- [x] Start a disposable task world, inspect 98 operations, connect through existing stdio MCP, replay calls, save and invoke upstream grading. 040 resolved AND live-verified (0 validation failures over live naive responses); declaration generation plus runtime acceptance both hold.
- [x] Resolve 040, then solve one development task with a handwritten typed program using public task/tool information. `.work/appworld/solve-82e2fac-1.ts` (local, dev-only; runtime credential discovery, no hardcoded secrets, no grader access): first run completed=true, 2 passes / 0 failures; reset repeat identical (answer "A Love That Never Was", likeCount 18, 8 playlists / 57 songs / 70 calls, ~0.4 s compile + ~3.4 s exec, 101 KB raw reduced to 189 bytes). Save and upstream grading in both runs; all failures reported (none). The earlier two-call smoke did not satisfy task completion; this does.
- [ ] Hand off matched direct-tool preparation and the frozen pilot proposal to [042](042-matched-application-comparison.md), which owns parity, measures and decision rules.

## Next worker scope: offline feasibility (gates 0-2, in progress 2026-09-16)

Gate 0 (environment): Windows/Bun 1.4.2 + Python 3.14, no WSL distros, no
Docker; `.work/appworld/venv` is a Linux venv and cannot execute here.
`bun run check` passes. `bun test` reproduces the board baseline exactly
(67 pass / 95 fail) plus the new 040 file: now 71 pass / 1 env-gated skip
/ 95 fail across 167 tests — failures are the known 041 classes (POSIX
supervision, compiler stdlib-path rejection), no regressions from the 040
change. A Windows AppWorld install (`.work/appworld/venv-win`, Python
3.14, pinned local source) is downloading dependencies; if it completes,
gates 1-replay/2 run natively, else they await a Linux runtime.

Gate 2 (handwritten solver): `.work/appworld/solve-82e2fac-1.ts` (local,
dev-only) solves the inspected development task from public instruction +
pinned schemas only — runtime credential discovery via supervisor profile
+ account-passwords APIs, login, full library pagination, per-song
like_count max with deterministic tie-break, `complete_task` submit.
Statically cross-checked against the pinned manifest (all 7 calls match
names + required inputs; `.work/appworld/check-solver.ts`). Compile +
grade pending runtime (Windows compiler-stdlib bug blocks local compile;
program is written to the same constraints as the verified dev-smoke).

Use an existing Linux/WSL environment if available and verify it with fresh checks. Windows support (041) is separate unless it blocks the only available environment; classify the blocker rather than starting a broad port. If the pinned environment or protected bundles are unavailable, record the setup requirements and continue independent synthetic reproduction work.

Deliver exact reproduction commands, versions, schema disposition, first and reset-run grader aggregates, remaining gaps and a go/no-go for 042. A no-go must identify the smallest actionable next step. This assignment needs no external model calls, prompt tuning, REST transport or catalog expansion.

## Measurements and falsification

Measure state-graded success, unauthorized effects, missing-tool abstention, discovery recall/rank, loaded versus total schema bytes, model requests, tool calls, broker/API calls, tokens/cache/cost, wall time and repairs. Include mapping/setup/maintenance effort. Typed code can lose on simple calls or expensive repair loops; fewer model tool calls is not sufficient evidence of value.

A separate controlled extension varies distractor catalog size (100/1,000/10,000 descriptors) while keeping executable task operations constant. Both arms get identical discovery. Report retrieval scaling separately from composition and distinguish metadata-only distractors from real integrations. Separately inject permission revocation and schema changes between discovery/load/call, measuring denied effects and recovery. Do not call static allowlist filtering dynamic authorization support.

Acceptance for the remaining spike: a task-solving offline trace repeated from reset, schema/transport/terms gap report, and a go/no-go for matched preparation. If blocked, retain a failing reproduction and next decision without marking feasibility complete. No general enterprise platform, universal OpenAPI importer or live benchmark spend is required.
