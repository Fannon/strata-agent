# Typed agent capabilities: prior art and implementation evidence

Research date: 2026-09-05. This is an architectural research note, not a performance result. Public primary sources and installed Pi source were inspected; no live model evaluation or private session analysis was performed.

## Conclusion

The useful experiment is whether a small, coherent TypeScript capability library improves coding outcomes and total resource use. Replacing shell punctuation alone does not establish that. Stock Pi can already execute scripts, and Prime Agent already composes actions in code. Strata's proposed distinction is checked TypeScript composition, purpose-designed structured contracts, and authorization at each external effect. This is a hypothesis to test, not an established advantage.

Separate three objectives: **no agent-authored shell**, **no shell interpreter in adapters**, and **no subprocesses**. The first two are plausible initial targets; the third would exclude many existing build tools and require substantially more replacement work. A trusted adapter invoking Git with an argv array can satisfy the first two while remaining a subprocess.

## What the comparison systems actually do

### Pi

The installed baseline is `@mariozechner/pi-coding-agent` **0.73.1**, matching this repository's package pin. Pi defaults to `read`, `write`, `edit`, and `bash`; `grep`, `find`, and `ls` are also available built-ins. Extensions can change its tools. Its shell tool can run a whole script, including Python or Bun, so a fair baseline must allow batching, local filtering, JSON parsing, and project utilities. A comparison that forces Pi to return every intermediate record tests an artificial handicap. [Pi v0.73.1 README](https://github.com/earendil-works/pi/blob/v0.73.1/packages/coding-agent/README.md)

Pi's installed `dist/core/tools/` and extension documentation were checked locally. Keep the harness version, active tools, prompt, truncation rules, and extensions in every evaluation manifest; “stock Pi” alone is underspecified.

### Prime Agent

