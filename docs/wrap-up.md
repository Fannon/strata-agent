# Research wrap-up review

Reviewed 2026-09-22 against `4e2df5d` and the accompanying documentation changes. This is a local implementation/evidence review, not a new benchmark campaign or survey of competing products.

Historical checkpoint: the assessment below describes the September 22 repository/application evidence. Subsequently selected 049/051 pilots tested native Pi Codemode and checking policies on two models. They demonstrated prevention of supplied field mistakes and an encouraging Muse Spark token/cost/time observation, not repeated on GLM; see the [complete comparison](checking-policy-comparison.md). Those small synthetic results do not replace the earlier application measurements. The [054 broader scope](../.work/issues/054-broader-composition-benchmark.md) is a proposal, not an active run. Current reporting/publication state is in the [handoff](handoff.md).

## Assessment

**Ready to pause as a research prototype.** The implemented mechanism and the bounded evaluation provide a useful result: checked typed composition works, but has not earned its extra context and complexity on the tasks tested. No further experiment is selected. This checkpoint does not make the prototype production-ready or promise ongoing maintenance.

The reusable work includes the protocol-independent capability manifest, schema-derived declarations, persistent compiler, validating broker, replaceable executors, policy-aware discovery and evaluation harnesses. MCP, a CLI fixture and read-only repository operations are implemented. General REST integration, broad catalog integration, durable program reuse and hardened containment remain outside the delivered scope.

## Evidence behind the recommendation

- Repository trials found fewer agent calls with greater token/cost overhead. A compact-declaration development gain did not survive confirmation; compact stays opt-in.
- The corrected AppWorld v3 comparison completed 36 cells over six development tasks. Both approaches achieved **15/18 strict successes**. Typed cost **$0.0141/success** versus **$0.0092/success** for direct tools, about **53% more**. Direct cost less on all six tasks. See [046](../.work/issues/046-post-parity-comparison-v3.md).
- Typed used roughly half as many requests, at roughly three times the cost per request. This supports context overhead as an explanation; it is not an isolated causal ablation of declarations or proof that every larger workload would lose.
- Validation-policy parity is now covered through actual Pi entry points. The first pilot remains a confounded historical result. Both v3 operation sets were preloaded; direct retained shell/files and typed used strict mode. This compares configured systems, not typing alone.
- Small samples, mostly one model, reused development tasks, incomplete effect visibility and unmeasured v3 per-cell latency limit the conclusion. The BFCL exercise is an invocation diagnostic, not evidence of comparative superiority.

Further general framework work would add maintenance before establishing a user need or measured benefit. The current evidence is sufficient to stop this round without exhausting every possible hypothesis.

## Verification

Model-free verification on Windows, Bun 1.4.2, 2026-09-22:

| Check | Result |
| --- | --- |
| `bun run check` | Passed |
| `bun test` with local subprocess access | 163 passed, 12 failed; 175 tests, 1,292 assertions |
| `bun run demo` with local subprocess access | Passed; composition returned invoice `i0` at 12000; 10,000-record filtering returned the expected five IDs |
| Demo data volume | 1,947,738 capability bytes / 82 Pi bytes for the filtering run; excludes declarations and model costs |

The 12 failures match the previously recorded Windows test names/classes: benchmark process supervision, Windows URL/path and filesystem semantics, BFCL setup and two unnamed setup failures. See [041](../.work/issues/041-windows-verification.md). This is not a green cross-platform suite. The initial restricted run encountered subprocess `EPERM` failures (78 pass / 61 fail); the permitted rerun above is the comparable result. No current Linux rerun or live model/AppWorld campaign was performed. No new model spend was incurred by these checks.

## Deferred work and restart criteria

The [issue board](../.work/issues/index.md) retains open work without making it a completion requirement for this research checkpoint. In particular, Windows portability (041), missing evaluation reports (038), resource/report limits (005/007/034) and stronger permissions/containment (012/018) remain relevant before broader use or affected harness reuse.

Revisit only with a concrete recurring workflow, observed bottleneck or explicit research question that merits a bounded test. [047](../.work/issues/047-stored-program-reuse.md) is a plausible restart candidate if recurring tasks actually exist: compare stored parameterized typed programs against stored ordinary scripts, counting authoring, retrieval, adaptation and staleness costs. Hybrid interfaces (044), large-catalog discovery (035) and generated REST clients (039) remain separate ideas.

Before another campaign, choose one question, freeze a fair baseline and decision rule, verify the required environment, and reconcile the historical spend ledger (approximately $1.21, unreconciled). A positive development signal would need untouched tasks and broader model coverage. Unspent budget alone is not a reason to continue.

Raw transcripts, generated datasets and local environments remain ignored; the tracked reports preserve conclusions and limitations. No repository archival, release, commit or push is part of this review.
