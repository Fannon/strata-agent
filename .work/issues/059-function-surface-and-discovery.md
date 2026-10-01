# 059 — Compare function presentation and incremental discovery

Status: DEFERRED — user requested an inventory and tuning ideas after 054; no implementation or paid benchmark selected
Dependencies: 003/029 implemented catalog search/load; 004 declaration presentation; 054 current baseline

## What exists

The full extension appends loaded module declarations to Pi's system prompt and exposes `search_capabilities`, `load_capability`, `typed_program` and `program_details`. Search is deterministic lexical token overlap over local capability ids/descriptions and operation names/descriptions, filtered by configured grants before ranking/limit. Load installs a whole capability module; its returned operation list is grant-filtered, but declarations include the full module. The load response clips its declaration text to 4000 characters, while the compiler stores the full module; this model/compiler presentation difference deserves explicit coverage in any larger-catalog test. Catalog loading currently supports the `cli-twin` demonstration transport, not arbitrary MCP catalog entries. Directly configured MCP sessions are separately implemented.

Default full declarations duplicate the API body for `@c/` and `@cap/` aliases. Opt-in compact mode re-exports one alias and changes static array-cap representation while preserving broker validation. The 054 benchmark instead preloaded task-defined operation subsets with full declarations and exposed only typed_program in the Strata arm. It did not evaluate search, loading or a large unrelated catalog.

## Hypotheses and candidate experiments

1. Alias-only deduplication may reduce context without compact mode's separate array-cap change. Keep generated/compiler declarations semantically equivalent and verify import/type behavior.
2. Function-level search/describe/load could reduce irrelevant declarations versus whole-module loading, at the cost of retrieval requests and potentially missed required operations. Keeping the full compiler contract privately and exposing concise model-facing descriptions is another distinct presentation variant, not automatic proof of equivalence.
3. Named function imports, clearer domain type names, or a short signature/example view may be easier for a smaller model than repeated generated namespace definitions. Preserve collision handling and exact usable type names.
4. A small preloaded core plus lazy discovery may beat full preload for genuinely large catalogs. Search relevance (synonyms, operation-specific semantic constraints) must be evaluated before adding embeddings or graph infrastructure. Do not choose the task's operation subset from hidden answers.
5. Explicit versioned caching/eviction of model-facing descriptions may help long sessions; current load grows the session's declarations, and there is no implemented unloading policy.

## Scope and acceptance if selected

Choose one factor per comparison, freeze grants/data/prompts/checking/limits, and retain native Pi's equivalent access. Use both models, disjoint development material and new task definitions. Measure retrieval recall and wrong/extra loads as well as task answer/effects, requests, tokens/cache, median/P90 time and all costs. Include retrieval failures and added round trips. Keep 054 unchanged. Larger catalog adapters and ranking engines require their own selected scope; this inventory does not authorize them.
