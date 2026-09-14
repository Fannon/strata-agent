# Strata issue board

Reviewed 2026-09-14 from `4e04e94`, including the September 13 confirmation and newly selected AppWorld sequence. This board owns next-work ordering; [handoff](../../docs/handoff.md) owns the concise implementation handoff, [trial report](../../docs/repo-trials.md) owns evidence, [ACD](../../ACD.md) owns architectural direction. Issue Markdown is tracked; raw `.work/` artifacts and local notes remain ignored.

## Decision and verification

The typed capability layer is enduring; both engines and the useful read-only API are implemented. Four trial stages show no demonstrated task-level advantage: typed profiles use fewer Pi calls but more context/cost. 004 attribution and compact development testing are delivered: compact reduced cost/success 26.4% against full declarations at 12/12 success in both arms. The September 13 R-CALL confirmation failed its cost threshold (compact 2/4 overall successes, full 3/4, stock 4/4); compact stays opt-in. Typed final answers were correct, with one policy failure and two harness failures. 025 shutdown ownership, 029 policy-aware discovery and 009 fixture fingerprints are delivered. Path-prefix close-out and 026/027/031 are delivered; do not repeat them. Engine equivalence, declaration causality and aggregation superiority are not established.

Baseline verification on 2026-09-14 at `875dccc`: `bun run check` passed; `bun test` passed **178 tests / 0 failures / 1399 assertions** with permitted local subprocess/loopback access. This precedes AppWorld code delivery and made no benchmark model calls.

Historical verification at `807562a`: `bun run check` passed; `bun test` passed **148 tests / 0 failures / 1169 assertions** with local subprocess/loopback access. The restricted first run failed fixture/server startup; the permitted rerun passed. No new model calls. Historical test counts in delivery records refer to their revisions.

On September 14 the user selected documentation reconciliation and the recommended enterprise sequence: AppWorld offline compatibility, matched lazy-direct versus typed pilot, separate catalog scaling, then confirmation only after a positive signal. Most work is delegated to Pi through OpenRouter with `meta/muse-spark-1.3-contributor`, medium reasoning; the supervisor scopes tasks, reviews changes and verifies results. The user explicitly permits sending this repository's contents to OpenRouter and allowing Pi to modify project files. Keep credentials and unrelated private material out of model context. Initial coding sessions each have 40-request/$5 conservative reservation limits; benchmark calls require a frozen matrix and spend cap after feasibility review. Record assumptions and results without erasing historical artifacts. Do not turn policy flags into answer failures or claim a clean heuristic audit proves containment.

## Recommended next work

| Issue | Current status |
| --- | --- |
| [037 — Reuse enterprise tool benchmarks](037-enterprise-benchmark-reuse.md) | selected/in progress: Pi implementing offline AppWorld compatibility; matched pilot and catalog scaling follow feasibility review |
| [038 — Diagnose missing typed-program reports](038-missing-typed-program-reports.md) | recorded prerequisite before reusing affected repository evaluation path; no regrading or new model runs |
| [039 — Typed REST operations via client generation](039-typed-rest-operations.md) | idea only (user requirement 2026-09-14): MCP/REST as the only typed transports; evaluate client-generation libraries before building; no implementation authorized |
| [004 — Attribute and reduce typed-context cost](004-harness-tuning.md) | A/B delivered; slice C confirmation on fresh R-CALL family ran 2026-09-13: negative/inconclusive (compact 2/4 vs full 3/4, $0.0037 vs $0.0032/success) — compact stays opt-in, no change |
| [009 — Baseline hardening: variance, warm sessions, wider tasks](009-baseline-hardening.md) | fixture hardening, repo-2 trials and reproducibility fingerprints delivered; evidence-quality follow-ups remain open; 004 confirmation ran and was negative/inconclusive |

## Completed mechanisms and trial slices

| Issue | Current status |
| --- | --- |
| [001 — Benchmark stock Pi against typed capability composition](001-benchmark.md) | done (2026-09-05: protocol v1 + runner `529e431` + 9/12 baseline; follow-ups in 009) |
| [002 — One typed CLI capability for the benchmark](002-typed-cli.md) | done (2026-09-05, commits e64e313 + 1d7236e) |
| [003 — Research dynamic tool discovery and dependencies](003-tool-discovery.md) | done (2026-09-05; research + spike + production wiring) |
| [006 — Docs/DX polish and repo hygiene](006-docs-hygiene.md) | done (2026-09-05) |
| [008 — Benchmark backend spike: deterministic CLI twin selected](008-second-fixture.md) | done (2026-09-05, commit e64e313) |
| [010 — Reconcile concept, ACD, research and roadmap](010-concept-and-roadmap.md) | done (2026-09-05) |
| [011 — Typed repository orientation without model-authored shell](011-native-repository-capabilities.md) | read-only usability slice delivered; further coverage conditional (reviewed 2026-09-06) |
| [016 — Restore Pi execute-signal forwarding](016-pi-cancellation.md) | done (2026-09-05; verified `4875c8c`→HEAD) |
| [020 — Initial implementation sequence (completed)](020-next-sequence.md) | done; superseded for next-work ordering by index and 004 (2026-09-06) |
| [022 — `@c/` import alias for capability modules](022-import-alias.md) | done; both @c/ and @cap/ supported |
| [026 — Correlated capability diagnostics and performance traces](026-observability.md) | minimal slice delivered and measured with 027; context attribution remains under 004 |
| [027 — Replaceable executor and direct Bun comparison](027-permission-aware-runtime-alternatives.md) | delivered; deterministic comparison and four repository model-trial stages complete, broader generalization unproven |
| [028 — Discriminating repository workflows with trustworthy evaluation](028-harder-repository-tasks.md) | corpus, runner hardening, dev/held-out/wave-2/path-closeout trials delivered; next inference follows 004 (reviewed 2026-09-06) |
| [031 — Quiet success, loud error, on-demand details](031-quiet-success.md) | done (implemented 2026-09-06; 130 pass / 0 fail) |

