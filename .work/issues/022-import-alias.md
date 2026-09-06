# 022 — `@c/` import alias for capability modules

Status: done; both @c/ and @cap/ supported
Authorizes: user request "`@cap` is already taken in my mind" → support `@c/` as alias.

## Decision

Support both prefixes; advertise `@c/` as primary:
- `src/capabilities/schemas.ts` emits `declare module "@cap/<id>"` **and**
  `declare module "@c/<id>"` with identical API bodies (separate ambient
  scopes, so duplicated `OpN` namespaces do not collide).
- `src/compiler/workspace.ts` accepts `@c/` and `@cap/` imports.
- `src/runtime/worker.ts` resolves both prefixes to the same surface.
- `src/pi/extension.ts` returns `@c/<id>` from `load_capability` and prompts
  `@c/` first, noting `@cap/` still works.
- `src/generated/fixture.d.ts` regenerated via `bun run generate`.

Backwards compat: existing `@cap/` programs, transcripts, docs and benchmark
prompts keep working. New prompts/docs prefer `@c/`.

## Completion criteria

- [x] `bun run check` passes
- [x] `bun test` passes — 53/53 (updated `pi-catalog` exact-match to `@c/`)
- [x] Manual: `@c/fixture` and `@cap/fixture` both execute; non-cap imports rejected
- [x] `bun run generate` output committed (`src/generated/fixture.d.ts` now declares both)
