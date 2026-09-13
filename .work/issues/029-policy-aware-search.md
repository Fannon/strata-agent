# 029 — Policy-aware capability search

Status: implemented with review corrections (2026-09-13, per supervisor clarification in `.work/pi-agent/029-prompt.md` plus `.work/pi-agent/029-review.md`)
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

## Decision (supervisor clarification, implemented as-is)

- Hide-by-default (Option A without the count): search omits modules whose
  `allowFor` is `undefined`, whose grant set is empty, or whose grants name
  no declared operation. Search requires a live session/resolver and fails
  closed otherwise (e.g. after shutdown).
- Filter the catalog **before** search ranking/`limit`, so denied hits cannot
  crowd out allowed hits.
- Filter operation metadata to allowed operation names before
  matching/output; module id/description stay discoverable when some
  declared operation is granted.
- **No `hiddenByPolicy` count** — explicit choice: the count is not needed
  for agent actions and would expose denied catalog size.
- Search remains static (extracted `meta` only, never imports/invokes
  modules); `load_capability` and catalog `preload` reject empty grant sets
  exactly like absent ones, and reject grants naming no declared operation
  as granting no known operations. Grants are validated before cached load
  responses. Discovery filtering is UX only: load returns full module
  declarations alongside a grant-filtered operation list; broker enforcement
  unchanged.

## Completion criteria

- [x] Search results exclude capabilities the current config would refuse to
  load (hide-by-default; no count, per decision above), including grants
  naming no declared operation. Search fails closed without a live
  session/resolver.
- [x] Integration tests through actual registered Pi tool handlers
  (`test/integration/pi-search-policy.test.ts`): absent/empty/unknown-op
  grants, limit crowding (`"customers records"` limit 1 returns `cli`
  when `cli-records` is denied — denied hit genuinely outranks allowed
  unfiltered), search/load refusal after shutdown, and load refusal with
  preload fail-fast for grants naming no declared operation; partial load
  output lists only granted operations alongside full declarations, and the
  denied call still fails at broker policy.
- [x] Docs: note in `README.md` discovery section.

Not on the critical path for 028 tasks or matched trials. Small, independent,
no paid model run needed.
