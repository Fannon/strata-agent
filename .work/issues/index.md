# Strata issue board

Reviewed 2026-09-16 against `c5e0b7e`, including delivered AppWorld replay and BFCL diagnostic work. This board owns next-work ordering; [handoff](../../docs/handoff.md) owns the concise implementation handoff, [trial report](../../docs/repo-trials.md) owns repository evidence, and [AppWorld](../../docs/appworld-spike.md)/[BFCL](../../docs/bfcl-diagnostic.md) own enterprise diagnostic reports. [ACD](../../ACD.md) owns architectural direction. Issue Markdown is tracked; raw `.work/` artifacts and local notes remain ignored.

## Goal and evidence path

Find out whether giving an agent typed functions that it can compose into programs improves useful task completion compared with equally capable direct tools and ordinary scripts. Functions may represent local tools, MCP operations or REST calls; local computation and remote effects can share an interface without sharing an execution location. Demonstrating that this interface works is a feasibility result. Demonstrating that it earns its complexity requires a fair comparison.

The current priority is real application composition through the existing MCP path. Building every transport, a large catalog or a production sandbox is not a prerequisite. Success includes identifying a narrow useful setting or a supported negative result.

Architectural goal: every operation can be exposed as a typed function, including local CLI/filesystem actions. Counter-hypothesis: familiar Bash/Linux workflows may give ordinary agents an advantage over novel function interfaces. Keep that baseline capable; do not infer a training-familiarity cause from cost results alone. [043](043-api-composition-computer-environment.md) records this goal and risk without authorizing universal adapter work.

| Gate | Work and owner | Evidence required / next decision |
| --- | --- | --- |
| 0. Trust the environment | 037 preflight (delivered 2026-09-16); 041 only if Windows blocks the chosen environment | Windows platform venv verified: byte-identical 98-op manifest, inspect green, suite 155/12 after a one-line compiler-separator fix (041). Remaining 12 classified, no broad port. |
| 1. Trust the data contract | 040 (delivered 2026-09-16: boundary opt-in implemented + live-verified) | Strict default kept; naive outputs accepted verbatim with provenance; 0 validation failures over 2 x 70 live calls. Same policy required in both 042 arms. |
| 2. Complete a real task | 037 offline acceptance (delivered 2026-09-16) | Handwritten solver, dev task, save + upstream grading, repeated from reset: 2/0 twice. Proves feasibility, not model performance. |
| 3. Make comparison fair | 042, offline first | Both arms share task state, discovery, callable operations, validation and effect policy. Deterministic checks verify parity, grading and accounting; a dry-run plan freezes tasks, settings and a proposed spend cap. |
| 4. Measure value | 042, only after matrix/cap approval | A small paired development pilot compares task success, total cost per success, latency and unauthorized effects. Include simple controls and composition tasks; report harness failures separately. Decide continue, narrow, repair or stop. |
| 5. Test generalization | 009 / 035, separately selected | Confirm a positive signal on untouched tasks before broader claims. Catalog-size, contract-change and revocation experiments remain distinct from composition; a second model tests portability. |

Next worker assignment: gate 3 (042 offline parity + dry-run matrix/cap proposal). Gates 0–2 delivered 2026-09-16 (see verification entry below). Gate 4 is not authorized merely by this roadmap.

038 matters only if the affected repository evaluator is reused. 039 is a transport hypothesis, not a dependency of the MCP comparison. 041 is an environment-dependent support track. Backlog ideas are not an implementation queue.

## Decision and verification

Current review (2026-09-16, `c5e0b7e`, Windows/Bun 1.4.2): `bun run check` passed; `bun test` failed with **67 pass / 95 fail / 743 assertions**, 162 tests across 25 files. Observed failures include POSIX-only supervision and compiler standard-library path rejection despite the file being present. [041](041-windows-verification.md) records diagnosis/support work; historical Linux counts below remain historical. No paid/model calls were made.

Gates 0–2 delivered 2026-09-16 (no model calls, 0 spend): Windows platform venv (Python 3.14.7, pinned upstream source + `mcp==2.2.0`, `PYTHONUTF8=1`) reproduces the pinned inspect byte-identically (98 ops, 0 missing output schemas); `bun run check` clean; `bun test` **155 pass / 12 fail / 167 tests** after a one-line compiler path-separator fix that preserved the fs allowlist (remaining 12 classified under 041, no broad port). 040 boundary opt-in live-verified (0 validation failures over 2 x 70 calls). Handwritten solver completed dev task `82e2fac_1` twice from reset (completed=true, 2 passes / 0 failures both runs; answer "A Love That Never Was", likeCount 18; 70 calls, ~0.4 s compile + ~3.4 s exec, ~101 KB raw to 189 bytes). Raw artifacts local (`out-inspect-win2`, `out-run-win1`, `out-run-win2`); solver/scratch ignored, never committed. Go for 042 gate-3 offline preparation; gate 4 still needs a frozen matrix/cap.

