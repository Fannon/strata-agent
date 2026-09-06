# 001 — Benchmark stock Pi against typed capability composition

Status: done (2026-09-05: protocol v1 + runner `529e431` + 9/12 baseline; follow-ups in 009)
Kind: experiment design, then implementation
Source: user feedback, 2026-09-05
Dependencies: [002](002-typed-cli.md) for the actual CLI comparison; design can start first.

## Current interpretation (2026-09-05 reconciliation)

Completed scope is the exploratory fixture runner/pilot, not proof of superiority. The kept run remains historical data. Source inspection finds permissive substring grading, T4 checking tool errors without final recovery, and timeouts potentially marked pass. [009](009-baseline-hardening.md) repairs grading before repeats; [evaluation v2](../../docs/evaluation.md) is the proposed next protocol. Below, original proposal/next-step text is historical, not active work.

## Question

Does standard Pi calling CLI tools through bash differ in correctness, cost, latency or recovery from Pi plus Strata calling equivalent typed functions and composing them in TypeScript? Can a repeatable benchmark guide later harness, function and documentation changes?

## Current evidence and limits

The existing fixture demo and live smoke test show compile rejection and large intermediate results staying outside model context. They do not compare equivalent tasks across stock Pi and Strata, and output-byte reduction alone does not establish total token or cost savings.

## Proposed study, to review before building

Use the same deterministic data and backend operations through a CLI and typed functions. Keep task, model, runtime versions, credentials, time limits and local policy as comparable as possible. Use isolated fresh sessions and reset any fixture state between runs.

Initial conditions:

1. Stock Pi using bash and documented CLI commands.
2. Pi plus typed APIs, without multi-operation composition where practical, to help separate the effect of typing from composition.
3. Pi plus typed APIs with composition enabled.

The second condition is an optional ablation, not an MVP requirement. Record actual tool choices; a Strata run that falls back to bash should be visible rather than counted as pure typed execution. Stock Pi can also compose CLI operations in shell or scripts; do not artificially cripple that baseline to guarantee a win.

Candidate tasks: single lookup, dependent calls, large-result filtering, aggregation, invalid-argument recovery, untyped-result narrowing and denied-effect handling. Add discovery tasks only when discovery is available. Assess final answers with deterministic assertions rather than an LLM judge where possible.

Capture correctness, attempts/retries, compiler and runtime failures, capability and LLM tool calls, end-to-end latency, compile time, model input/output/cache tokens, cost estimates and capability/output bytes. Include system prompts, declarations, docs, source and error feedback in context accounting. Separate cold startup from warm session measurements. Repeat runs and report variation; do not present one successful smoke run as a benchmark.

## System prompt question

The user asked whether the system prompt needs adjustment. Working hypothesis: each condition needs accurate instructions for its available interface, but prompt differences are a confound that must be versioned and reported. Strata already adds generated declarations and usage instructions. Decide what is shared, what is interface-specific, and what belongs to later tuning. Do not rewrite prompts before preserving a baseline.

## Open questions

- What small task set represents realistic coding-agent work without introducing unrelated harness features?
- Should initial comparisons use only the fixture CLI, a real CLI such as Git, or both?
- How many repeated runs fit a reasonable budget, and how should variance be reported?
- How do we compare permitted composition fairly when bash already supports pipelines and scripts?
- Which tasks become a held-out evaluation set rather than tuning examples?

## Next step when selected

Write a short benchmark protocol with tasks, conditions, metrics and budget. Select the shared backend/CLI with issue 002 before implementing the runner.

## Protocol v1 (baseline; agreed 2026-09-05)

Model fixed: `openrouter/meta/muse-spark-1.3-contributor` (Pi default thinking level; `--thinking off` is rejected by the endpoint: `400 Reasoning is mandatory`). Fallbacks `z-ai/glm-5.3-flash`, `deepseek/deepseek-v4-flash-0731` only if the primary errors; any fallback is recorded as a separate condition, never silently merged.

Conditions (fresh OS process per cell, `--no-session`, cold start):

- **A stock-Pi:** no `-e`, no `STRATA_CONFIG`. Preamble gives the twin CLI path and subcommands, forbids `typed_program`.
- **B typed, no composition:** `-e` Strata with twin config. Preamble requires exactly one capability call per `typed_program` invocation; forbids bash.
- **C typed, composed:** same setup; preamble allows free composition; forbids bash.

A run using a forbidden tool is recorded as a fallback deviation, not a pure-condition pass.

Tasks (deterministic substring checks on final text and tool outputs):

