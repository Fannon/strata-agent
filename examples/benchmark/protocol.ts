import { isDeepStrictEqual } from "node:util";
import { validator } from "../../src/capabilities/schemas.ts";

export const protocol = "009-v2";
export const artifactVersion = 2;
export const tasks = ["T1", "T2", "T3", "T4"] as const;
export const conditions = ["A", "B", "C"] as const;
export type Task = (typeof tasks)[number];
export type Condition = (typeof conditions)[number];

const object = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
const integer = { type: "integer", minimum: 0 };
const strings = { type: "array", items: { type: "string" } };
// Deliberately independent of the fixture implementation/data generator.
export const definitions = {
  T1: {
    goal: 'Query DE customers. Return exactly {"count": N}, the number of DE customers.',
    schema: object({ count: integer }), expected: { count: 1 },
  },
  T2: {
    goal: 'Query DE customers and their invoices. Return exactly {"ids": [...]}, all invoice IDs with amount above 10000, in ascending ID order.',
    schema: object({ ids: strings }), expected: { ids: ["i0"] },
  },
  T3: {
    goal: 'Fetch 10000 records. Return exactly {"totalRecords": N, "matchCount": M, "selectedIds": [...]}. totalRecords is the count BEFORE filtering. matchCount is the count with score > 0.98. selectedIds is the first five matching IDs in ascending numeric order.',
    schema: object({ totalRecords: integer, matchCount: integer, selectedIds: { type: "array", items: integer } }),
    expected: { totalRecords: 10000, matchCount: 100, selectedIds: [99, 199, 299, 399, 499] },
  },
  T4: {
    goal: 'First call customers with country XX and observe its rejection. Then make a separate successful call for DE customers and count them. For typed_program the successful program must return {"count": N}. For bash invoke the fixture customers CLI directly for each country in separate tool calls. Finally return exactly {"rejected": true, "recoveredCount": N}. Do not merely describe an error without recovering.',
    schema: object({ rejected: { type: "boolean" }, recoveredCount: integer }),
    expected: { rejected: true, recoveredCount: 1 },
  },
};
const checks = Object.fromEntries(tasks.map((task) => [task, validator(definitions[task].schema)]));

export function promptFor(task: Task, condition: Condition, cli: string) {
  const surface = condition === "A"
    ? `Use stock Pi tools and ordinary scripting freely. The fixture CLI is ${JSON.stringify(cli)}; invoke with bun. Commands: customers --country DE|US; invoices --customer-ids c1,c2; records --count N. Stdout is JSON; usage errors are nonzero exits on stderr.`
    : `Use typed_program only. Import { api } from '@cap/cli' and export async function main(). ${condition === "B" ? "Make exactly one capability call per executed program; a rejected compilation may make zero calls." : "Compose multiple capability calls freely."} Do not use bash/read/edit/write/search_capabilities/load_capability or other tools.`;
  return `${surface}\n${definitions[task].goal}\nQuery the fixture; do not inspect its implementation or benchmark artifacts. Return one JSON object, without Markdown or commentary, and stop.`;
}

export function gradeAnswer(task: Task, text: string) {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { correct: false, reason: "Final answer must be one JSON value" }; }
  const error = checks[task]!(value);
  if (error) return { correct: false, reason: `Answer schema: ${error}` };
  return isDeepStrictEqual(value, definitions[task].expected)
    ? { correct: true, reason: null }
    : { correct: false, reason: "Answer does not equal the independent expected value" };
}

export const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const count = (value: unknown): value is number => number(value) && Number.isSafeInteger(value);
const textContent = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const parts: string[] = [];
  for (const block of value) {
    if (!record(block) || typeof block.type !== "string") return null;
    if (block.type === "text") {
      if (typeof block.text !== "string") return null;
      parts.push(block.text);
    }
  }
  return parts.join("\n");
};

export interface Usage {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  totalTokens: number | null;
  cost: number | null;
}
export interface TraceInput {
  task: Task; condition: Condition; model: string;
  stdout: string; exitCode: number | null;
  termination: "timeout" | "output_limit" | "budget" | "guard" | "spawn_error" | null;
}

