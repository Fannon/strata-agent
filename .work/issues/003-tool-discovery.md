# 003 — Research dynamic tool discovery and dependencies

Status: done (2026-09-05; research + spike + production wiring)
Kind: brainstorm/research first; implementation requires a later selection
Source: user feedback, 2026-09-05
Dependencies: none for research; [001](001-benchmark.md) for comparative evaluation.

## Current interpretation (2026-09-05 reconciliation)

The minimal search/load implementation is done. Original research/spike next steps below are history, not pending wiring. Source has handwritten `assertMeta` shape checks, not AJV validation of the catalog metadata shape; operation input/output schemas are compiled with AJV in the broker. Hot-add generates declarations before broker mutation; it is not a proven transaction across concurrent loads/shutdown. DependsOn/related metadata is accepted but no dependency closure is resolved. The separate live condition-D demonstration is not a committed benchmark condition.

MCP catalog entries, closure resolution and advanced retrieval remain deferred. The old ~50-entry SQLite trigger is only a heuristic; measured ranking/indexing pressure should justify migration. Supersession is captured in [017](017-capability-relationships.md). Focus on native usefulness and reliable evaluation before expanding discovery.

## Goal

Keep only a small core of tools always loaded into context, following Pi's philosophy. Discover additional capabilities when needed, then make their typed APIs available. Explore whether dependencies between tools can improve search and loading.

## User ideas to preserve

- A tool-search operation alongside a deliberately tiny always-loaded set.
- Investigate best practices, including graph-assisted retrieval / graph RAG.
- Tools may have mandatory or optional dependencies that search can return alongside matches.
- Start simple and without a database if possible; investigate useful Bun facilities.
- Compare later SQLite and local-filesystem approaches before choosing storage.

These are candidates for research, not claims that graph RAG or a database is necessary. Bun's current built-in facilities and library compatibility should be verified against primary documentation when the issue is selected; no such research has been done here yet.

## Selected path: C, co-design (2026-09-05)

Chosen over A (design-only, defers everything) and B (blind wiring, certain rework). Rejected alternatives recorded: A leaves measurement to chance; B ships unmeasurable surface.

Seam choice: split the twin — always-loaded core (`customers`, `invoices` as capability `cli`) with `records` discovered on demand (capability `cli-records`). Rationale: `records` is the heavy operation (2 MB payloads, the byte-reduction story), so on-demand loading is semantically motivated, not arbitrary; and T3 becomes the built-in discovery task (condition D) without inventing new data. v1 baseline comparability is preserved by keeping the full-twin `cli-twin` transport untouched — discovery runs are a new condition, never a silent replacement of B/C.

Consequences accepted: the extension grows two always-loaded tools (`search_capabilities`, `load_capability`) — a context-cost tradeoff 004 may revisit; the broker becomes multi-module (same-named ops isolated per capability); catalog schemas duplicate twin schemas as literals (parity-tested). Dynamic authorization explicitly out of scope: loading never grants invocation, the static allowlist still gates every call.

## Production outcome (2026-09-05, path C)

Wired and verified. Broker is multi-module (`surfaces()` feeds worker bindings); `Workspace.setDeclarations()` enables hot-add; `session.load()` regenerates declarations and returns the new import block (declaration failures run before the broker mutation, so no partial state); extension registers `search_capabilities` + `load_capability` over a statically-extracted catalog index built at `session_start`. `STRATA_CONFIG` catalog shape: `{transport:"catalog", preload: [...], allow: {id: [...]}}`. Loading refuses unlisted ids; only `cli-twin` transports load (clear error otherwise); `load` closes connectors on failure; `close()` drains all connectors.

Evidence: 41 pass / 0 fail (new: multi-module isolation incl. same-name shadow, mid-session load with pre-load compile failure, full extension lifecycle search→load→typed records, catalog↔twin schema parity). Live condition-D run with a real model (preload core only): search → load → composed program → `{"total": 10000, "selected": [99,199,299,399,499]}` — notably with the correct total the v1 T3 wording failed to elicit, supporting the 004 wording hypothesis. v1 baseline untouched: full-twin transport and all B/C artifacts unchanged.

