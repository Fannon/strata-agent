# 045 — Pilot entry-point validation parity

Status: DELIVERED 2026-09-19 — compat forwarded through real entry points; regression green; no paid comparison run
Dependencies: 042 (confounded v2 record, preserved unchanged); 040 (delivered offline/manual-replay compat); 037 (harnesses)

## Evidence

- Pilot v2 observed (preserved, no regrade/rerun): typed strict 9/18 ($0.261013, $0.0290014/success), direct 15/18 ($0.103518, $0.0069012/success).
- Confirmed mismatch: `src/pi/extension.ts` `sessionFromConfig` MCP branch destructures id/command/args/allow, creates session with {executor, declarations}, IGNORES `config.compat.acceptNaiveDateTime`; `src/pi/direct-tools.ts` reads it for output validation. `paid_driver.py` sets compat for both.
- Existing offline parity tests compare broker/direct replay, not actual Pi entry points.
- Supervisor synthetic repro `.work/pi-agent/review-20260919/verify-entry.ts` (mock MCP `{at:'2020-01-01T00:00:00'}`, actual `sessionFromConfig`, compat true): typed outcome error/failure output; actual registered direct tool accepts the identical response; default strict validator rejects. Fixed 2026-09-19: `sessionFromConfig` now forwards `compat.acceptNaiveDateTime` to `createSession` validation for all transports (MCP/catalog/cli-twin/repo); inputs stay strict in the broker. Permanent regression `test/integration/pi-entry-parity.test.ts` (real MCP subprocess `test/fixture-mcp/datetime-server.ts`, real typed + direct entry points) covers compat true/unset/false, malformed outputs, and strict inputs. Offline: `bun run check` green; new file 4/4; full suite 163 pass / 12 fail (baseline 159/12 + 4 new, same documented Windows classes). No v2 regrade/rerun; no paid work.

## Hypothesis limits

- v2 is a negative observed result with a confirmed validation-policy confound, not a healthy matched comparison.
- Fixing parity is not proof typed composition would win; failures/success gap cannot be attributed solely to the mismatch.
- Limits preserved: 191 typed tool_execution_end (144 structured ok, 47 without); 2198 invocations / 2199 attempts / 442 validation failures (441 output, 1 input); zero traceDropped ≠ completeness; direct 256 attempts incl. 13 uninvoked input failures; no repair-loop causality claim; zero destructive-hint/policyFailure ≠ no unauthorized effects; preloaded 54/81/98 sets, no lazy discovery; shell/files vs strict difference; no per-cell latency.

## Acceptance

- Minimal permanent regression through REAL typed and direct Pi entry points using a synthetic datetime response.
- Explicit compat policy forwarding with strict defaults and inputs preserved.
- Relevant offline tests kept green.
- Test both option states, malformed dates and strict input rejection through actual model-facing configuration. Unit-testing a shared validator alone is insufficient. Do not broaden global compatibility or infer that the mismatch explains every historical failure.
- Only after parity demonstrated: propose separately a versioned, bounded development comparison with frozen tasks/settings/caps; keep v2 unchanged, reused tasks development-only.
- Larger computation-heavy task family, hybrid 044, REST and catalog scaling remain separately selected alternatives, not ways to chase a win. Stopping/narrowing remains valid.
