# 048 — Modern Pi Codemode as a comparison baseline

Status: narrow installed-Pi inspection and baseline delivered through 049 on 2026-09-30; broader matched comparison deferred
Kind: comparison design
Sources: [Earendil announcement](https://earendil.com/posts/you-said-no-mcp/) (2026-09-29); [dated relationship note](../../docs/research/pi-codemode-2026-09.md)
Dependencies: 046 (historical evidence); a pinned current Pi and verified matched environment before execution; 038 if reusing the affected repository evaluator. 021 and 047 are separate optional experiments, not prerequisites.

## Question and hypotheses

Delivered scope: [049](049-checking-policy-pilot.md) verified installed Pi 0.99.1 and ran six native-Codemode baseline cells before the checking experiments. Native passed 6/6 on the small synthetic tasks. Installed worker source uses QuickJS JavaScript evaluation without a TypeScript semantic gate in the inspected path. Native had different declarations/tool/program interfaces; this is a configured-system baseline, not a compiler ablation, live MCP evaluation or compatibility certification for the full Strata extension. Historical proposal below remains deferred beyond that scope. [Report](../../docs/checking-policy-pilot.md)

Does Strata add useful checking, recovery or effect control over Pi's native code orchestration on matched tasks, enough to justify its additional interface and maintenance costs?

- Shared code composition may account for most of the benefit, leaving no useful Strata advantage.
- Pre-execution checking may prevent some failed calls or partial effects, but diagnostic repair and declarations may cost more than they save.
- Native deferred tool exposure or session state may change context and reuse costs. These are whole-system differences to measure, not assumptions about current Pi internals.

The announcement postdates the original Strata experiment; no influence claim follows. At issue capture, current Pi source had not been inspected. The subsequent 049 delivery above records the narrow inspection and pilot; the existing package pin and earlier measurements retain their original baselines.

## If selected

1. Inspect and pin a specific Pi release. Record actual checking, structured result handling, discovery, persistence, permission and execution behavior; the announcement alone is insufficient.
2. Verify a separate comparison environment before changing this repository's dependency pin. Determine whether matched capabilities can run in separate harness versions without porting Strata.
3. Freeze a small task family, equivalent backend operations, data, grants, model, budgets and grading. Retain ordinary scripting. Either hold discovery/state constant or account for them explicitly.
4. Compare complete configured systems. Use 021's checked/unchecked pair separately to isolate the compiler; an unchecked Strata path does not reproduce native Pi.
5. Count declarations/discovery, model requests, repairs, context/cache tokens, total cost per success, wall time and attempted/executed effects. Verify effect accounting on the synthetic backends. Reconcile the cumulative spend ledger before model trials.

## Decisions and completion criteria

Produce a pinned behavior/parity table and bounded matrix before any campaign. If the comparison runs, report task outcomes, cost, latency and verification limits, with a retain/simplify/stop decision. Untouched tasks are required before generalizing a positive development signal.

No Pi upgrade, framework port, durable state implementation or model run is authorized by capturing this issue.
