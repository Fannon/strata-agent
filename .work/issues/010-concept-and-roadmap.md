# 010 — Reconcile concept, ACD, research and roadmap

Status: done (2026-09-05)
Kind: authorized product/architecture planning and research
Dependencies: inspect source at `5079c4d`, recent commits and issues 001–009.

## Decisions and deliverables

- [x] [ACD](../../ACD.md): repository workflow, semantic contracts, modules, trust boundaries, alternatives and delivery gates.
- [x] [Evaluation plan](../../docs/evaluation.md): fair Pi/Prime conditions, exact oracles, repeats, cost accounting, held-out tasks and continue/narrow/pivot/stop criteria.
- [x] [Primary-source research](../../docs/research/typed-agent-prior-art.md): pinned Prime/Pi, Bun/ecosystem reuse and security limitations.
- [x] README value proposition and shipped-scope corrections; ARCHITECTURE implementation caveats.
- [x] Reordered local board, stable old issue IDs, new actionable slices 011–017.

Choose narrow native repository APIs through the current broker; pure transformations stay ECMAScript. No model-authored shell does not mean no subprocesses. Bun APIs belong in trusted adapters. Parameter-aware grants need enforcement beyond current operation allowlists. Fix cancellation and evaluator before claiming advantage.

## Verification and scope

`bun run check` and 41 integration tests pass on Bun 1.4.1-canary.1. Existing tests do not cover the newly identified Pi cancellation regression. Application code is unchanged. No paid model calls or private transcript mining performed. Session research and supersession are preserved as separate issues; negative experimental outcomes explicitly remain useful.

Next recommended implementation selection: 016 plus 009's deterministic grader/preflight work. Open design decisions belong to their implementation issues.
