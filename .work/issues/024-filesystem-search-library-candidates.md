# 024 — Filesystem and search library candidates

Status: backlog
Kind: backend selection
Source: user suggested fast-glob and fs-extra.
Dependencies: follows the reuse principle in 023; informs 011/012 and later 015. Evaluate within those slices, not as a blocking package survey.

## Candidates and boundaries

- `Bun.Glob`: first choice to evaluate for path discovery (`fs.find`). Keep it if it meets the required semantics and resource bounds. No additional glob dependency is needed just because one exists; native performance must be measured if used as a selection argument.
- `fast-glob`: conditional alternative only if the Bun baseline exposes a concrete gap or evidence warrants comparison. Its [upstream README](https://github.com/mrmlnc/fast-glob) documents pattern-based traversal, promise/stream APIs and arbitrary result ordering. It discovers paths; file-content search remains a separate capability.
- `fs-extra`: candidate for filesystem conveniences, especially later copy/move/ensure-directory/JSON workflows. Its [upstream repository](https://github.com/jprichardson/node-fs-extra) describes extra filesystem methods. Compare the needed methods against Bun and `node:fs/promises` before adding a dependency; the initial read/stat/list slice may need little extra functionality.
- `search.text`: retain 011's comparison of bounded native literal search and a controlled ripgrep JSON adapter. Neither candidate by itself replaces content search.

These are candidates, not selected dependencies. Upstream summaries checked 2026-09-05; installed-version APIs, TypeScript support and Bun compatibility still need verification.

## Selection checklist

- [ ] Start every operation with the relevant native Bun implementation, then standard-library facilities where needed. Record the unmet requirement or concrete benefit before adding an external dependency; skip unnecessary alternative spikes when the built-in satisfies the contract.
- [ ] Implement only the current task's required operations; reuse suitable library APIs and types without exposing the whole package.
- [ ] Compare glob syntax, dotfiles, ignore behavior, symlink traversal, errors and unusual filenames on shared fixtures. Do not assume ignore patterns implement Git ignore semantics. Explicit `.work` access must remain possible.
- [ ] Verify cancellation, early termination, backpressure and entry/byte/depth/concurrency limits. Define deterministic ordering and incomplete-result semantics together: sorting a truncated arbitrary traversal does not produce a deterministic subset.
- [ ] Enforce 012's root/access policy independently of glob filters. Check paths before effects; a configured working directory or ignore list is not filesystem containment.
- [ ] Keep file enumeration and content matching independently composable; allow content search to scan efficiently within the host without forcing every path through the model.
- [ ] For later mutations, specify overwrite, partial failure and symlink behavior per operation; keep them outside the initial read grants.
- [ ] Record correctness, end-to-end time, peak memory, dependency cost and caller ergonomics on representative repositories. Select a library only where it earns its cost.

## Acceptance

A documented backend choice for each required filesystem/search operation, with shared semantic fixtures and verified bounds under Bun. No package installation or broad benchmark is authorized by capturing this suggestion.
