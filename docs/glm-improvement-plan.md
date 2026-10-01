# Improving Strata after the GLM comparison

October 1, 2026. Inventory after [054](composition-benchmark.md), subsequently updated with completed [060 tuning results](strata-tuning-results.md). The benchmark implementation/results were pushed as `03e77a6`; the inventory was pushed as `730998c` before tuning. Production defaults remain unchanged.

## Subsequent selected implementation

The user next selected structured finalization and action receipts. [Implemented contracts](results-and-recovery.md) now document these shared features and the narrow inferred-return prerequisite. The earlier tuning measurements remain historical; no paid efficacy comparison ran for these additions. Cross-model confirmation and further discovery remain unselected.

## What we tested since this inventory

**Design constraint: one shared approach across models.** The recipe is identical for Muse and GLM on a given task; its example is generated from API schema, not model identity. Model names in result rows identify evaluation conditions. Failures observed with GLM can reveal interface friction to fix for everyone; they do not justify a GLM-specific prompt. Preserve freedom to choose code structure and test shared changes against unseen models before claiming broader generalization.

The user selected bounded prototypes of the prompt recipe, typed pagination helper, alias-only declaration deduplication and smaller diagnostics. **Retain the recipe as an experimental profile.** The helper introduced additional usage/inference repairs and did not meet the cost gate; lean declarations failed the correctness gate; smaller feedback never encountered a compile failure, so its benefit is unmeasured. The [report](strata-tuning-results.md#confirmation-on-new-definitions) records sample counts, success/effects, requests, tokens, time, cost and uncertainty for every arm.

This delivered only the narrow prototypes in 060. Full system-prompt replacement and large-catalog search/load changes remain deferred. Canonical finalization and effect receipts were subsequently selected and implemented as described above. For a further concrete business workflow, finalization addresses the remaining GLM formatting gap; prioritize receipts for critical writes. No further work is selected.

## Starting evidence

GLM low reasoning, 20 distinct definitions × three worlds = 60 attempts per approach. Turns mean model requests. Tokens include input, cached input and output; reasoning is within output. All-attempt averages, time and cost per success include failed work. Answer/state scoring accepts one unambiguous JSON fence; strict scoring additionally requires pure JSON.

| Approach | Answer + state | Pure JSON success | Effects correct | Turns/attempt | Tokens/attempt | Median / P90 seconds | $/attempt | $/scored success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Native Pi | 56/60 | 49/60 | 59/60 | 2.17 | 6,847 | 6.74 / 21.45 | $0.000858 | $0.000919 |
| Checked Strata | 59/60 | 36/60 | 60/60 | 2.57 | 6,004 | 13.16 / 29.92 | $0.000910 | $0.000925 |

Reliability differences remain uncertain; one native primary failure is serialization-only. The full report/data preserve input/output/cache/reasoning totals and paired uncertainty. The original proposals below are preserved as hypotheses; the later tuning report supplies the narrow outcomes summarized above.

## What we already do

The full extension and the 054 benchmark have different tool surfaces. The benchmark deliberately isolates small preloaded business APIs; it does not exercise the full discovery path.

| Area | Full Strata extension today | Latest 054 comparison |
| --- | --- | --- |
| System prompt | Appends fixed Strata instructions and loaded declarations to Pi's existing base prompt; tool descriptions/prompt snippets also guide use | Separate experiment prompt, with pagination, cents/pack units, earlier effects and return-from-main guidance; Pi base prompt retained |
| Functions | Generated TypeScript input/output declarations from JSON Schema; `import {api} from '@c/<module>'` then `api.operation(input)` | Only each task's operations supplied, in one `work` module; full declarations |
| Presentation | Full by default; `STRATA_DECLARATIONS=compact` already exists as opt-in | Full only; no presentation ablation |
| Tool search | `search_capabilities(query, limit)` over the local catalog; lexical, grant-aware results | Not enabled in the checked arm |
| Loading | `load_capability(id)` adds the whole module and returns its import/declarations; grants still govern every call | Operations preloaded by task definition; no discovery |
| Catalog coverage | Demo `cli-twin` catalog loading; directly configured MCP/CLI/repository connections are separate paths | Synthetic in-process business connector |
| Feedback | Quiet success; error diagnostics/call feedback; `program_details` retrieves logs/metrics on demand | Production session feedback, but only typed_program exposed; no program_details tool |
| Checking/runtime | Persistent compiler per session; strict checking before execution; runtime schema/grant validation; fresh QuickJS worker per program | Same production checked session and broker; no checking ablation |
| Ordinary Pi tools | Remain alongside Strata by default; `STRATA_STRICT=1` blocks specified direct tools | Shell/filesystem tools disabled in both arms |

Source references: [extension](../src/pi/extension.ts), [schemas](../src/capabilities/schemas.ts), [catalog](../src/capabilities/catalog.ts), [benchmark extension](../examples/composition/extension.ts).

The custom instructions already explain imports, main/JSON returns, restricted computation, aggregation, diagnostics and discovery. They are a fixed appended prompt, not a measured optimal prompt or a shipped user-selectable prompt-profile system. The production prompt does not yet carry all the benchmark's explicit pagination/effect-recovery guidance. Load responses return at most 4000 declaration characters even though the compiler stores the full module. Large-catalog retrieval quality, complete model-visible contracts after loading and arbitrary MCP catalog loading were not established by 054.

## Prompt and function-presentation tuning we could try

| Candidate | Existing support or proposed change | What to measure / preserve |
| --- | --- | --- |
| Terse workflow prompt plus one correct example | Extend deferred [036](../.work/issues/036-prompt-ablation.md); emphasize return values, complete pagination, inferred types/Map and effects surviving later errors | Extra example tokens versus fewer repair turns; same schemas/checking/permissions |
| Dedicated business base prompt | A separate prompt test could trim Pi's coding-oriented base instructions; current Strata only appends instructions | Apply equivalent base context to native Pi; verify host integration and actual effective prompts |
| Typed pagination helper | Proposed 056; keep precise row inference | Source/output savings and repair reduction versus added declarations/helper complexity |
| Alias-only declaration deduplication | Full mode currently repeats the same body under both import prefixes; compact mode already deduplicates but also changes array-cap representation | Test deduplication separately, with import/type parity; avoid attributing every compact effect to shorter text |
| Short signatures/examples with full compiler types retained privately | Proposed model-facing presentation variant | Exact usable types/fields and semantic constraints must remain discoverable; compiler context alone does not teach the model an API |
| Named imports or clearer type names | Proposed alternative to generated Op/Input/Output namespaces and the api object | Writing/inference mistakes, collision handling, declaration size and compatibility |
| Tiny preload plus tool search | Existing search/load can support a catalog test; arbitrary MCP entries would require new adapter work | Retrieval misses, extra turns and all costs versus input reduction; do not restrict the baseline's useful tools |
| Operation-level describe/load | Proposed granularity beyond current whole-capability loading | Keep needed operations/types available, enforce the same grants and count search/load overhead |
| Better search matching or description caching | Proposed only if retrieval/context measurements show a need | Rank/recall, unrelated loads, stale contracts and long-session growth; embeddings/graphs are not automatically justified |

Function-presentation/discovery candidates are captured in [059](../.work/issues/059-function-surface-and-discovery.md). Compact declarations were explored earlier under [004](../.work/issues/004-harness-tuning.md): an encouraging development result did not survive the cost-per-success confirmation, so compact remains opt-in. It has not been tested against 054's two-model business corpus. 054 did not tune prompt wording; 060 subsequently tested the narrow recipe prototype, with results above. Broader prompt wording/base-prompt work remains deferred.

For the present small task-scoped APIs, pagination/inference and prompt clarity are more directly connected to GLM's failures than tool search. Search deserves a separate workload with many irrelevant capabilities; it adds retrieval turns and may miss necessary tools. We should not bundle prompt wording, helper code, declaration layout and discovery into one comparison if we want to identify what helped.

## Original proposed working order before 060

| Priority | Change to investigate | Why | Tracked issue |
| --- | --- | --- | --- |
| 1 | A short correct workflow example, then a tested typed pagination helper | Reduce repeated cursor/generic-type work without discarding row types | [036](../.work/issues/036-prompt-ablation.md), [056](../.work/issues/056-typed-pagination-helper.md) |
| 2 | Smaller compiler feedback with the expected API shape | Help repair the underlying error rather than every downstream symptom | [057](../.work/issues/057-actionable-compiler-feedback.md) |
| 3 | Receipts identifying effects completed by this attempt | Keep payment claims tied to observed new actions after later code/answer mistakes | [053](../.work/issues/053-recovery-action-identity.md) |
| 4 | Explicit finalization of a structured result using host JSON serialization | Avoid asking the model to reproduce correct data as JSON again | [058](../.work/issues/058-canonical-final-json.md) |
| Separate diagnostic | Hold interface/guards fixed while varying checking | Measure the gate's cost independently from these improvements | [055](../.work/issues/055-checking-attribution.md) |

For a write-heavy business use case, move effect receipts ahead of compiler presentation work. [052](../.work/issues/052-main-result-contract.md) remains a separate result-contract prerequisite when designing finalization; it is not the main observed repair cost in 054.

### 1. Let the model concentrate on the business rule

Nineteen of the 60 checked GLM attempts encountered compilation rejection, producing 28 rejected programs. Sixteen rejected programs declared their own pagination helper. Their names were `all`, `page`, `pageAll`, `paged`, `listAll`, `paginate` or `pageno`. The diagnostics include wrong response fields (`items`/`rows`), mismatched generic function types and unknown page/row values. These counts describe the existing failures; they do not estimate a helper's benefit.

A possible interface is:

```ts
// Proposed helper, not an API that exists today.
const invoices = await collectPages(api.listInvoices, page => page.invoices);
```

The helper would handle cursor termination and infer invoice rows. GLM would write the filtering/join/payment rule, with less need to invent generic TypeScript. Each page must still pass the existing broker, validation, permissions and execution budgets. Repeated cursors and excessive records need bounds. Keep types precise: returning `any[]` would weaken the missing-field protection relevant to the native overpayments.

060 tested both independently with Muse and GLM: retain the inline recipe experimentally; the generic helper did not earn promotion. More SDK surface was not automatically cheaper. The original helper hypothesis remains useful context, not a recommendation to ship this design.

### 2. Make checking easier to repair

GLM's rejected programs produced 161 reported diagnostics, including 63 TS18046 messages about unknown page/row values. Generic-helper mistakes can generate several downstream messages. The earlier report's phrase “unknown caught errors” was inaccurate for these messages and has been corrected.

Useful feedback could say which call/result shape failed, show the relevant fields and state that no calls from this program ran. Remaining diagnostics can be available on demand with full local audit evidence. A later source-patch facility might reduce complete-program rewrites, but would be a separate implementation choice.

Keep checking before execution while trying this. Relaxing strictness or adding `any` everywhere can remove repair messages by also removing protection. A selective compiler-policy experiment belongs under 055 and needs explicit contracts and controlled attribution; the present data do not justify changing the default.

### 3. Make completed actions easy to report correctly

In W1 checked GLM repetition 2, the first program correctly made five payments but returned an empty list after applying an incorrect ledger-entry-count filter. The model later inspected invoices that were now paid and concluded that it had added no payments. This was a wrong report about correct effects, not an uncertain backend reply.

A useful receipt would identify the program/attempt and observed new action: payment ID, invoice ID, amount and outcome, where those fields are available and appropriate. Preserve an explicit uncertain outcome when a reply is lost; a call attempt is not a confirmed effect. Backend idempotency identifiers and before/after inspection can help where supported. Readable state alone does not tell the agent which actions belong to this request.

Receipts add context and require careful provenance. Do not infer completion from an old matching payment, or claim success from a type-correct predicate. This extends existing issue 053 rather than authorizing a new ledger implementation.

### 4. Avoid losing correct answers during final formatting

Twenty-three checked GLM attempts had correct answer content/effects but failed pure JSON compliance because of wrappers. The runtime already carries a structured result; an explicit finalization path could serialize the selected result in the host and deliver a separate explanation if wanted.

The selected result must be explicit and auditable. Automatically using the last successful tool result could deliver an intermediate, empty or stale answer. Canonical serialization fixes formatting, not incorrect business rules or the W1 reporting mistake. Actual host integration and finalization overhead need verification before implementation.

## Decision

**First try a small, precisely typed pagination helper while keeping the compiler and state checks.** This targets repeated implementation work visible in the GLM failures. Smaller diagnostic feedback and action receipts are complementary. Keep the frozen benchmark results; any authorized efficacy test needs a new version, disjoint development material and untouched evaluation tasks, with success/effects, requests, tokens, time and all costs reported.

No code, compiler settings or benchmark scores changed in this documentation review. No paid model calls were made. The issue board owns selection; the order above is a recommendation.