Deliberately deferred: dynamic authorization (static allowlist still gates everything), MCP-backed catalog entries, FTS5 migration (trigger stands), dependency auto-pull (`related` is display-only).

## Selected variant (2026-09-05 discussion): single-file TS catalog

Decision: one file per capability exporting a standardized `meta` const (pure data: id, description, operations with schemas, `dependsOn`/`related` edges) alongside its bindings (code: `toArgs` mappers, connector wiring). Rationale: single-file DX with typechecking (`as const satisfies CapabilityMeta`), no separate descriptor file to drift.

The safety condition: **search must not execute**. The loader extracts `meta` *statically* via the TypeScript compiler API (already a dependency) — only JSON-compatible literals are accepted; anything computed throws a clear error. Module import happens solely on `load_capability`, through the normal broker path. Enforcement layers: `satisfies` at author time, AJV shape validation of extracted metadata at index time, static-only extraction (plus an optional top-level-side-effect lint later). Trust rule preserved: search yields data, loading executes code, invocation still needs the allowlist.

Spike scope (no production wiring): `catalog/` file(s) in the new format, `extractMeta` + lexical `searchCatalog`, tests proving non-execution and load-path viability. Extension `search/load` tools and hot-add consistency remain future work pending spike outcome.

## Spike outcome (2026-09-05)

Built and pushed: `catalog/cli-twin.ts` (single file: literal `meta` + `bindings`), `src/capabilities/catalog.ts` (`extractMeta` via the TS compiler API, `loadCatalogFile`, lexical `searchCatalog`), twin session helpers re-based on the catalog file, 5 tests — full suite 38 pass / 0 fail, demo and `generate` unaffected.

- Non-execution proven: a marker module's `meta` extracts while its top-level side effect never runs; computed `meta` (identifiers, calls) is rejected with a pointer to bindings.
- Real constraint found: schema-builder helpers *cannot* be used inside `meta` (they are calls, so extraction rejects them) — catalog schemas must be inlined literals. Verbose but honest; a build step generating catalog files from builders is the documented alternative if authorship friction bites.
- Load path proven: extracted `meta` + imported `bindings` form a working broker session (typed `customers` call returns `["c1"]`).
- Remaining for production: extension `search_capabilities`/`load_capability` tools, atomic manifest/declaration/binding hot-add, persistence choice (files now, FTS5 at the documented trigger). None started.

## Research note (2026-09-05, no implementation)

