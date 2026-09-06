# 021 — Cloudflare Code Mode prior art and semantic-checking ablation

Status: backlog for experiment; primary-source relationship research complete
Kind: experiment design
Source: user link https://blog.cloudflare.com/code-mode/
Dependencies: 009A complete; use meaningful 011 tasks before measuring product value.

## Evidence and implication

[Research](../../docs/research/code-mode.md) records that code-based tool composition and intermediate-data reduction are shared prior art. Current inspected Cloudflare paths supply TypeScript declarations but execute generated JavaScript; they do not establish Strata's semantic compile-before-execution gate. This is a scoped source observation, not a claim about all Cloudflare integrations.

Strata should test the incremental benefit of its type checker, deliberate APIs, and Bun-backed local implementations. Keep the local architecture; Code Mode does not imply adopting Workers or dropping the broker. Loading declarations, validating schemas, checking code and authorizing effects are distinct responsibilities.

## If selected

- [ ] Pin relevant Cloudflare source/docs and identify the particular behavior under comparison.
- [ ] Design a development-only checked/unchecked pair with the same Pi/model, API declarations, runtime, schemas, policy and tasks. Change semantic checking only; never disable runtime validation/authorization.
- [ ] Keep generated program style/imports/output and token accounting comparable; report diagnostics, retries, attempted/executed effects, correctness and latency.
- [ ] Use development tasks for setup and held-out tasks for conclusions. Include good first-attempt programs where checking is overhead, and invalid programs where it may prevent failed effects.
- [ ] Decide whether checking earns its cost. If evaluating actual Cloudflare, add a separately pinned whole-runtime arm; an unchecked Strata arm is not a faithful Cloudflare benchmark.

Acceptance: controlled comparison and explicit retain/revise decision. No automatic move to persistent state, durable approvals, new retrieval machinery or remote hosting from this research alone.
