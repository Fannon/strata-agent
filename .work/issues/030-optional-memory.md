# 030 — Optional agent memory outside typed runs

Status: backlog, idea only (do not implement with current slices)
Kind: follow-up, memory vs observability split
Source: user discussion 2026-09-06 — keep runs stateless for now, revisit memory as opt-in.

## Idea

Typed programs stay stateless: fresh worker per run, no variables between runs.
If agents later need memory (“what did I find earlier?”), add it as an
explicit opt-in capability — not by keeping workers warm and not by mixing
developer traces into model context.

Prefer a standard Pi mechanism first (skills, memory extension, or other
existing Pi extension) before building a Strata-owned store. Only if no
suitable Pi extension covers it, design a small `memory` capability with tight
schemas (e.g. store small named results the program explicitly returns, not
automatic full capture).

## Constraints

- Developer trace (`STRATA_TRACE_FILE`, sizes/durations/outcomes only) stays
  out of model context and never stores source, args, paths, or contents.
- Any memory capability needs its own allowlist, byte caps, retention/forget
  rules, and secret handling. Automatic capture of everything is out of scope.
- Runs stay stateless by default. Memory is opt-in per session/config.
- Revisit only after 028 tasks show a concrete need (e.g. multi-step work
  that re-reads the same evidence). No warm-session or persistence change in
  the same comparison that measures executors.

## Completion criteria (when selected)

- [ ] Survey existing Pi memory/skill extensions for reuse.
- [ ] If building: frozen schemas, caps, and policy for store/read/forget.
- [ ] Offline tests for caps, denials, and isolation; docs note it is opt-in.
