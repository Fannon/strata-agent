# 006 — Docs/DX polish and repo hygiene

Status: done (2026-09-05)
Kind: small docs/hygiene batch
Source: review 2026-09-05 (assistant + user)
Dependencies: none.

## Current interpretation (2026-09-05 reconciliation)

The small DX slice is complete (`915fda9` and current source): AGENTS is tracked, config treats unset/empty/whitespace explicitly, troubleshooting exists, and fixture declaration drift is tested. Statements below saying these remain open are historical. New value-proposition/current-scope corrections are covered by [010](010-concept-and-roadmap.md); cancellation behavior remains [016](016-pi-cancellation.md), not a documentation fix.

## Confirmed observations

- `AGENTS.md` exists in the working tree but shows as untracked (`git status ??`). It should be committed if it is the intended checked-in workflow file.
- `examples/agent-smoke.ts` selects the fixture by passing `STRATA_CONFIG: ""`, which works only because `configuredSession()` treats empty string as falsy. This is undocumented and fragile.
- No troubleshooting section for: Bun version requirement, `STRATA_CONFIG` must be an absolute path, `OPENROUTER_API_KEY` only needed for `test:agent`.
- No drift check that checked-in `src/generated/fixture.d.ts` matches `bun run generate` output.

## Hypotheses (not confirmed)

- A short troubleshooting section reduces onboarding retries.
- A generated-declarations drift test catches stale check-ins earlier than manual review.

## Open questions

- Should the smoke runner use an explicit `STRATA_FIXTURE=1` / unset `STRATA_CONFIG` instead of empty string, or should `configuredSession()` reject empty string with a clear error?
- Drift test as a `bun test` case or a `bun run check`-style script?

## Next step when selected

Small batch: commit `AGENTS.md`, clarify fixture selection, add troubleshooting to `README.md`, add drift assertion. No harness behavior change.

## Fix applied 2026-09-05

`bun run pi` failed when the user had a broken global `npm:pi-lean-portal` package: Pi extension discovery aborted before Strata loaded. Fixed `package.json` `pi` script to pass `--no-extensions` (explicit `-e ./src/pi/extension.ts` still loads). Verified `bun run pi -p "Use typed_program ..."` returns `["i0"]` via 2 capability calls. Remaining 006 items (AGENTS.md tracked, smoke fixture selection, troubleshooting docs, drift test) still open.

## Completion criteria

- `AGENTS.md` tracked; `git status` clean apart from intended untracked work.
- Fixture selection is explicit (no empty-string falsy reliance) and documented.
- `README.md` troubleshooting covers Bun version, absolute `STRATA_CONFIG`, smoke-test key.
- Stale `fixture.d.ts` fails `check` or tests deterministically.
- DONE 2026-09-05: README "What the model sees" box (one Pi tool vs. many `api.*` functions vs. bash as baseline) added per user selection.
