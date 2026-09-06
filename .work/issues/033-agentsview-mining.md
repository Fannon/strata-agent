# 033 — Mine local agentsview sessions for coverage needs

Status: backlog, suggested (read-only inspection done 2026-09-06, no transcripts copied)
Kind: evidence sampler for 032, concrete input to 013
Source: user suggestion — personal agentsview logs as observational coverage input, not counterfactual ground truth.

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

The reported read-side clusters total roughly 16k mentions, but classifications may overlap and first-verb heuristics miss composition. Without a reproducible classifier and manual validation, these counts do not establish a 60% workflow-coverage rate. They are useful leads for 013/032, not proof of a typed advantage.

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

## First miss record: `jq` slicing (resolved without a new op)

Sampled 200 `jq` commands from the log (counts only). The shapes repeat:

- Pick a field: `jq '.action' manifest.json`, `jq '.main' params.json`
- Slice: `jq '.bookmarks[:5][] | .originalId' chrome.json`
- Filter: `jq '.bookmarks[] | select(.originalId=="23")'`
- Inspect shape: `jq 'keys' params.json`, `jq '.' file.json | head`
- Chain from network: `curl ... | jq '.items[0:10][].full_name'`

Resolution: **no new capability.** Every one of these is plain TypeScript
over a parsed value the program already holds:

```ts
// bash: jq '.bookmarks[:5][] | .originalId' chrome.json
const { content } = await api.readText({ path: "popup/mockData/chrome.json" });
const data: unknown = JSON.parse(content);
if (typeof data !== "object" || data === null || !("bookmarks" in data) ||
    !Array.isArray(data.bookmarks)) throw new Error("Expected bookmarks array");
return data.bookmarks.slice(0, 5).map((b: unknown) => {
  if (typeof b !== "object" || b === null || !("originalId" in b) ||
      typeof b.originalId !== "string") throw new Error("Expected originalId");
  return b.originalId;
});
```

What makes this safe (and what to watch):

- `readText` bounds bytes; ordinary JSON parsing materializes values. Do not assume ordinary `jq` queries are streaming; a streaming algorithm requires an explicit design. Large-file JSON stays an unverified coverage gap.
- `JSON.parse` returns `any`: it bypasses useful static guarantees (Topic 3 rules — the
  broker still validates capability inputs/outputs), but a type assertion does not validate parsed data. Bind to `unknown` and narrow/check the required fields before relying on them.
- `curl | jq` chains split in two: network fetch is a future wrapped
  capability (allowlisted hosts, byte caps), JSON slicing stays plain code.

If a second task family needs the same shape (e.g. `R-JOIN` over manifests),
a worked `readText` + `JSON.parse` + narrow example goes in docs, not a new
op. Promotion rule from 032 holds: one task is not enough for new surface.

## Completion criteria (when selected)

- [ ] Miner script + rerunnable counts checked in (code only, no data).
- [ ] Top uncovered clusters filed as 032 miss records.
- [ ] No transcript, command string, path, or secret in repo or artifacts.
