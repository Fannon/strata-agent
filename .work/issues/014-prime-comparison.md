# 014 — Compare Prime/IPython and Strata fairly

Status: backlog for implementation; initial primary-source research complete
Kind: harness comparison
Source: user request for Prime research and Bun/TypeScript reinterpretation.
Dependencies: 009 evaluator/task contracts and 011 repository slice.

[Research](../../docs/research/typed-agent-prior-art.md) pins PrimeIntellect-ai/prime-agent at `5c2750bdc3c99cc4225c1167a3484371a7a221ab`. Persistent IPython, top-level await, Python skills and `bash()` already support composition. State and orchestration differ from fresh Strata programs. No Prime run performed here.

## Local source and product constraint

User supplied `/home/fannon/dev/_analyze/prime-agent`; verified HEAD `5c2750bdc3c99cc4225c1167a3484371a7a221ab`, matching the research. Start there when selected, recheck revisions and read relevant instructions. Strata intentionally explores checked TypeScript and native Bun-backed capabilities; borrow useful composition, feedback, discovery or orchestration ideas without assuming a Python REPL design is the target. Whole-harness comparisons and matched ablations answer different questions. [021](021-code-mode-checking.md) captures Cloudflare Code Mode as additional prior art.

## Plan

- [ ] Pin runnable Prime/environment and record Python/kernel/packages/provider/prompt/tools/skills/launch command. Verify config against source again.
- [ ] Add isolated adapter emitting 009's artifact schema, with process cleanup, deterministic preflight and token/time/spend caps.
- [ ] Run matching seeded tasks with fixed model/provider/reasoning and practical access policy. Incompatible models produce unmatched results, not a paired win.
- [ ] Allow documented bash/persistence; distinguish cold setup, warm infrastructure and task history. Record recursion/skills rather than silently privileging one arm.
- [ ] Compare correctness, all-attempt cost, latency, retries and fallback. Label results whole-harness comparisons.
- [ ] File narrower matched Python/TS state or checking ablations only if evidence warrants them.

Acceptance: reproducible sanitized configs/artifacts, shared independent oracles, explicit confounds and continue/narrow/pivot recommendation. No goal to clone Prime or build persistent TS state on analogy alone.
