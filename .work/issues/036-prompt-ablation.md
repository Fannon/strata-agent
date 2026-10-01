# 036 — Prompt-wording ablation for typed instructions

Status: narrow recipe prototype delivered under 060; broader wording/base-prompt ablation remains deferred
Kind: follow-up experiment design; separated from 004 declaration work
Source: user discussion 2026-09-06 — prompt repairs for diagnosed failures
worked (path-prefix echo); general prompt optimization needs its own control.

## Distinction

- **Prompt repair** (done, legitimate): echoing the path convention in the
  runner prompt after four classified formatting misses. Targeted, diagnosed,
  recorded as a protocol change.
- **Prompt optimization** (this issue): testing whether instruction wording
  itself moves cost/success. Only meaningful as an isolated ablation.

## Hypothesis

Terser typed instructions (or a different explanation style) reduce context
cost without hurting success or repair burden. Goal is a fair test, not
making Strata win. A negative result (wording doesn't matter much) is useful:
it says the cost lives in declarations and structure, not prose.

## Constraints

- Pi's base prompt, prompt templates and core files stay untouched; trials
  keep `--no-prompt-templates --no-context-files`. Only the extension's
  appended instructions and the runner's task framing vary.
- Same tasks, model, executor, declarations, caps, policy, guard and ledger;
  only the wording differs between arms. Stock keeps the stock prompt —
  polishing typed instructions while stock gets none would bias the game,
  so any wording arm must be compared against stock too.
- No operation, schema, checker or enforcement changes in the same
  comparison. One variable at a time.

## Proposal (when selected)

- Two instruction variants max (e.g. current explanatory vs. terse
  reference-style), plus the unchanged baseline, on the frozen dev set.
- Predeclared bar and budget before any paid run, same dual ledger.
- Report success, cost/success, repairs and where models still misread.

## Acceptance

A versioned retain/revert decision on instruction wording with complete API
semantics preserved, or an honest inconclusive. No silent prompt drift
between runs: prompts stay pinned per run as today.

Open questions: whether terse instructions harm first-try repair quality
(the 031 loud-error path may interact); whether per-task operation subsets
belong in this experiment or a separate discovery one (separate — see 004).

## October 1 post-054 tuning inventory

The user explicitly asked whether we have a custom system prompt and what could be tuned. The answer is yes: `src/pi/extension.ts` appends fixed Strata instructions and loaded declarations to Pi's base system prompt and supplies tool descriptions/prompt snippets. The separate 054 extension adds task-specific pagination/units/effect-recovery instructions and a clearer return-from-main instruction. That latest experiment did not vary prompts.

Candidate next prompt arms, only if selected: current instructions; terse recipe plus one correct pagination example; a shared example emphasizing inference, concrete response fields and `Map` rather than invented generic wrappers. Examples add tokens and must earn them back. The user subsequently requires a model-independent approach; do not select separate prompts by model.

For a separate dedicated business-agent comparison, trimming/replacing Pi's coding-oriented base prompt is another candidate. This would be a new scope beyond the original above, which intentionally holds Pi's base prompt fixed. Compare equivalent base instructions for both native and Strata, preserve the runtime/tool constraints, and record every effective prompt. Do not mix base-prompt changes with new helpers, checking policies or function loading in the same attribution test.

Prompt profiles are currently code constants rather than a shipped, versioned user-selectable Strata prompt configuration. No prompt changes or paid tuning calls were made in this inventory. Suggested priority: a small correct recipe/example alongside 056's helper design, then an isolated wording test; 059 separately captures function presentation and tool search.

## 060 outcome

The user subsequently authorized the bounded prototype only. See [tuning report](../../docs/strata-tuning-results.md) for the full hypotheses, comparisons, selection, confirmation and decisions, including all success/effect/request/token/time/cost evidence. Existing broader scope and acceptance criteria above remain proposals, not newly selected work. Production defaults are unchanged.
