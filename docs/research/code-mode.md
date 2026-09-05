# Cloudflare Code Mode and Strata

Research date: 2026-09-05. External source links below describe the versions inspected that day; GitHub `main` links can change. This informs the [ACD](../../ACD.md), without authorizing a runtime replacement.

## Relationship

Cloudflare's September 2025 article describes converting MCP schemas into TypeScript APIs, asking models to compose calls in code, and keeping intermediate results outside model context. That is the same central mechanism Strata explores. Its reported improvement concerns MCP use; it does not establish superiority over coding agents composing Bash or IPython. [Original article](https://blog.cloudflare.com/code-mode/)

The product inference is that “tools as code” is established prior art. Strata should justify its particular combination of checked programs, local repository capabilities, and permission enforcement through measured outcomes. Its current Bun-hosted compiler, broker and QuickJS execution are documented in the [implemented architecture](../../ARCHITECTURE.md).

## Distinctions that matter

**Declarations are not semantic checking.** Current Cloudflare AI SDK documentation explicitly supplies TypeScript definitions while asking the model to write JavaScript. The inspected executor normalizes source and loads a Worker; its normalizer parses JavaScript with Acorn. Those paths do not show Strata's pre-execution TypeScript diagnostic gate. This is a scoped implementation observation, not a claim about every Cloudflare integration. [AI SDK integration](https://developers.cloudflare.com/agents/tools/codemode/ai-sdk/), [executor](https://github.com/cloudflare/agents/blob/main/packages/codemode/src/executor.ts), [normalizer](https://github.com/cloudflare/agents/blob/main/packages/codemode/src/normalize.ts)

**Isolation and authorization remain separate.** Cloudflare's executor blocks outbound networking by default and dispatches tool calls to host functions through RPC. Strata's corresponding boundary is QuickJS-to-broker; native Bun file operations belong behind that boundary. The architecture inference is to reuse Bun and ecosystem implementations in trusted adapters, while defining narrower agent-facing contracts. A function signature does not itself enforce allowed paths or effects. [Executor](https://github.com/cloudflare/agents/blob/main/packages/codemode/src/executor.ts), [Strata concept](../../ACD.md)

**Cloudflare has progressed beyond the original article.** Namespaced providers, durable execution logs, connector search/description, and approval pause/resume are now documented. The stateless `createCodeTool()` excludes approval-requiring tools; durable connectors integrate approvals. This is useful precedent for making unsupported permission behavior explicit. It is not a reason to introduce durable execution into the next Strata slice. [AI SDK integration](https://developers.cloudflare.com/agents/tools/codemode/ai-sdk/)

## What to adopt and compare

Keep capability providers independent of execution and model integration. Study discovery and operation-level approval contracts before expanding Strata; retain the local Bun/Pi architecture while testing its value.

After repairing the grader, propose a controlled ablation: identical schemas, runtime policy, tasks and models, with semantic checking enabled versus disabled. Measure correct completion, recovery calls, total tokens, latency and unwanted attempted/executed effects. This isolates the compiler's contribution from the already-shared benefit of code composition. An actual Cloudflare integration is a separate comparison requiring a pinned version and equivalent capabilities; disabling checking is not a faithful Cloudflare benchmark.

Compare repository workflows against strong Bash and Prime/IPython baselines under equivalent budgets. The user supplied `/home/fannon/dev/_analyze/prime-agent` for later source inspection. Study its useful execution and feedback patterns independently of language choice; no Prime performance claims were verified in this note.
