# Strata issue board

Updated 2026-09-06: 026 minimal tracing and 027 executor implementation + deterministic comparison delivered (300e2ad, plus docs commit); matched model trials pending budget. [HANDOFF](../HANDOFF.md) and the tracked [public handoff](../../docs/handoff.md) are the next-agent entry points. `.work/` is intentionally gitignored. Tracked design: [ACD](../../ACD.md), [evaluation](../../docs/evaluation.md), [research](../../docs/research/typed-agent-prior-art.md). [PLAN.md](../PLAN.md) holds the roadmap and historical build record.

## Working agreement

Capture substantial work here before implementing it. The user selected the deterministic 009 repair and commit/push; that slice is delivered. The current mode is planning/architecture/documentation and handoff. Other implementations and paid experiments below await explicit selection. `ready` means actionable, not independently authorized. Select a slice explicitly; finish small directly requested changes normally. Keep evidence, hypotheses, dependencies and completion criteria distinct.

Statuses: `backlog`, `research`, `ready`, `in-progress`, `blocked`, `done`, `deferred`. A completed fixture spike does not mean general repository support is complete.

## Recommended execution order

**Architecture update (takes precedence over older sequencing below):** The enduring architecture is the typed capability layer: discoverable contracts, semantic checking, composable repository/API/MCP functions, runtime validation, permission-aware implementations and observability. The execution engine is an implementation choice. QuickJS remains the implemented baseline; direct Bun is a first-class planned alternative, without a prerequisite to prove QuickJS is slow. Execution containment is a separate concern. This documentation decision does not itself implement or select a runtime migration. Next planning sequence: reconcile delivered slices, select minimal 026 tracing plus 027 executor comparison, run deterministic checks, then matched repository trials under an explicit budget. Full observability and a new sandbox are not prerequisites. Preserve completed results and do not redo completed cancellation/read work.

