# 023 — Reuse TypeScript libraries behind capabilities

Status: backlog
Kind: architecture / backend selection
Source: user's suggestion to use existing libraries such as simple-git.
Dependencies: informs 011 and 012; evaluate during the Git slice, not as a separate blocking research phase.

## Direction

Filesystem/search candidates are captured separately in [024](024-filesystem-search-library-candidates.md); the same reuse principle applies.

Start with native Bun APIs for every backend choice. Where they meet the contract, prefer them to keep dependencies and implementation lean. Next consider the Node-compatible standard library available in Bun. Add an external TypeScript library only for a demonstrated semantic gap, material implementation/maintenance savings, or a measured performance benefit; always document the comparison with the relevant Bun implementation. Native speed is a hypothesis to measure, not an assumed result. Do not build competing implementations merely to justify retaining a built-in that already meets requirements.

Strata's value is discoverable, composable capabilities with checked inputs and mediated effects; writing every backend ourselves is not the experiment. Reuse good library method names and data types where they fit. Add adapters only for concrete needs: permission checks, bounded serializable results, cancellation, or a simpler caller contract.

Effectful libraries run in the trusted Bun host behind the capability broker. Generated programs currently run in QuickJS and cannot import arbitrary npm packages or access Bun APIs. Publishing declarations alone does not provide runtime validation or constrain filesystem/process effects.

## First candidate: simple-git

The [upstream README](https://github.com/steveukx/git-js) documents bundled TypeScript definitions, promise-based calls, parsed results for some operations, and an installed Git executable requirement. It also documents cancellation and timeout plugins. Documentation inspected 2026-09-05; Bun compatibility and suitability for Strata's limits have not been tested.

Using this library can remove model-authored shell and hand-written Git parsing while retaining a Git subprocess. Record that backend honestly. Avoid exposing unrestricted raw arguments, custom executables, arbitrary working directories, or mutation methods through the initial read capability.

## Evaluation within 011

- [ ] Compare simple-git with direct fixed-argv Git for the first `git.status` contract; expand to log only when the task requires it. Record dependency/maintenance cost as well as implementation savings.
- [ ] Verify the selected version under our Bun runtime, including cancellation of active work, concurrency, bounded output before full buffering, and serializable result/error shapes.
- [ ] Map repository roots, environment/config handling, helper execution and incidental writes to 012 policy. A typed method name does not establish its complete effects.
- [ ] Exercise unusual filenames and staged/unstaged/untracked combinations against real Git fixtures. Check parsing correctness and declaration/schema parity.
- [ ] Record the backend choice and any contract adaptations in the architecture docs. Keep the library replaceable behind the capability contract without building a generic package-wrapping framework.

## Acceptance

A small evidence-backed choice for the first Git capability, with reusable library semantics where appropriate and explicit limits where required. No installation or implementation is implied by capturing this idea; select it with the relevant 011 slice.
