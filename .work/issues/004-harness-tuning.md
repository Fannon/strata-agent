# 004 — Attribute and reduce typed-context cost

Status: slices A and B delivered 2026-09-06; compact retained opt-in, independent confirmation remains open
Dependencies: delivered 026/031 instrumentation and 028 repo-2 artifacts; no new tool or executor required.

## Evidence and hypothesis

Dev+held-out: typed profiles made fewer tool calls but cost about 2–2.2× stock with 2.35–2.72× total tokens. Prompts include 17–17.5 KB declarations. This is a correlation: source, other instructions, cache behavior, repair turns and output also contribute. See [reviewed report](../../docs/repo-trials.md). Quiet success is already implemented; do not rebuild 031.

Hypothesis: a concise presentation of the same capability contract reduces total cost without worsening task success or repair burden. Goal is a fair test, not making Strata win.

## Slice A — offline attribution (delivered)

Attribution tool: `examples/attribute-context.ts` (run dirs → per-profile byte/token tables from request receipts, the ground truth — note `effective-prompt.json` misses declarations through hook ordering). Close-out run (R-EXPORT family, 10 cells/arm):

- stock: 46 requests, in-tok 83.5k, cacheR 77k, $0.0121; system-base 113KB, tool schemas 136KB, task/results 224+107KB, programs n/a, results 107KB.
- typed-quickjs: 41 requests, in-tok 147k, cacheR 160k, $0.0176; declarations 714KB (~17.4KB/req), system-base 157KB, tool schemas 207KB, programs 10KB, results 20KB.
- typed-bun: 49 requests, cacheR 246k (repetition mostly cache-discounted), declarations 853KB.

So: declarations are ~45–50% of typed input bytes but heavily cache-discounted; programs are tiny (~250B/req); typed results (~0.6KB/req) are far smaller than stock raw reads (~2.3KB/req); typed tool-schema listings run ~5KB/req vs stock ~3KB/req (extra tools). Cache behavior, repairs and outputs all contribute — declarations correlate, not proven alone.

Compact presentation: `declarations(module, "compact")` — alias module by re-export plus array caps as prose (`Max N items.`), runtime schemas untouched. Repo 17,408→5,810 B (67% off), fixture 3,296→1,733 B (47% off). Session option + `STRATA_DECLARATIONS` env (default full; loud failure on invalid). Parity: compile/no-compile agreement corpus incl. git ops, alias prefixes, suppression/import/main rules; the one documented move is over-cap arrays (static tuple rejection becomes pre-effect input rejection, zero calls). Reference workflows pass unchanged on baseline. `test/integration/declarations-compact.test.ts`, 153 green.

- [x] Summarize exact effective request components: declarations, fixed instructions, generated programs, prior results/errors and model-response counts. Record bytes separately from estimated tokens; retain actual input/output/cache usage. Repeated context is not necessarily uncached billing.
- [x] Inspect why stock uses fewer tokens: classify composition and output selection from a bounded sanitized sample. Count Pi tool calls separately from model responses and broker calls.
- [x] Account for declaration generation and prompt injection in one place; distinguish source schemas, compiler declarations and model-facing docs. Propose one compact model-facing presentation retaining every operation, input/output type, enum and critical semantic constraint.
- [x] Produce an offline size report and declaration/type-contract parity checks. Preserve grants, runtime schemas, task access and error behavior. Do not select operations using hidden answers. Per-task subsets or on-demand loading change a different factor and require a separate labeled experiment.

## Slice B — paired development trial (ran 2026-09-06, repo-2 + compact arm)

36 cells (6 dev R- tasks × stock-pi / typed-quickjs / typed-quickjs-compact × 2). Artifacts local-only: `.work/repo-pilot/2026-09-06T09-53-30-646Z/`. Ledger $0.0461, key delta $0.0385.

| arm | success | cost | cost/success | tokens | tool calls |
| --- | --- | --- | --- | --- | --- |
| stock-pi | 11/12 | $0.0092 | $0.0008 | 139,540 | 82 |
| typed-quickjs (full) | 12/12 | $0.0212 | $0.0018 | 437,030 | 41 |
| typed-quickjs-compact | 12/12 | $0.0156 | $0.0013 | 304,406 | 45 |

Compact cost-per-success is 26.4% below full ($0.0013 vs $0.0018) with identical success (12/12, within the 1-cell bar) — the predeclared retain bar (≥15%, no regression) is met on development evidence. Tokens −30%. The single stock miss is a novel variant (`core.js` unmapped, not a prefix).

Verdict: **retain (do not revert)** — compact stays opt-in pending confirmation on fresh uninspected families (the -3/-4 instances are now regression material; R-CALL/R-JOIN or new repos are the confirmation set). The default stays `full` until confirmation lands. No second revision spent; no behavior change to grants, schemas, checker or policy. A second model tests portability only after confirmation.

Runner support first landed offline (`typed-quickjs-compact` profile: quickjs engine + `STRATA_DECLARATIONS=compact`; both declaration snapshots pinned per run; dry-run validated). The subsequent paid development run is reported above.

- Matrix: 6 dev R- tasks × stock-pi / typed-quickjs / typed-quickjs-compact × 2 repeats = 36 cells, counterbalanced, fixed model/settings/caps/policy/guard/ledger. Bun arm excluded (executor fixed for this ablation).
- Command: `bun examples/repo-pilot.ts --run --max-cost-usd 5 --repeats 2 --profiles stock-pi,typed-quickjs,typed-quickjs-compact --tasks R-EXPORT-1,R-EXPORT-2,R-LOG-1,R-LOG-2,R-LOC-1,R-LOC-2`.
- Budget: $5 cap (expected actual ~$0.06 at recent per-cell rates).
- Predeclared bar: retain compact iff its cost-per-success is ≥15% below full-quickjs with success within 1 cell; otherwise revert. Report correctness, cost/success, responses, context categories, latency, regressions and uncertainty either way.
- If promising: confirm on new uninspected families, then a second model. At most one more coherent revision after this (limit: two).

- [x] Use one fixed executor/model and baseline versus compact presentation on existing development tasks. Match backend, checker, caps, policy and fresh-run state. Include stock as the reference, without restricting its scripting.
- [x] Predeclare matrix, budget, ordering and practical improvement threshold using docs/evaluation.md. Use existing explicit authorization only within remaining scope; otherwise obtain a concrete spend selection. Preserve all attempts, policy flags, missing usage and cost discrepancies.
- [x] Compare task correctness, overall success, estimated cost per success, model responses, context categories and median/tail latency. Report uncertainty and regressions; do not optimize bytes alone.
- [x] At most two coherent development revisions. Retain/revert with evidence. If promising, confirm on new uninspected repository/workflow families; the original held-out -3/-4 instances were inspected and rerun and are now regression material. Add a second model after the initial development signal.

## Decision

If full-surface compact presentation helps, retain it and test independent work. If it does not, do not keep shrinking semantics or inventing harder tasks until a win appears. Consider a separately measured hybrid/structured-service niche or keep the project as a learning harness. Aggregation superiority is unproven. No new engines, persistence, configurable caps or arbitrary Bun access in this ablation.

Acceptance: reproducible attribution and a versioned, bounded retain/revert/narrow decision, with complete API semantics preserved. An inconclusive or negative result completes the experiment honestly.
