# 029 — Policy-aware capability search

Status: backlog, ready (small slice)
Kind: UX / discovery follow-up to 003
Source: user discussion 2026-09-06 — search offers capabilities that load then refuses.

## Observation

`search_capabilities` searches the static catalog index without knowing the
operator allowlist (`allowFor` in `src/pi/extension.ts`). `load_capability`
checks `allowFor(id)` and fails with `Capability "x" is not in the configured
allowlist; loading it would grant nothing.`

There is no security hole — showing an id never grants a call, and every
`api.*` call still passes broker policy + schema validation. But it is bad UX:
we offer something that is guaranteed to fail on load.

Search currently returns `{ id, description, matchedOperations, loaded }`.
It has no `allowed` signal.

## Proposal

Wire `allowFor` into the search handler (`src/pi/extension.ts` ~line 352):

- Option A (preferred default): hide not-allowed hits, plus a count such as
  `"hiddenByPolicy": 1` so the omission is not silent.
- Option B: keep hits but annotate `allowed: false` with a short reason, so
  the model understands why load would fail and can ask the operator.

Either way: no behavior change to enforcement. Loading still checks the
allowlist. Search never executes module code (static `meta` extraction only).

Edge cases: default fixture config (`allowFor: () => fixtureAllowed`) allows
everything in the fixture, so nothing is hidden there. Catalog config with
per-id `allow` is where filtering matters. `preload` ids that are not allowed
already fail fast at startup via `refuse()` — keep that.

## Completion criteria

- [ ] Search results exclude or clearly mark capabilities the current config
  would refuse to load.
- [ ] Unit test: catalog config allowing only `cli` — search for `records`
  either omits `cli-records` (with hidden count) or marks it not-allowed;
  load still refuses as today.
- [ ] Docs: one-line note in `README.md` discovery section.

Not on the critical path for 028 tasks or matched trials. Small, independent,
no paid model run needed.
