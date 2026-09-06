# 025 — Catalog load vs session shutdown race

Status: backlog
Kind: robustness follow-up from 016
Source: 016 acceptance item "inspect search/load cancellation separately".

## Observation

`load_capability` does not take Pi's abort signal, and `session.load()` has no
abort/shutdown guard: `broker.addModule` + `connectors.push` run unconditionally.
If shutdown interleaves between `buildEntryConnector` and `load()` (or during
`load()`), the module registers on a discarded session and its connector misses
the close loop's `Promise.allSettled` pass — a connector/process leak. `search`
is synchronous and has no cancellation point; nothing to do there.

`load()` after `close()` today does not throw; the workspace/broker accept the
module silently.

## Options

- Guard `load()` against post-shutdown registration (throw + caller closes the
  built connector), and/or forward the tool abort signal into the connector
  build so a cancelled load closes its subprocess.
- At minimum assert current behavior with a test so the race is characterized.

Not on the critical path for the 011 slice; fix when catalog loads happen
during real long-running sessions.
