# Executors: QuickJS baseline and opt-in direct Bun

Status: both implemented and deterministically compared (2026-09-06). No paid
model comparison has run; matched repository trials still need an explicit
budget (see below).

## Contract

The typed capability layer is the enduring architecture; the engine is
replaceable. Both executors share the smallest useful interface: checked
emitted code and capability bindings in; result, diagnostics, cancellation
and trace events out (`executeWith` in `src/runtime/executor.ts`).

Identical across engines: persistent TypeScript checking (`Workspace`),
schema-derived declarations, broker input/output validation, per-module
operation allowlists, permission-aware implementations (`DeniedError`
handling), per-call durations/outcome categories, fresh state per run,
source/result/log/byte caps, timeout and cancellation with recovery.

Different: the in-worker evaluation. QuickJS runs emitted JS in a separate
interpreter object world with explicit JSON bindings, a module allowlist,
heap/stack limits and an interrupt handler. Direct Bun stages the rewritten
program as a per-run temp file and imports it in a disposable worker with
fresh JS state — but ambient host authority (`Bun`, `process`, `fetch`,
filesystem, network) stays reachable.

## Selection

- Default is QuickJS. Nothing to configure.
- Opt-in: `STRATA_EXECUTOR=bun` at Pi session startup, or the per-run
  `{ executor }` session option (used by tests and the comparison script).
- Invalid values fail loudly at startup. `metrics.engine` and trace events
  record which engine ran each program.

## Adherence versus containment

These are different claims and this document keeps them apart:

| Mode | What a passing run proves |
| --- | --- |
| QuickJS | The program used only loaded capability modules (loader allowlist) and every capability call passed broker validation/grants. Host `Bun`/`process`/`fetch` are `undefined` inside the interpreter. |
| Direct Bun, cooperative program | Same broker validation/grants for every capability call the program chose to make (`metrics`/`trace` agree byte-for-byte with QuickJS on the same program). Nothing else is established. |
| Direct Bun, adversarial program | Ambient access works: the comparison canary writes a host file through an `any`-cast `Bun.write` while reporting success through the normal result channel. Disabling Pi's `bash`/`read`/`write` tools (`STRATA_STRICT=1`) does not remove ambient APIs from a Bun worker. |

A Bun worker is a lifecycle boundary (fresh state, termination on
cancel/timeout), not filesystem/network containment. Wrapper traces describe
mediated calls; they cannot prove the absence of unmediated effects. Any
future claim of Bun API exclusivity needs a concrete, separately tested
OS-level confinement mechanism — a worker alone is explicitly not that.

Known rewrite limits (`src/runtime/capability-imports.ts`): only named and
namespace `@c/`/`@cap/` imports are supported; default, side-effect and
re-export forms fail with an explicit error, as do unknown capability ids.
Static rewriting cannot see through string literals containing import-like
text; such programs fail noisily rather than silently changing meaning.
Duplicate local `api` bindings are rejected by the engine in both runtimes.

## Deterministic comparison (2026-09-06)

`bun examples/executor-compare.ts --repeats 3` — offline, model-free, same
programs on both engines, engine order alternated per repeat plus an
unrecorded compiler warmup. Raw JSON is local-only (`.work/`); means below
are wall-clock on this machine, not general runtime claims.

| Case | QuickJS exec ms | Bun exec ms | Contract parity |
| --- | --- | --- | --- |
| startup: no-op (cold session) | 21.3 | 6.8 | same result |
| trivial call: stats | 28.3 | 11.8 | same result |
| sequential: 5× stats | 40.4 | 11.4 | same totals |
| parallel: 5× stats | 27.9 | 14.9 | same totals |
| payload records(100) filter | 37.2 | 9.5 | same ids |
| payload records(1000) filter | 37.2 | 18.2 | same ids |
| payload records(10000) filter (~2 MB raw) | 94.6 | 36.3 | same ids |
| compute fib(22) | 28.7 | 8.2 | 17711 both |
| cancel slow + abort | cancelled/100.5 | cancelled/100.5 | identical text |
| infinite loop + recovery | timeout/200.5, recovery ok | timeout/200.4, recovery ok | identical text |
| policy/input/output/compile errors | error | error | byte-identical messages |
| repo read + denial | ok / denied | ok / denied | same categories |
| ambient globals + canary write | all `undefined`, canary absent | `object/object/function`, canary `effect` | proves non-containment |
| tracing overhead (sink on vs off) | 24.7 vs 24.8 | 8.1 vs 8.1 | within noise |

Compile times overlap (29–47 ms both engines): the compiler is shared, so
compile cost is not an engine effect. Execution favors Bun by tens of
milliseconds per run — real, but dwarfed by model round-trip latency, so it
does not by itself justify any migration. The comparison found no measured
QuickJS bottleneck at these scales; per the revised architecture decision,
none was required as a prerequisite.

## Recommendation and next step

Retain both engines: QuickJS default, Bun opt-in. Repository model trials subsequently ran across both engines and stock Pi; see [reviewed results](repo-trials.md). Those trials show no stable end-to-end executor advantage and do not establish equivalence in general. Listing, history, diffs and ranged reads are now delivered.

004 compact development testing is delivered; independent confirmation should keep one fixed engine and unchanged semantic capability surface. No new engine implementation or paid engine-only campaign is required. The measurements above are historical model-free probes; later task trials have separate manifests and budgets.
