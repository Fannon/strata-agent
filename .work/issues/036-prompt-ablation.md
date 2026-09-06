# 036 — Prompt-wording ablation for typed instructions

Status: backlog, idea only (do not start with current slices)
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
