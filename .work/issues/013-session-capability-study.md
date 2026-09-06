# 013 — Learn composable operations from local agent sessions

Status: optional bounded study ready; preliminary counts recorded in 033, reproducible workflow study not delivered
Kind: observational research and task-corpus design
Source: user's agentsview idea.
Dependencies: none; feeds 011 and 009.

Only CLI help was inspected, no private transcripts. Installed agentsview v0.35.2 supports JSON and project/date/agent filters; verify actual output schema when selected.

```sh
agentsview session list --project strata-agent --date-from 2026-09-01 --limit 30 --json
agentsview session tool-calls SESSION_ID --json
agentsview session usage SESSION_ID --json
```

The project filter is a pilot example, not the representative final corpus. Choose an explicit local project/date scope; use existing data without unnecessary remote sync. Broader private scope needs its own selected scope.

## Plan and acceptance

- [ ] Sample about 30 sessions across at least 3 projects and multiple available agents/outcomes. Document exclusions, missing data and automated/child-session double counting.
- [ ] Keep raw extraction under `.work/session-study/`; sanitize paths, prompts, commands and credentials before tracked output.
- [ ] Parse shell AST/tool families; retain unclassified embedded scripts. Never execute logged commands or split shell on semicolons.
- [ ] Classify intent, dependencies, batching, output consumption, parsing burden, failures/retries and permissions; manually verify a sample.
- [ ] Rank workflows by coverage, cost and failure burden, not command counts alone. Propose API contracts plus example compositions.
- [ ] Hold out projects/date windows before design and derive sanitized seeded benchmark tasks.

Deliver extractor/query recipe, sample manifest, checked taxonomy, prioritized contracts and coverage/uncertainty report. Observational traces reflect existing tools and cannot establish counterfactual TS performance; 009 must test that.