/** Parse Pi's event stream, never console/tool text impersonating an assistant. */
export function assessTrace(input: TraceInput) {
  const errors: string[] = [];
  const violations: string[] = [];
  const accounting: string[] = [];
  const toolCounts: Record<string, number> = {};
  const pending = new Map<string, { name: string; args: unknown }>();
  const seenCalls = new Set<string>();
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
  let started = false, ended = false, assistantCount = 0;
  let finalText = "", lastAssistantStop: unknown;
  let lastAssistantIndex = -1, lastToolIndex = -1;
  let piToolBytes = 0, capabilityCalls = 0, rawCapabilityBytes = 0, bytesExposedToPi = 0;
  let typedMetricsComplete = true;
  let rejectionIndex = -1, recovered = false;
  const lines = input.stdout.split("\n").filter((line) => line.trim());
  for (const [index, line] of lines.entries()) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { errors.push(`Malformed JSON event at line ${index + 1}`); continue; }
    if (!record(event) || typeof event.type !== "string") { errors.push("Invalid event shape"); continue; }
    if (event.type === "session") continue;
    if (ended) { errors.push("Event after agent_end"); continue; }
    if (!started && event.type !== "agent_start") errors.push("Event before agent_start");
    if (event.type === "agent_start") {
      if (started) errors.push("Duplicate agent_start");
      started = true;
    } else if (event.type === "agent_end") {
      if (!Array.isArray(event.messages)) errors.push("Invalid agent_end");
      ended = true;
    } else if (event.type === "tool_execution_start") {
      if (typeof event.toolCallId !== "string" || typeof event.toolName !== "string" || seenCalls.has(event.toolCallId)) {
        errors.push("Invalid or duplicate tool start"); continue;
      }
      seenCalls.add(event.toolCallId);
      pending.set(event.toolCallId, { name: event.toolName, args: event.args });
      toolCounts[event.toolName] = (toolCounts[event.toolName] ?? 0) + 1;
      if (input.condition !== "A" && event.toolName !== "typed_program") violations.push(`Forbidden tool: ${event.toolName}`);
      if (input.condition === "A" && !["bash", "read", "edit", "write"].includes(event.toolName)) violations.push(`Non-stock tool: ${event.toolName}`);
      lastToolIndex = index;
    } else if (event.type === "tool_execution_end") {
      const call = typeof event.toolCallId === "string" ? pending.get(event.toolCallId) : undefined;
      if (!call || call.name !== event.toolName || typeof event.isError !== "boolean" || !record(event.result)) {
        errors.push("Unmatched or invalid tool result"); continue;
      }
      pending.delete(event.toolCallId as string);
      lastToolIndex = index;
      const text = textContent(event.result.content);
      if (text === null) { errors.push("Invalid tool content"); continue; }
      piToolBytes += Buffer.byteLength(text);
      if (call.name === "typed_program") {
        let report: unknown;
        try { report = JSON.parse(text); } catch { /* Pi startup errors are plain text. */ }
        if (!record(report) || !record(report.metrics)) {
          typedMetricsComplete = false;
          errors.push("Missing structured typed_program report (possibly unavailable runtime)");
          continue;
        }
        const m = report.metrics;
        if (![m.capabilityCalls, m.rawCapabilityBytes, m.bytesExposedToPi].every(count) || !Array.isArray(m.calls) || !Array.isArray(m.diagnostics)) {
          typedMetricsComplete = false; errors.push("Malformed typed metrics"); continue;
        }
        capabilityCalls += m.capabilityCalls as number;
        rawCapabilityBytes += m.rawCapabilityBytes as number;
        bytesExposedToPi += m.bytesExposedToPi as number;
        if (input.condition === "B" && ((m.capabilityCalls as number) > 1 || m.calls.length > 1 || (m.diagnostics.length === 0 && m.calls.length !== 1))) {
          violations.push("B requires one attempted capability call per executed program");
        }
        const rejected = event.isError && m.capabilityCalls === 0 && m.calls.length === 0 &&
          m.diagnostics.some((d) => typeof d === "string" && d.includes('"XX"'));
        if (rejected) rejectionIndex = index;
        if (rejectionIndex >= 0 && index > rejectionIndex && !event.isError && m.capabilityCalls === 1 &&
            m.calls.some((c) => record(c) && c.operation === "customers" && c.invoked === true) &&
            isDeepStrictEqual(report.result, { count: 1 })) recovered = true;
      } else if (call.name === "bash") {
        // For this recovery task the prompt deliberately requests separate direct invocations.
        if (event.isError && text.includes("fixture-cli: bad country XX") && record(call.args) &&
            typeof call.args.command === "string" && call.args.command.includes("customers") && call.args.command.includes("XX")) rejectionIndex = index;
        if (rejectionIndex >= 0 && index > rejectionIndex && !event.isError) {
          try { recovered ||= isDeepStrictEqual(JSON.parse(text.trim()), { customers: [{ id: "c1", country: "DE" }] }); } catch { /* not evidence */ }
        }
      }
    } else if (event.type === "message_end") {
      if (!record(event.message)) { errors.push("Invalid message_end"); continue; }
      const message = event.message;
      if (message.role !== "assistant") continue;
      assistantCount++;
      lastAssistantIndex = index;
      lastAssistantStop = message.stopReason;
      const content = textContent(message.content);
      finalText = content ?? "";
      if (content === null) errors.push("Invalid assistant content");
      if (message.stopReason === "stop" && Array.isArray(message.content) && message.content.some((b) => record(b) && b.type === "toolCall")) errors.push("Final answer contains an unexecuted tool call");
      if (message.model !== input.model || message.provider !== "openrouter") errors.push("Unexpected model/provider");
      if (["error", "aborted", "length"].includes(String(message.stopReason))) errors.push(`Assistant stopped: ${message.stopReason}`);
      const u = record(message.usage) ? message.usage : {};
      for (const key of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"] as const) {
        if (!count(u[key])) { usage[key] = null; accounting.push(`Missing/invalid ${key}`); }
        else if (usage[key] !== null) usage[key] += u[key];
      }
      if (!record(u.cost) || !number(u.cost.total)) { usage.cost = null; accounting.push("Missing/invalid cost"); }
      else if (usage.cost !== null) usage.cost += u.cost.total;
      // Pi initializes absent provider usage with zeros. Do not call that measured zero cost.
      if (!number(u.totalTokens) || u.totalTokens === 0) {
        for (const key of Object.keys(usage) as (keyof Usage)[]) usage[key] = null;
        accounting.push("Provider usage unavailable (including Pi zero defaults)");
      }
    }
  }
  if (!started || !ended) errors.push("Incomplete agent lifecycle");
  if (pending.size) errors.push("Unfinished tool calls");
  if (!assistantCount || lastAssistantStop !== "stop" || lastAssistantIndex < lastToolIndex) errors.push("No completed final assistant answer");
  if (input.exitCode !== 0) errors.push(`Process exit: ${input.exitCode}`);
  if (input.termination) errors.push(`Terminated: ${input.termination}`);
  const correctness = gradeAnswer(input.task, finalText);
  if (input.task === "T4" && !recovered) {
    correctness.correct = false;
    correctness.reason = "Missing observed rejection followed by successful recovery";
  }
  if (!seenCalls.size) violations.push("No fixture tool use observed");
  const healthy = errors.length === 0;
  return {
    success: correctness.correct && healthy && violations.length === 0,
    correctness,
    policy: { compliant: violations.length === 0, violations: [...new Set(violations)] },
    harness: { healthy, errors: [...new Set(errors)] },
    accounting: { complete: assistantCount > 0 && accounting.length === 0, issues: [...new Set(accounting)] },
    usage, toolCounts, finalText, modelResponses: assistantCount,
    metrics: { piToolBytes, capabilityCalls: typedMetricsComplete && input.condition !== "A" ? capabilityCalls : null,
      rawCapabilityBytes: typedMetricsComplete && input.condition !== "A" ? rawCapabilityBytes : null,
      bytesExposedToPi: typedMetricsComplete && input.condition !== "A" ? bytesExposedToPi : null },
  };
}