The relevant project is **PrimeIntellect-ai/prime-agent**, not other projects named PRIME. Research pinned GitHub `main` to **`5c2750bdc3c99cc4225c1167a3484371a7a221ab`**. Its documented model-facing core is a persistent IPython kernel, with Python skills, MCP-backed skills, and recursive subagents. The TypeScript host owns model calls, sessions, scheduling, and child-agent lifecycles. These are additional product differences, so a product comparison cannot isolate Python versus TypeScript. [Pinned usage documentation](https://github.com/PrimeIntellect-ai/prime-agent/blob/5c2750bdc3c99cc4225c1167a3484371a7a221ab/packages/coding-agent/docs/usage.md)

Source confirms top-level `await`, persistent variables/imports/data, best-effort namespace restoration, and an explicit `bash()` helper. IPython tool calls are sequential within a batch; code inside a call can orchestrate work. Interrupted kernels may require restart, losing state. Prime therefore offers valuable composition and persistence prior art, but is not evidence that a shell-free library succeeds. [Pinned IPython tool implementation](https://github.com/PrimeIntellect-ai/prime-agent/blob/5c2750bdc3c99cc4225c1167a3484371a7a221ab/packages/coding-agent/src/core/tools/ipython.ts)

An instructive integration detail: the retained example permission extension only intercepts a tool named `bash`. That example alone does not mediate effects made through the current `ipython` tool. This is a narrow source observation, not an assessment of every Prime deployment's security. It illustrates why moving execution behind one tool requires revisiting old permission hooks. [Pinned permission example](https://github.com/PrimeIntellect-ai/prime-agent/blob/5c2750bdc3c99cc4225c1167a3484371a7a221ab/packages/coding-agent/examples/extensions/permission-gate.ts)

## Bun and TypeScript: reuse implementations, design the public contract

These are host-side candidates, not proposed unrestricted imports inside generated programs:

| User intent / common shell tools | Host implementation candidate | Proposed model-facing contract |
| --- | --- | --- |
| Read text/JSON, `cat`, `head` | `Bun.file`, `node:fs/promises` | Bounded text ranges; `unknown` JSON until validated; explicit missing-file result |
| Directory entries, `ls`, `find` | `node:fs` directory APIs, `Bun.Glob` | Paths and kinds, deterministic ordering, traversal limits and continuation metadata |
| `grep` / `rg` | Bounded native search prototype or trusted ripgrep argv adapter | Matches with path, line, context, completeness; explicit ignore policy |
| `jq`, `sort`, `uniq`, `cut`, `awk` | Standard ECMAScript arrays, maps, sets, strings, JSON | Ordinary code over typed values; no extra tool for each transformation |
| `git status`, `git log`, `git diff` | Trusted Git argv adapter; evaluate isomorphic-git | Repository operations returning records; intentional revision/path selectors |
| Test/build project | Fixed executable/argv through `Bun.spawn` | Configured task identity, bounded logs, exit status, cancellation |
| `echo` separators | Return a named object | Preserve structure rather than formatting a combined transcript |

Bun supplies lazy file references, text/JSON/byte/stream reads, writes and copies. It explicitly directs directory operations to its `node:fs` implementation. Its JSON reading API returns `any`: parsing does not establish a domain type. [Bun file I/O](https://bun.com/docs/runtime/file-io)

`Bun.Glob` supports asynchronous traversal and options for dotfiles, symlink following, and file-only results. These are useful primitives, but their defaults do not constitute repository-aware ignore semantics or an authorization policy. Define those separately, especially for explicitly requested gitignored `.work/` files. [Bun glob documentation](https://bun.sh/docs/runtime/glob)

`Bun.spawn` accepts executable/argument arrays with cwd, environment and I/O controls. This enables adapters without shell parsing. It does not make the executable safe or prevent a launched project task from spawning a shell itself. [Bun spawn API](https://bun.sh/reference/bun/spawn)

`Bun.$` is a shell implementation with interpolation handling, not a replacement for a semantic capability API. Use it only in an explicitly designated shell fallback if that variant is evaluated. [Bun Shell](https://bun.com/docs/runtime/shell)

Bun strips TypeScript syntax and does not typecheck execution; Strata's separate checking stage remains necessary. Standard-library availability in Bun also says nothing about availability inside QuickJS. [Bun TypeScript documentation](https://bun.com/docs/runtime/typescript)

Ripgrep's repository filtering, hidden-file and binary handling are meaningful behavior, not incidental CLI syntax. A few JavaScript regular expressions over recursively loaded files are not automatically equivalent. Preserve a tested search contract and choose its implementation after semantic and performance checks. [ripgrep guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)

Isomorphic-git supplies a JavaScript Git implementation with TypeScript definitions and injected filesystem/HTTP interfaces. It is a credible subprocess-free spike, not a proven drop-in replacement for every working-tree/repository shape. Compare supported status/log semantics, worktrees, submodules, performance and maintenance cost before adopting it. [isomorphic-git repository](https://github.com/isomorphic-git/isomorphic-git)

For a Git adapter, prefer machine formats: porcelain status is explicitly stable across versions and user configuration; NUL-delimited output avoids ambiguous filename parsing. Git status may refresh/write the index, so “read-only” needs an operational definition. Its documentation recommends `--no-optional-locks` for background status. [Git status documentation](https://git-scm.com/docs/git-status)

## Security: similar policy intent, different enforcement work

The user's analogy is useful: allow specific operations with parameter constraints and ask for additional authority when needed. The proposed architecture must still implement the following, rather than treating TypeScript as enforcement:

1. Authorize each resolved effect at the broker, after validating input and before dispatch. A loaded declaration is not a grant. Static types cannot prove user intent or filesystem containment.
2. Keep generated code separate from trusted Bun adapters. Direct `Bun.file`, `process`, arbitrary imports or spawn would bypass a broker-only policy. See the current [runtime architecture](../../ARCHITECTURE.md).
3. Bind filesystem grants to roots, operation kind and limits. Address path traversal, symlinks, race conditions, file kinds and mutation preconditions. String-prefix checks and a one-time `realpath` check are insufficient as a hardened isolation claim; stronger guarantees require appropriate OS enforcement.
4. Bind process grants to executable, cwd, environment and meaningful allowed arguments. An approved `test` script still executes project code. Child processes, Git configuration/helpers and network access belong in the threat model.
5. Bind interactive approval to the concrete call and policy version; define grant lifetime, revocation, and retry behavior. A composed program is not a transaction: earlier writes may succeed before a later denial or timeout. Never replay writes blindly.
6. Keep untrusted file/tool contents as data. Typed results can contain prompt injection, secrets, or misleading facts. Minimize logs and audit effect metadata without assuming type validation makes content trustworthy.

These are design recommendations. This research does not establish a hardened Bun or QuickJS sandbox. Even Node's permission documentation distinguishes its permission facility from protection against malicious code; capability policy and runtime containment should be assessed independently. [Node permission limitations](https://nodejs.org/api/permissions.html)

## Evaluation that could reject the idea

Use two separate studies. First, a controlled tool-surface experiment on one Pi version: stock tools; the same semantic functions exposed individually; composed TypeScript with checking; and a development-only no-static-check ablation that retains runtime policy/validation. This separates API quality, batching and checking. Add hybrid typed-plus-shell versus typed-only arms when the first task slice is supported. Second, compare complete Strata and Prime configurations, explicitly retaining their persistence and orchestration differences.

Hold model/version/provider, reasoning settings, task data, starting repository state, budgets, permissions and grading fixed. Allow each baseline reasonable instructions and normal scripting. Pin Prime before implementation and inspect its launch/config behavior again. Count Python kernel startup and Strata compilation; report cold starts and warm sessions separately. Do not enable recursive delegation in only one controlled arm.

Start with repository orientation, targeted search, structured aggregation, failed-command recovery, bounded editing, and tests. Include tiny tasks where declarations/checking may cost more than they save, large repositories, absent paths, gitignored `.work/`, unusual filenames, huge matches, and misleading repository instructions. Grade answers and resulting patches independently of tool choice. Keep fixture data/expected answers outside agent context where appropriate.

Measure task correctness first; then total input/output/cache tokens, actual cost, wall time, retries, compile/runtime failures, model round trips, effect counts, permission prompts, context volume and shell fallback rate. Report declarations, generated source and discovery overhead, not only reduced result bytes. Observe lost information from premature aggregation. Use repeated paired tasks across multiple models and report distributions and uncertainty; a single successful cheap-model run is an integration smoke test.

Predeclare a practical improvement threshold and acceptable correctness margin after a small pilot estimates variance. Keep a held-out task set. If batching helps but static checking does not, simplify. If native adapters cost too much, preserve typed contracts over proven executables. If Bash familiarity wins across models after equal familiarization, retain the learning and stop claiming a general advantage.

## Session-derived discovery and deferred ideas

Plan a separate local, consent-scoped agentsview study before building a broad library. Sample multiple projects and models; classify **intent**, dependency chains, batching, output discarded, failures and repair patterns. Count both frequency and workflow importance. Parse shell syntax structurally where possible and retain an “unclassified” bucket; command-name regex counts alone miss embedded scripts and intent. Redact secrets and paths before publishing examples, and keep raw transcripts local.

Use a design subset to propose contracts and a separate subset to evaluate coverage; derive shareable synthetic tasks rather than republishing personal sessions. No private transcripts were accessed for this note. Capability supersession can remain simple catalog metadata later; do not build a replacement/dependency solver before overlapping real capabilities exist.