## Coverage, robustness and optional follow-ups

| Issue | Current status |
| --- | --- |
| [005 — Revisit resource limits before broader or hostile-input workloads](005-runtime-limits.md) | backlog |
| [007 — Bounded report loop and pre-delivery size caps](007-report-bounds.md) | backlog |
| [012 — Authorize concrete effects and filesystem resources](012-scoped-permissions.md) | Phase A best-effort repository reads delivered; interactive/stronger grants remain backlog |
| [013 — Learn composable operations from local agent sessions](013-session-capability-study.md) | optional bounded study ready; preliminary counts recorded in 033, reproducible workflow study not delivered |
| [023 — Reuse TypeScript libraries behind capabilities](023-library-backed-capabilities.md) | backlog |
| [024 — Filesystem and search library candidates](024-filesystem-search-library-candidates.md) | decided for path discovery (Bun.Glob selected, no new dependency); content-search adapter still open |
| [025 — Catalog load vs session shutdown race](025-load-shutdown-race.md) | done 2026-09-13; shutdown/cancellation guards, explicit ownership, idempotent cleanup |
| [029 — Policy-aware capability search](029-policy-aware-search.md) | done 2026-09-13 (policy-scoped search/load, fail-closed, integration tests) |
| [032 — From task-first slices to solid coverage](032-coverage-track.md) | backlog, plan only (no implementation authorized) |
| [033 — Mine local agentsview sessions for coverage needs](033-agentsview-mining.md) | backlog, suggested (read-only inspection done 2026-09-06, no transcripts copied) |
| [034 — Operator-configurable caps for result, logs, and tool text](034-configurable-caps.md) | deferred pending measured cap failures or operator requirement; follows 031 |
| [036 — Prompt-wording ablation for typed instructions](036-prompt-ablation.md) | backlog, idea only; repair done, optimization needs isolated control |

## Enterprise-fit hypothesis

[035 — Enterprise discovery and typed composition](035-enterprise-capability-scaling.md) captures a potentially different use case: large dynamic API catalogs with small discovered working sets. It remains an unproven hypothesis and does not overturn 004's negative/inconclusive confirmation. [037 — Reuse enterprise tool benchmarks](037-enterprise-benchmark-reuse.md) is now selected for implementation, starting with an AppWorld offline compatibility spike, with BFCL as a complementary diagnostic. Compare with equally lazy direct tools and test schema changes/revocation separately from task efficiency.

## Deferred experiments

| Issue | Current status |
| --- | --- |
| [014 — Compare Prime/IPython and Strata fairly](014-prime-comparison.md) | backlog for implementation; initial primary-source research complete |
| [015 — Editing, project checks and optional shell fallback](015-edits-checks-fallback.md) | backlog |
| [017 — Dependencies, related tools and supersession](017-capability-relationships.md) | deferred |
| [018 — Sandbox the bash escape hatch (prime-agent pattern)](018-sandbox-bash.md) | backlog |
| [019 — Harness-state snapshots and rollback for catalog loads](019-harness-snapshots.md) | deferred (until wrong-load/restart costs justify it) |
| [021 — Cloudflare Code Mode prior art and semantic-checking ablation](021-code-mode-checking.md) | backlog for experiment; primary-source relationship research complete |
| [030 — Optional agent memory outside typed runs](030-optional-memory.md) | backlog, idea only (do not implement with current slices) |

## Scope rules

- Native Bun first; mature argv/library adapters when justified. No universal Unix replacement or subprocess-free mandate.
- Keep semantic checking, runtime validation, operation/resource policy and execution containment distinct. Bun ambient calls can bypass capability checks and traces.
- Default QuickJS, opt-in Bun; freeze one executor for the next presentation ablation.
- 013 owns bounded session research; 033 is its data-source work, 032 owns promotion decisions. Counts are observational and require reproducible classification.
- 034 caps remain conditional on measured failures; 025 load/shutdown robustness should accompany real dynamic-loading work. Neither requires broad infrastructure expansion.
- New work must have a caller need or an explicitly labeled experiment. Negative and inconclusive outcomes are useful project results.