| Task | Instruction shape | Pass markers |
| --- | --- | --- |
| T1 lookup | DE customer count as `{"count": N}` | `count": 1` (quotes optional) |
| T2 dependent filter | DE invoice IDs over 10000 as `{"ids": [...]}` | contains `i0`, not `i1` |
| T3 large filter | 10000 records, `score > 0.98`, first five as `{"total", "selected"}` | contains `10000` plus `99 199 299 399 499` |
| T4 recovery | Try country `XX`; report what happened as `{"outcome"}` | A: tool output contains `bad country`; B/C: a `typed_program` output contains `compilation failed` |

Metrics per cell: pass/fail + note, wall ms, tool-call counts by name, `typed_program` report bytes (`rawCapabilityBytes`, `bytesExposedToPi`), Pi tool-content bytes, summed model usage (input/output tokens, cost estimate), final text. Static context accounting (declaration bytes, prompt bytes) recorded once in `results.json` meta.

Budget: 12 cells (4 tasks × 3 conditions), single attempt each, 150 s timeout per cell. No repeats in the baseline — variance is explicitly deferred (see limitations).

Recorded confounds: every run passes `--no-extensions` (+ `--no-skills`, `--no-prompt-templates`, `--no-context-files`) because a broken user-level `pi-lean-portal` aborts startup otherwise; the Strata extension still loads via explicit `-e`. All runs are cold processes; warm-session reuse is not measured.

Limitations (not fixed here): single attempt (no variance); no denied-effect task (the twin has no denied op); no untyped-narrowing task (twin is fully typed — MCP `untyped` stays covered by unit tests); cold starts only.

## Baseline report (2026-09-05, `baseline-2026-09-05T08-37-15Z`)

Runner `examples/benchmark.ts` (committed `529e431`, pushed). 12 cells, single attempt each, all on `openrouter/meta/muse-spark-1.3-contributor` — no fallbacks needed. Raw transcripts: `.work/benchmark/baseline-2026-09-05T08-37-15Z/` (gitignored). Total spend: 42,803 in / 9,473 out tokens, **$0.0062**. Static context: twin declarations 930 bytes.

| Task | A stock+bash | B typed, uncomposed | C typed, composed |
| --- | --- | --- | --- |
| T1 lookup | ✅ 7,014 tok / $0.0006 (bash+read) | ✅ 5,026 tok / $0.0003 (1 call, 56→335 B) | ✅ 5,103 tok / $0.0003 (1 call) |
| T2 dependent filter | ✅ 9,982 tok (5 bash) | ✅ 7,986 tok (2 calls, 131 B raw) | ✅ 5,250 tok (1 call, 2 capCalls — composed) |
| T3 large filter | ❌ `total:100` | ❌ `total:100` | ❌ `total:100` |
| T4 recovery | ✅ CLI `bad country XX` quoted | ✅ compile rejection, 0 calls, diagnostic quoted | ✅ same as B |

**9/12 pass.** Observations (hypotheses, not claims — n=1 per cell):

- T1/T2: typed conditions used fewer tokens and far fewer tool calls (1–2 vs 5); capability bytes stayed tiny (56/131 B raw). Directionally favorable, not statistically established.
- T2:C composed two operations into one program as instructed; T2:B used two separate calls. The ablation works as designed.
- T3 failed identically in ALL conditions: every run returned the correct `selected` but `total: 100` (the *filtered* count) instead of `10000`. The task wording (`{"total", "selected"}`) is ambiguous — a wording artifact, not a capability gap. Checker stands as pre-registered; rewording belongs to 004. Notably the byte story held even in failure (2,027,709 B raw → 377 B Pi).
- T4 is the sharpest contrast: stock Pi quotes a runtime CLI error; typed conditions quote a compile-time diagnostic with zero invocations.
- Incidental (from the superseded run below): when the typed backend was broken, the C model routed around it with bash (correctly flagged as deviation) and B models fabricated empty results instead of reporting the backend error. Evidence for 004 on error-report wording.

Limitations: single attempt per cell (no variance); cold processes only; no denied-effect or untyped-narrowing tasks; T3 wording ambiguous (see 004); stock-A runs used `read` twice alongside bash (ordinary Pi behavior, recorded not penalized).

Superseded: `baseline-2026-09-05T08-28-22Z` (5/12) is void — the runner passed a relative `--out`, so `STRATA_CONFIG` resolved against cell cwds and all typed cells failed with ENOENT. Fixed by absolutizing the out dir plus a `typed runtime unavailable` misattribution guard. Kept as evidence, not data.

Follow-ups filed as [009](009-baseline-hardening.md): repeats/variance, warm sessions, denied-effect twin op, T3 rewording verification (with 004).

## Completion criteria

- Versioned protocol and reproducible paired executions.
- Equivalent underlying operations/data and explicit prompt/tool differences.
- Raw traces and machine-readable outcomes with no secrets.
- First untuned baseline report, including failures and limitations.
- Follow-up improvements become separate issues rather than unrecorded benchmark changes.
