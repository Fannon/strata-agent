# 012 — Authorize concrete effects and filesystem resources

Status: Phase A best-effort repository reads delivered; interactive/stronger grants remain backlog
Kind: policy contract and staged enforcement
Source: user question about function/parameter permissions replacing shell permissions.
Dependencies: existing broker; read subset precedes 011, mutation/approval subset precedes 015.

## Correction

Same policy intent, different enforcement. Current grants contain operation names, not roots or parameter constraints. Pi's outer hook sees `typed_program`, not nested effects. Types do not establish runtime authority. Loading bindings also executes trusted host code.

## Phase A: local read experiment

- [~] Define action/resource/context policy input and allow/deny/ask; retain early unknown/unallowed-name rejection. Built: `RepoPolicy` (root + byte/match/file caps) with `DeniedError` before dispatch; broker op-allowlist unchanged. No ask/approval — Phase B.
- [x] Validate input, derive canonical resources in trusted code, enforce at I/O. Specify roots, sensitive-path exclusions and byte/depth/concurrency caps. AJV input validation → `resolveInRoot` (relative-only, prefix + realpath containment, `.git` exclusion) → per-op caps. No depth knob (bounded walk) and no concurrency knob (sequential scan) yet.
- [~] Scope grants to capability version, operation, root and constraints. Operation + root + caps; no capability versioning.
- [x] Define traversal/symlink/file-kind/platform behavior; test escapes and races. Label best-effort validation unless OS or handle-based enforcement closes the gap. Labeled best-effort in `policy.ts`; escape tests in `test/integration/repo.test.ts`.
- [x] Emit bounded redacted decision/outcome metadata, no default content or secret logging. Denials carry relative paths only; tool text bounded by the existing 24KB report budget.

## Phase B: approvals and stronger effects

Coordinate with [026](026-observability.md) for structured policy outcomes: current connector resource denials are classified as transport failures by the broker. Bounded error text alone is not a correlated decision trace. [027](027-permission-aware-runtime-alternatives.md) explains why checks inside functions still require an unavoidable runtime path to those functions.

- [ ] Pi UI bridge with concrete resource/diff, once/session scope, invalidation and cancellation of pending prompts.
- [ ] Resume a specific invocation; never replay prior writes by rerunning the entire program.
- [ ] Treat test/build scripts as arbitrary code; specify cwd/env/network/child controls and OS isolation before stronger mutation claims.
- [ ] Test grant expiry, changed parameters, path substitution, denial before dispatch, canceled approval and healthy next run.

Acceptance: `as any`, multiple modules, dependencies and strict-mode alternatives cannot bypass grants. Independent effect counters prove denial prevents dispatch. Document residual host/compiler/engine trust. Compare baselines with equivalent enforcement.

Open choice: limited local read prototype versus hardened hostile-repository support. Do not grow an enterprise policy framework without need.
