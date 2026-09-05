# Fixture benchmark runner (protocol 009-v2)

The runner now rejects misleading answer matches and distinguishes task correctness from execution, tool adherence and accounting. It is a deterministic evaluation foundation, not evidence that Strata outperforms another harness. The historical `001-v1` artifacts remain unchanged. See [evaluation design](evaluation.md) for later native tasks and comparisons.

## Offline first

```sh
bun examples/benchmark.ts --dry-run --cells T1:A,T1:B,T1:C --repeats 3
bun run check
bun test
```

No arguments also means a dry run. It prints the expanded matrix/configuration, makes no network/model calls and creates no artifacts. The test suite uses synthetic traces plus the real pinned Pi CLI against a loopback fake provider; it needs permission to bind localhost, but no model key or paid service. Process supervision currently requires POSIX.

A live run is explicit and requires a dollar ceiling:

```sh
# Requires OPENROUTER_API_KEY in the environment; this command makes paid requests.
bun examples/benchmark.ts --run --cells T1:A,T1:B,T1:C --repeats 3 \
  --max-cost-usd 1 --max-cell-tokens 2000000 --max-requests 8 \
  --max-output-tokens 4096 --timeout-ms 150000 --out .work/benchmark/my-v2-run
```

The dollar amount is an example ceiling, not a cost prediction or assurance that the matrix fits. The live runner fetches the requested model's current catalog entry and refuses missing/invalid prices. One fixed model and explicit reasoning level apply to every cell. There are no automatic model fallbacks or retries, including Pi/provider retries. An existing output directory is rejected to prevent overwriting prior evidence.

| Option | Default / behavior |
| --- | --- |
| `--model` | `meta/muse-spark-1.3-contributor`; exact OpenRouter model ID |
| `--thinking` | `medium`; recorded explicitly; unsupported settings fail visibly |
| `--cells` | All T1–T4 × A/B/C; unknown or duplicate pairs fail |
| `--repeats` | 1; separate cold sessions, unique artifacts per repeat |
| `--timeout-ms` | 150000 per cell, measured by an actual timer |
| `--max-requests` | 8 per cell |
| `--max-output-tokens` | 4096 per provider request |
| `--max-cell-tokens` | 2000000 conservative reserved tokens per cell |
| `--max-cost-usd` | Required for live mode; conservative reservations across the run |
| `--out` | New timestamped directory below `.work/benchmark/` |

## What the limits mean

A benchmark-only extension runs in every condition. Before provider dispatch it persists the exact request payload and a reservation. Each request reserves the model's full catalog context window at the highest applicable input/cache tariff, plus the configured output-token cap and any fixed request charge. These are conservative admission limits, not predicted usage. Reservations are not refunded on a small response, a failure, or missing usage. A cell can stop earlier than its actual bill would suggest; unstarted cells have explicit `not_run` records.

The guard caps the provider output field and exits before another request when request/token/cost limits are exhausted. Configuration, model, context-reservation or receipt-write failures also stop dispatch. It exits rather than throwing because Pi catches extension-hook exceptions. Provider/context/price compliance is assumed; these controls are not a billing guarantee or a security boundary against an agent using shell to call another service. `usage.cost` is Pi's token-cost estimate; `estimatedCostUsd` additionally includes the catalog's fixed request fee. Neither is a billing reconciliation.

The parent caps stdout and stderr at 16 MiB each and kills the owned POSIX process group on timeout/output overflow or Pi cell-process exit. Abrupt termination of the benchmark parent is not yet supervised by a dedicated SIGINT/SIGTERM cleanup handler. This does not contain a hostile child that creates a new session. Independent interactive cancellation remains issue 016 in the Strata extension. Warm sessions and OS isolation are separate future work.

## Conditions and exact grading

A uses default Pi tools and can batch ordinary scripts. B requests one attempted capability operation per executed typed program; compile-rejected programs may make zero calls. C allows typed composition. B/C currently retain Pi's tools: prohibitions are instructions with post-hoc detection, **not mechanically restricted profiles**. Unknown/discovery/direct tools count as deviations in these fixture conditions; strict profiles are a later slice.

- T1: exact DE customer count.
- T2: exact ordered invoice ID array; extra or duplicate IDs fail.
- T3: distinct `totalRecords`, `matchCount`, `selectedIds`, with exact values and ordering.
- T4: observed rejection followed by a separate successful lookup and exact final recovery report. Typed recovery includes compiler rejection with zero calls and a later successful customers invocation. Bash recovery uses separate direct fixture calls. This is an interface-specific recovery task, not an isolated typing ablation.

Only a completed final assistant JSON value is graded. Markdown, explanatory wrappers, unknown fields and malformed JSON fail. Tool text cannot impersonate a final answer. Missing lifecycle events, unpaired tools, an unfinished final turn, wrong model/provider, nonzero exit, timeout or guard stop invalidate completed success even if partial output contains the correct answer. Traces/fixture outputs are trusted harness evidence, not cryptographically attested actions; this is not an adversarial anti-cheating benchmark.

Each cell reports `correctness`, `policy`, `harness` and `accounting` independently. `success` requires correct task completion, healthy execution and compliant tool use. Missing usage does not erase answer correctness; it makes accounting incomplete and the comparison run exits nonzero. Unavailable usage—including Pi's default all-zero usage—is `null`. All assistant turns count, including recovery/errors; repeated `agent_end.messages` are not double-counted.

Exit 0 means all requested cells executed with valid accounting/adherence. Incorrect answers are data and do not alone make the runner exit nonzero. Exit 1 signals incomplete/invalid comparisons or setup failure; inspect artifacts rather than equating the exit code with the task pass rate.

## Artifacts and reproducibility

`plan.json` records the matrix and limits. `manifest.json` records protocol/artifact versions, Git commit/status, Bun/platform, task definitions and source hashes; `sources/` copies runnable source/fixtures and dependency pins. `pricing.json` stores the fetched catalog entry, rates, timestamp and reservations. `declarations.d.ts`, per-cell prompts, effective system prompts and exact request payload receipts capture context actually presented to the provider.

Each unique cell keeps raw JSONL/stdout, stderr, guard configuration/stop reason and a structured verdict. `results.json` is updated after every completed or skipped cell; setup/orchestration failures additionally produce `failure.json`. No attempt overwrites another. Three repeats rotate the starting condition within each task to counterbalance complete A/B/C triples. Subsets and one repeat are not fully counterbalanced; the order is recorded. There is no significance claim or automatic pooled multi-model score.

Artifacts stay in gitignored `.work/`; they may contain prompts, model outputs or local paths. The runner never serializes the environment or API key. Publish only reviewed, sanitized evidence. No new paid baseline was run to implement this repair.
