# 018 — Sandbox the bash escape hatch (prime-agent pattern)

Status: backlog
Kind: hardening prototype
Source: prime-agent comparison 2026-09-05 (assistant + user)
Dependencies: none required; coordinates with [005](005-runtime-limits.md)/[007](007-report-bounds.md) trust questions.

## Architecture review correction (2026-09-05)

Preserve this as a conditional prototype, but reject the “last hole” claim below. Pi's direct `read`, `write` and `edit` also bypass Strata's broker, and trusted connectors/extensions have host authority. A bash-only hook cannot mediate every effect. OS sandboxing must be applied at the actual execution boundary; a textual command check cannot infer all filesystem/network effects of arbitrary shell or scripts.

Local Prime source at `5c2750bd...` confirms the sandbox example uses `SandboxManager.wrapWithSandbox` and overrides the bash tool via `registerTool`/custom execution operations. Its header still mentions `tool_call` mutation, but the implementation does not use that hook for the wrapper. The separate permission-gate example does filter `toolName === "bash"`. Neither observation establishes that the default IPython kernel or all other tool effects are covered. Revise the prototype around verified code, not the stale header.

Sequence after 012/011 feasibility as in [020](020-next-sequence.md). Before implementation inventory **all** active effect paths and the external environment's actual protections. Strata supplies no OS sandbox today, but a deployment may have one outside Pi; “full user's OS authority” is an environment assumption. For forbidden writes through arbitrary scripts, acceptance should assert no write occurs under OS enforcement, not pretend every denial can be decided before process spawn. Keep 009's process-group cleanup separate from isolation.

Original proposal follows as history; these corrections govern any selected implementation.

## Confirmed observations

- Pi's normal `bash`/`read`/`edit`/`write` tools are Strata's intentional escape hatch and benchmark baseline; they currently run unsandboxed with the user's full OS authority.
- Prime-agent's `sandbox` example extension shows the pattern: override or mutate the built-in `bash` tool via `tool_call` interception, enforcing filesystem/network restrictions through `@anthropic-ai/sandbox-runtime` (sandbox-exec on macOS, bubblewrap on Linux) with a merged global/project JSON config.
- Strata's brokered runtime already isolates *typed* effects; the gap is exactly the unbrokered shell path.

## Hypotheses (not confirmed)

- A `tool_call` gate on `bash` (deny paths like `~/.ssh`, confine writes to repo/tmp, restrict network) is shippable as an example extension without touching Pi core or the benchmark baseline.
- Bubblewrap is available in the target Linux environments; needs verification, not assumption.

## Open questions

- Gate by default in `bun run pi`, or opt-in example (prime-agent ships it as an example, on by default when loaded)?
- What minimal deny/allow config covers the benchmark's bash usage (twin CLI invocation + JSON plumbing)?
- How do denials surface to the model so stock-Pi baseline failures stay interpretable (see 001's deviation rule)?
- Does sandboxing change baseline numbers enough to require a versioned rerun?

## Related evidence (added after reading 014/prior-art)

The prior-art research pins an instructive detail: Prime's retained permission example intercepts only a tool named `bash`, not effects made through its `ipython` tool — gating one tool does not mediate the other path. Strata is the mirror image with a happier conclusion: every model-facing effect *except* the shell escape hatch already passes the broker, so a bash gate would close the last hole rather than repeat Prime's gap. Coordinates with [012](012-scoped-permissions.md) (read policy first) and [014](014-prime-comparison.md) (full comparison).

## Next step when selected

Verify bubblewrap/sandbox-exec availability, then prototype a `tool_call` bash gate with a tiny default config and one test proving a denied write never spawns.

## Completion criteria

- Denied bash invocations blocked before spawn with a clear, benchmark-legible error.
- Allowed twin-CLI benchmark commands unaffected (A-condition rerun or targeted proof).
- Documented as example vs default, with OS prerequisites stated.