The typed capability layer is enduring; both engines and the useful read-only API are implemented. Four trial stages show no demonstrated task-level advantage: typed profiles use fewer Pi calls but more context/cost. 004 attribution and compact development testing are delivered: compact reduced cost/success 26.4% against full declarations at 12/12 success in both arms. The September 13 R-CALL confirmation failed its cost threshold (compact 2/4 overall successes, full 3/4, stock 4/4); compact stays opt-in. Typed final answers were correct, with one policy failure and two harness failures. 025 shutdown ownership, 029 policy-aware discovery and 009 fixture fingerprints are delivered. Path-prefix close-out and 026/027/031 are delivered; do not repeat them. Engine equivalence, declaration causality and aggregation superiority are not established.

Baseline verification on 2026-09-14 at `875dccc`: `bun run check` passed; `bun test` passed **178 tests / 0 failures / 1399 assertions** with permitted local subprocess/loopback access. This precedes AppWorld code delivery and made no benchmark model calls.

Historical verification at `807562a`: `bun run check` passed; `bun test` passed **148 tests / 0 failures / 1169 assertions** with local subprocess/loopback access. The restricted first run failed fixture/server startup; the permitted rerun passed. No new model calls. Historical test counts in delivery records refer to their revisions.

On September 14 the user selected documentation reconciliation and the recommended enterprise sequence: AppWorld offline compatibility, matched lazy-direct versus typed pilot, separate catalog scaling, then confirmation only after a positive signal. Most work is delegated to Pi through OpenRouter with `meta/muse-spark-1.3-contributor`, medium reasoning; the supervisor scopes tasks, reviews changes and verifies results. The user explicitly permits sending this repository's contents to OpenRouter and allowing Pi to modify project files. Keep credentials and unrelated private material out of model context. Initial coding sessions each have 40-request/$5 conservative reservation limits; benchmark calls require a frozen matrix and spend cap after feasibility review. Record assumptions and results without erasing historical artifacts. Do not turn policy flags into answer failures or claim a clean heuristic audit proves containment.

## Recommended next work

| Issue | Current status |
| --- | --- |
| [037 — Reuse enterprise tool benchmarks](037-enterprise-benchmark-reuse.md) | gates 0–2 delivered 2026-09-16: env verified, 040 live-verified, dev task solved twice from reset; 042 gate-3 offline prep is next |
| [040 — AppWorld date-time compatibility](040-appworld-datetime-compatibility.md) | closed 2026-09-16: boundary opt-in implemented, synthetic tests green, live-verified (0 validation failures); shared-policy requirement passed to 042 |
| [038 — Diagnose missing typed-program reports](038-missing-typed-program-reports.md) | recorded prerequisite before reusing affected repository evaluation path; no regrading or new model runs |
| [042 — Matched application comparison](042-matched-application-comparison.md) | GO for gate-3 offline preparation (parity arm, checks, dry-run matrix/cap proposal); paid pilot still needs frozen matrix/cap approval |
| [039 — Typed REST operations via client generation](039-typed-rest-operations.md) | idea only: explore generated REST clients within the broader local/CLI/MCP/REST function hypothesis; not a prerequisite for 037 |
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
| [041 — Windows support and verification gaps](041-windows-verification.md) | compiler-separator fix landed 2026-09-16 (155 pass / 12 fail, was 67/95); remaining 12 classified environment failures, no general support claimed |
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

[044 — Uniform versus hybrid interfaces](044-uniform-versus-hybrid.md) captures the expectation that typed wrappers may lose on familiar tools but help with unfamiliar ones, and that workflow composition may outweigh individual-call overhead. A hybrid retaining ordinary shell/direct tools is a separate open comparison. This is not a conclusion about training exposure and does not expand the initial 042 matrix.

[043 — Remote services and local tools through typed functions](043-api-composition-computer-environment.md) records the broader proposition: many APIs/MCP operations plus a programmable execution environment, CLI tools and filesystem functions behind one composable interface. 037/042 test its first service-composition slice; additional adapters remain task-driven follow-ups.

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

- Explore a shared typed-function interface across local/CLI, MCP and REST operations. Prefer existing contracts and generated clients; avoid bespoke adapters without a demonstrated task need. MCP is the current real-application path; REST generation is not selected. No universal Unix replacement.
- Keep semantic checking, runtime validation, operation/resource policy and execution containment distinct. Bun ambient calls can bypass capability checks and traces.
- Default QuickJS, opt-in Bun; freeze one executor for the next presentation ablation.
- 013 owns bounded session research; 033 is its data-source work, 032 owns promotion decisions. Counts are observational and require reproducible classification.
- 034 caps remain conditional on measured failures; 025 load/shutdown robustness is delivered. Neither justifies broad infrastructure expansion.
- New work must have a caller need or an explicitly labeled experiment. Negative and inconclusive outcomes are useful project results.
