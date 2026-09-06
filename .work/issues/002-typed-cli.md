# 002 — One typed CLI capability for the benchmark

Status: done (2026-09-05, commits e64e313 + 1d7236e)
Kind: design and implementation
Source: project vision and benchmark prerequisite
Dependencies: task/interface choices from [001](001-benchmark.md).

## Current interpretation (2026-09-05 reconciliation)

Done means the synthetic three-operation CLI twin, not general Unix/native functions. The instruction to preserve Pi bash described this slice; the user now wants to test strict shell avoidance as a separate profile. [011](011-native-repository-capabilities.md) adds native repository contracts and [015](015-edits-checks-fallback.md) preserves optional fallback. No one-for-one CLI flag port is planned. Original candidate/next-step sections below are historical.

## Motivation

The current runtime supports MCP capabilities. The broader vision includes CLI tools exposed as typed functions, and the requested benchmark specifically compares CLI-through-bash with typed programmatic calls. We need one convincing shared backend, not a general CLI-wrapping framework.

## Candidate approaches, not decisions

- Expose the existing deterministic fixture data through a small CLI and an equivalent typed capability. This offers tightly controlled correctness and byte measurements.
- Select one real CLI with useful structured output and a small read-only operation set. This offers realism but adds version and environment variability.

Prefer typed inputs mapped to an argument array, with no shell-string assembly. Parse and runtime-validate output before promising a return type. Where only unstructured text exists, expose it honestly rather than pretending it is a structured interface.

## Contract requirements

All calls from typed programs still pass through the broker for authorization, validation, cancellation and instrumentation. A typed wrapper should represent a meaningful operation, not expose unrestricted `exec(command: string)`. Preserve the normal Pi bash tool outside the typed runtime. Do not change Pi core or add unrelated adapters as part of this issue.

## Open questions

- What is the smallest useful operation set for the benchmark?
- Can the normalized manifest express its inputs/results without transport-specific assumptions?
- How should process exit codes, stderr and output parsing failures become useful typed-runtime errors?
- What output formats and CLI versions can we actually guarantee?

## Next step when selected

Choose one backend and define two or three equivalent CLI/typed operations with deterministic checks. Agree on this contract before implementation.

## Agreed contract (2026-09-05)

Backend decision: the deterministic CLI twin (008's recommendation, accepted). Rationale: identical data through bash and typed calls, deterministic assertions, no external version variance, real process boundary. A real-world CLI was rejected for now — environment variability would confound the benchmark it exists to serve.

| # | Bash (stock Pi) | Typed (Strata) | Deterministic check |
| --- | --- | --- | --- |
| 1 | `bun test/fixture-cli/cli.ts customers --country DE` | `api.customers({ country: "DE" })` from `@cap/cli` | customers `== [{id:"c1",country:"DE"}]` |
| 2 | `bun test/fixture-cli/cli.ts invoices --customer-ids c1` | `api.invoices({ customerIds: ["c1"] })` | invoices `== [{id:"i0",customerId:"c1",amount:12000}]` |
| 3 | `bun test/fixture-cli/cli.ts records --count 10000` | `api.records({ count: 10000 })` | 10,000 records; `score > 0.98` selects `[99,199,299,399,499]` |

Answers to the open questions: 3 ops suffice (lookup, dependent calls, large-result filtering); the normalized manifest expressed them with zero transport-specific assumptions (same shapes already served over MCP); exit codes/stderr/parse failures surface as broker `transport` errors (`exit <code>: <stderr…>`); the CLI is pinned in-repo so there is no version to guarantee.

## Completion report (2026-09-05)

**What was built and why:** 008 proved bindings in tests; this slice made the capability benchmark-usable. Twin ops promoted to `examples/cli-twin.ts` (precedent: the extension already imports the MCP helper from `examples/`; `src/` must not import from `test/`). `STRATA_CONFIG` gained a second shape — `{transport:"cli-twin", allow}` with command/args fixed to the twin script — via an exported, tested `sessionFromConfig()`. Deliberately not a framework: no generic command/argv templating, no new Pi tools, Pi core untouched, bash escape hatch preserved.

**Evidence:** 33 pass / 0 fail (`check` clean, demo unchanged). New `pi-config.test.ts`: twin config composes customers→invoices to `["i0"]`, out-of-allow `records` denied, malformed configs rejected with clear errors. Live-verified both sides with a real model: `STRATA_CONFIG=twin bun run pi -p "…invoices above 10000"` → `["i0"]`, and the documented bash commands return the contracted JSON (missing flag exits 2 on stderr). README carries the equivalence table so 001 can lift it directly.

## Original completion criteria

One CLI capability works through explicit broker bindings, has truthful result types and validation, and can be compared against direct bash use on identical data. Tests cover argument fidelity, failure translation and blocking before process execution.
