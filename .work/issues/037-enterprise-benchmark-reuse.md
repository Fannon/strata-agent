# 037 — Reuse an enterprise tool benchmark before building our own

Status: selected/in progress; controller/replay and BFCL diagnostic delivered, AppWorld response compatibility partial; matched comparison not delivered (reviewed 2026-09-16)
Dependencies: 035 enterprise hypothesis; 025 lifecycle and 029 discovery fixes; 009 evidence protocol

## Decision

The user selected the recommended sequence on September 14 and explicitly authorized repository contents being sent to OpenRouter and Pi project edits. Use `meta/muse-spark-1.3-contributor`, medium reasoning, under supervisor review. Start with offline compatibility; a matched pilot follows a trustworthy state-graded replay, then a separately labeled catalog-size experiment. Initial Pi implementation session is bounded at 40 requests/$5 conservative reservations; this is development spend, not benchmark evidence. Raw delegation prompts/receipts stay in ignored `.work/pi-agent/2026-09-14/`.

Prefer an AppWorld feasibility spike for realistic cross-application composition. Use BFCL as a separate invocation/relevance diagnostic. See [primary-source comparison](../../docs/research/tool-catalog-benchmarks.md). Neither alone establishes that Strata scales to thousands of dynamically authorized operations. Reusing existing APIs and state graders is more valuable than inventing a benchmark designed around our strengths.

## Bounded next implementation

Current evidence: [AppWorld](../../docs/appworld-spike.md) records a 98-operation inspection, two-call handwritten replay, save and upstream grading (task incomplete), followed by an unsuccessful development model run with date-time validation failures. [BFCL](../../docs/bfcl-diagnostic.md) records 30/30 corrected call verdicts, with guard-stopped sessions reported separately. Neither is a comparative win. [040](040-appworld-datetime-compatibility.md) tracks the compatibility decision before a matched pilot. The checklist below separates completed smoke mechanics from remaining acceptance work.

- [x] Record AppWorld revision and package/data versions (see spike report).
- [ ] Verify the available environment matches those pins and record relevant code/data/bundle terms. Keep downloaded bundles, credentials, generated schema derivatives and task solutions local unless redistribution rights are confirmed.
- [x] Start a disposable task world, inspect 98 operations, connect through existing stdio MCP, replay calls, save and invoke upstream grading. Response compatibility remains partial (040); successful declaration generation alone is insufficient.
- [ ] Resolve 040, then solve one development task with a handwritten typed program using public task/tool information. Save and evaluate with the upstream grader, then repeat from a fresh world. Keep grader/answers unavailable to the program and report all failures. The earlier two-call smoke did not satisfy task completion.
- [ ] Hand off matched direct-tool preparation and the frozen pilot proposal to [042](042-matched-application-comparison.md), which owns parity, measures and decision rules.

## Next worker scope: offline feasibility

Use an existing Linux/WSL environment if available and verify it with fresh checks. Windows support (041) is separate unless it blocks the only available environment; classify the blocker rather than starting a broad port. If the pinned environment or protected bundles are unavailable, record the setup requirements and continue independent synthetic reproduction work.

Deliver exact reproduction commands, versions, schema disposition, first and reset-run grader aggregates, remaining gaps and a go/no-go for 042. A no-go must identify the smallest actionable next step. This assignment needs no external model calls, prompt tuning, REST transport or catalog expansion.

## Measurements and falsification

Measure state-graded success, unauthorized effects, missing-tool abstention, discovery recall/rank, loaded versus total schema bytes, model requests, tool calls, broker/API calls, tokens/cache/cost, wall time and repairs. Include mapping/setup/maintenance effort. Typed code can lose on simple calls or expensive repair loops; fewer model tool calls is not sufficient evidence of value.

A separate controlled extension varies distractor catalog size (100/1,000/10,000 descriptors) while keeping executable task operations constant. Both arms get identical discovery. Report retrieval scaling separately from composition and distinguish metadata-only distractors from real integrations. Separately inject permission revocation and schema changes between discovery/load/call, measuring denied effects and recovery. Do not call static allowlist filtering dynamic authorization support.

Acceptance for the remaining spike: a task-solving offline trace repeated from reset, schema/transport/terms gap report, and a go/no-go for matched preparation. If blocked, retain a failing reproduction and next decision without marking feasibility complete. No general enterprise platform, universal OpenAPI importer or live benchmark spend is required.