| Stage | Issue | Status | Dependency / outcome |
| --- | --- | --- | --- |
| 0 | [010 — Concept, ACD and evidence reset](010-concept-and-roadmap.md) | done | This planning pass |
| 1a | [016 — Restore Pi cancellation](016-pi-cancellation.md) | done | Verified via registered-tool tests; load race → 025 |
| Done | [009A — Trustworthy evaluation runner](009-baseline-hardening.md) | done | Protocol v2, exact grading, reservations, offline tests; no paid baseline |
| Next sequence | [020 — Cancellation → read policy → useful strict pilot](020-next-sequence.md) | recommended | Revised to include stock Pi and distinguish smoke from comparative evidence |
| 2a | [012 — Scoped effects and permissions](012-scoped-permissions.md) | Phase A reads done | Root+caps policy + denials; approvals deferred to Phase B |
| 2b | [013 — Session-derived priorities](013-session-capability-study.md) | ready, optional | Refines 011; must not block its obvious orientation slice |
| 3 | [011 — Native repository capabilities](011-native-repository-capabilities.md) | usability slices done (ranges, globs+hints, diff/show/history) + 4 reference workflows | Repo cap, strict/hybrid profiles, 27/27 pilots; 028 task corpus + evaluator hardening remain |
| 4 | [009 — Native pilot and held-out evaluation](009-baseline-hardening.md) | planned | 011 + strict profile + reliable runner; explicit spend cap |
| 5a | [014 — Prime/IPython comparison](014-prime-comparison.md) | backlog | Initial research complete; comparable task/runner first |
| 5b | [004 — Measured API/prompt tuning](004-harness-tuning.md) | backlog | Reliable dev-set evidence, bounded tuning |
| Gate | Continue / narrow / pivot / stop | pending evidence | [Decision criteria](../../docs/evaluation.md#continue-narrow-pivot-or-stop) |
| 6 | [015 — Edits, checks and fallback](015-edits-checks-fallback.md) | backlog | Read slice earns expansion; stronger effect controls |

1a/1b and 2a/2b are independent if selected. Dependencies: `016 + 012(read policy) → 011`; `009(runner) + 011 → 009(native trials) → 004/014 → decision → 015`. Session study informs contracts, not a mandatory broad mining phase.

## Conditional work

New follow-ups: [026 — Correlated observability](026-observability.md) minimal slice delivered (trace v1, JSONL sink, summary example; overhead measured with 027); [027 — Replaceable executor and direct Bun comparison](027-permission-aware-runtime-alternatives.md) implementation + deterministic comparison delivered (see [docs/executors.md](../../docs/executors.md)); 2026-09-06 model trial reported 27/27 ($0.0117), feasibility evidence with runner limitations recorded in 028; [028 — Discriminating repository workflows](028-harder-repository-tasks.md) reviewed and ready for selection: evaluator hardening → licensed task contracts → necessary API gaps → bounded comparison; [benchmark research](../../docs/research/repository-benchmarks.md) covers FrontierHarness, RepoQA and Terminal-Bench. Permission-aware functions extend 012; import checks alone are not an enforcement boundary. The ACD now records the critical assessment and hybrid-product possibility.

| Issue | Status | Trigger |
| --- | --- | --- |
| [005 — Resource limits](005-runtime-limits.md) | backlog; selected bounds required by 011 | Native/process byte and concurrency caps for real repositories; stronger compiler/OS isolation remains threat-driven |
| [007 — Report bounds](007-report-bounds.md) | backlog, child of 005 | Prioritize host caps over speculative fixed-point loop concern |
| [017 — Dependencies and supersession](017-capability-relationships.md) | deferred | Overlapping real capabilities or measured discovery misses |
| [018 — Sandbox bash escape hatch](018-sandbox-bash.md) | backlog | Verified Prime bash execution wrapper; inventory all effect paths with 012 first |
| [019 — Harness snapshots/rollback](019-harness-snapshots.md) | deferred | Only after measured wrong-load/restart cost; define in-flight semantics |
| [021 — Code Mode and semantic-checking ablation](021-code-mode-checking.md) | backlog | Research captured; reuse native tasks before controlled comparison |
| [020 — Proposed next sequence](020-next-sequence.md) | backlog, awaiting selection | 016 done → 012 → 011 slice + strict pilot, with stop conditions |
| [025 — Load/shutdown race](025-load-shutdown-race.md) | backlog | From 016; connector leak on load racing shutdown |
| [029 — Policy-aware search](029-policy-aware-search.md) | backlog, ready (small) | Hide/mark not-allowed hits in search; load refusal stays authoritative |
| [030 — Optional memory](030-optional-memory.md) | backlog, idea only | Stateless by default; prefer Pi extension over new store |
| [031 — Quiet success](031-quiet-success.md) | done | Result-only success text, details on demand; 130 pass |
| [022 — `@c/` import alias](022-import-alias.md) | done | Dual-prefix support; `@c/` advertised, `@cap/` retained |
| [023 — Library-backed capabilities](023-library-backed-capabilities.md) | backlog, informs 011/012 | Evaluate simple-git during the first Git slice; reuse suitable APIs and types, verify Bun compatibility and effect bounds |
| [024 — Filesystem/search library candidates](024-filesystem-search-library-candidates.md) | backlog, informs 011/012/015 | Bun built-ins first; fast-glob/fs-extra only for demonstrated gaps or benefits; distinguish path discovery from content search |
| Discovery expansion from [003](003-tool-discovery.md) | deferred | Measured lexical failure; no arbitrary entry count forces a database |

## Completed slices, with honest scope

| Issue | Actual completion |
| --- | --- |
| [001 — Fixture benchmark pilot](001-benchmark.md) | A/B/C runner and historical 12-cell pilot; no robust advantage claim |
| [002 — Typed CLI slice](002-typed-cli.md) | Three synthetic twin operations via argv; not Unix/native repository coverage |
| [003 — Minimal discovery](003-tool-discovery.md) | Static extraction, lexical search/load, multi-module runtime; no dependency resolution/dynamic grants |
| [006 — Docs/DX](006-docs-hygiene.md) | Fixture selection, troubleshooting, instructions and declaration drift test; current refresh in 010 |
| [008 — Backend spike](008-second-fixture.md) | CLI twin chosen; original real MCP fixture was not built |

## Scope and evidence rules

- Avoid model-authored shell for supported workflows; prefer native implementations, retain mature argv adapters. No subprocess-free mandate.
- Bun host APIs are not directly available to QuickJS programs. Types and operation allowlists are not filesystem containment.
- Stock Pi scripting is a strong baseline; Prime IPython includes bash. Record complete harness differences.
- Historical 9/12 fixture cells, the current 53 passing tests and byte reduction prove different things. No paid v2 model evaluation has run.
- Historical model preference: OpenRouter `meta/muse-spark-1.3-contributor`, then `z-ai/glm-5.3-flash`, then `deepseek/deepseek-v4-flash-0731`; verify availability/prices at run time. Fix models within pairs; segregate fallback results.
- Raw private sessions/profiles stay local; publish sanitized reproduction artifacts.
- Negative results are useful: retain lessons about Pi and harness design even if Bash familiarity or runtime overhead wins.