**Primary evidence.** `bun:sqlite` is built into the runtime ([docs](https://bun.com/docs/api/sqlite)); verified locally on Bun 1.4.1: SQLite 3.53.2, `FTS5` virtual tables work, BM25-style `MATCH` queries return ranked rows, plain edge tables work — zero dependencies. So persistence/FTS is available for free *if* a catalog ever outgrows files.

**GraphRAG assessment.** Microsoft's [GraphRAG](https://microsoft.github.io/graphrag/) ([paper](https://arxiv.org/pdf/2404.16130)) is an LLM-indexing pipeline (knowledge-graph construction with GPT-4-class models, prompt tuning, global/local/DRIFT query modes) aimed at sensemaking over large narrative corpora. Verdict: disproportionate for a tool catalog. It buys nothing at catalog sizes of tens of entries and adds an LLM-dependent indexing step, tuning surface, and eval burden. Revisit only with measured retrieval failures at a scale where lexical methods demonstrably break. Same verdict for embeddings-based retrieval: needs a model/service plus relevance eval with no demonstrated need.

**Feasible designs.**

- **A — file catalog + lexical search (recommended for the first prototype).** One JSON/Markdown file per capability (id, short description, operation/input-output summaries, `dependsOn` mandatory vs `related` optional edges). One always-loaded Pi tool `search_capabilities(query)` returning top-k descriptors with match snippets; `load_capability(id)` regenerates declarations, updates the compiler workspace, and extends broker bindings in one atomic step (compiler/broker/executor update together; programs in flight keep the old snapshot). Dependency expansion is bounded (depth ≤ 2, closure cap, cycle guard); loading never grants invocation — the allowlist still gates every call, and search may describe denied tools.
- **B — bun:sqlite catalog + FTS5 (defined upgrade path).** Same tool surface and edge semantics; storage moves to `bun:sqlite` with an FTS5 index over descriptions and an edges table. Trigger to switch: catalog > ~50 entries, or A failing the evaluation below. Migration is storage-only by construction.

**Recommendation:** build A when selected; keep B as the documented fallback with the trigger above; do not build graph/semantic retrieval without eval evidence.

**Non-goals:** package manager, version resolution, auto-installing dependencies, inferred edges, untrusted-description sandboxing beyond "descriptions never authorize" (already the broker rule).

**Evaluation plan (shared by both):** matching (query → expected capability id, incl. paraphrases), missing-dependency and cycle handling, bounded-expansion caps, stale/invalid-schema rejection, and policy preservation (loaded-but-denied calls fail as `policy`; denied tools searchable but not invocable). Measure relevance, extra context bytes, and downstream T1–T4 pass rates against the 001 baseline — not subjective search quality.

## Original questions for the research

### Discovery contract and context budget

What belongs in the always-loaded core: typed_program plus one search/load surface, or a slightly different split? How can search return short descriptions and input/output summaries without inserting a whole catalog into context? Should search and install/load be distinct actions? What becomes visible after loading: declarations in the next prompt, targeted descriptions, or another representation?

### Dependency meaning

Separate mandatory installation/runtime dependencies from optional related tools and workflow suggestions. A useful companion tool is not automatically a dependency. Who supplies each edge, how is it versioned, and how reliable is it? How do cycles, missing dependencies and large transitive closures behave? Loading a dependency must not automatically grant permission to invoke it.

### Retrieval strategy

Start by comparing a simple lexical/tag search against more elaborate retrieval. Does a small explicit dependency graph plus bounded expansion help before embeddings or graph RAG? What would justify semantic retrieval? How do we measure relevance, missed dependencies, extra context and downstream task success rather than just subjective search quality?

### Storage and Bun

Research these alternatives without assuming a winner:

| Candidate | Questions to resolve |
| --- | --- |
| In-memory catalog loaded from JSON/Markdown files | Is this enough for the initial catalog? How are updates and schema versions handled? |
| Filesystem catalog and generated index | Can it stay easy to inspect and version while supporting reliable lookup? |
| Bun-supported local storage / SQLite | What is actually built in today? Does it simplify indexing, full-text search or graph edges enough to justify persistence? |
| Graph/semantic retrieval | What catalog size and failure evidence justify the extra machinery? |

An explicit graph can simply be nodes and edges in memory/files; graph structure does not itself require a graph database or graph RAG. Conversely, choosing SQLite does not choose a retrieval algorithm.

### Installation and runtime consistency

How are normalized manifests, declaration sets, compiler state and runtime bindings updated together? What happens if a program starts during an update? Can search remain useful for denied tools without implying authorization? How are stale metadata, invalid schemas and untrusted descriptions handled? Define these questions narrowly for the first discovery slice rather than designing a package manager.

## Proposed first experiment, subject to research

A tiny local catalog, deterministic lexical search, explicit mandatory/optional dependency lists and bounded result expansion. Load one capability and demonstrate that a subsequent TypeScript program can import it while broker policy still applies. No database, embedding service or inferred graph unless research supplies a concrete reason.

## Next step when selected

Produce a short research note with primary-source citations, at least two feasible designs, a recommendation, non-goals and a small evaluation plan. Then decide whether to implement a prototype. Do not start the prototype merely because the research is finished.

## Completion criteria for the research stage

- Clear distinction between discovery, dependency resolution, loading and authorization.
- Evidence-backed comparison of simple files/in-memory storage and Bun/SQLite options.
- Explicit case for or against graph-assisted retrieval in the first iteration.
- Proposed minimal API and context budget.
- Evaluation cases for matching, missing/cyclic dependencies, bounded expansion and policy preservation.
