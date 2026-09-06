# 033 — Mine local agentsview sessions for coverage needs

Status: backlog, suggested (read-only inspection done 2026-09-06, no transcripts copied)
Kind: evidence sampler for 032, concrete input to 013
Source: user suggestion — personal agentsview log as coverage ground truth.

## What was inspected (counts only, nothing copied out)

Local `~/.agentsview/sessions.db` (629 sessions, 2026-07-02 → 2026-09-04):
33,505 tool calls total. Shell dominates: ~26k shell commands
(`exec_command`/`shell`/`bash`), plus 2k reads, 460 greps, 871 edits.

Shell command classification (first-verb + pattern counts over 25,987 cmds):

- 9,239 ranged reads (`sed -n '1,200p'`, `nl`) — the single biggest cluster.
  This is exactly bounded `readText` territory.
- 3,740 searches (`rg`/`grep`) — `searchText` plus future pattern search.
- 3,341 git inspections (`status`/`log`/`diff`/`show`/`blame`) — status done;
  log/diff/show delivered per 028 note; blame untouched.
- 5,171 check runs (`npm`/`bun`/`node`) — future fixed-task runner.
- Long tail: `jq` 252, writes (`apply_patch`/`sed -i`/`tee`) 236,
  network (`curl`/`gh`) 312, `python3` 225.
- 5,559 pipes, 1,712 `&&` chains, 637 loops — composition the typed layer
  must absorb, not one-op-per-flag.

Read-side (read + search + git-inspect) is ~16k/26k ≈ 60%+ of shell use.
That supports the layer order in 032: orient/navigate first, verify next,
change last.

## Proposal

1. Build a local-only miner script (never committed with data, outputs
   counts + verb histograms only) that re-runs this classification per
   session cohort. No raw commands, paths, or file contents leave the
   machine — same rule as the trace sink (sizes/shapes only).
2. Feed the miss classes into the 032 miss log: each uncovered cluster
   (e.g. `jq` slicing, `gh` calls) becomes one frozen record, promoted to
   a capability proposal only on repeat appearance.
3. Keep `013` as the bounded study owner; this issue is its first concrete
   data source. Raw private sessions/profiles stay local per evidence rules;
   publish sanitized counts only.

## Completion criteria (when selected)

- [ ] Miner script + rerunnable counts checked in (code only, no data).
- [ ] Top uncovered clusters filed as 032 miss records.
- [ ] No transcript, command string, path, or secret in repo or artifacts.
