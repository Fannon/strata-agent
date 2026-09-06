/**
 * Summarize a Strata JSONL developer trace (issue 026).
 *
 * Usage: bun examples/trace-summary.ts <trace.jsonl> [--slowest N]
 *
 * Prints per-engine call counts, outcome categories, total result bytes and
 * the slowest operations, so a failed or dominant operation is diagnosable
 * without inspecting raw file contents. Reads only the bounded trace events;
 * it never re-executes effects.
 */
import { summarizeTrace, type TraceEvent } from "../src/trace.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: bun examples/trace-summary.ts <trace.jsonl> [--slowest N]");
  process.exit(2);
}
const slowestArg = process.argv.indexOf("--slowest");
const slowest = slowestArg === -1 ? 10 : Number(process.argv[slowestArg + 1] ?? 10);

const lines = (await Bun.file(file).text()).split("\n").filter(Boolean);
const events: TraceEvent[] = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    console.error(`Skipping unparsable line (${line.length} chars)`);
  }
}
const summary = summarizeTrace(events, slowest);
console.log(`Programs: ${summary.programs}  Calls: ${summary.calls}  Result bytes: ${summary.totalResultBytes}`);
console.log(`Engines: ${JSON.stringify(summary.engines)}`);
console.log(`Outcomes: ${JSON.stringify(summary.outcomes)}`);
console.log("Slowest calls:");
for (const call of summary.slowest) {
  console.log(
    `  ${Math.round(call.durationMs)}ms ${call.capability}.${call.operation} ${call.outcome} (${call.call})`,
  );
}
