import { test, expect } from "bun:test";
import { assess } from "../../examples/benchmark/protocol.ts";
import { planCells, repoPolicy, snoopedCanary } from "../../examples/repo-protocol.ts";

const model = "test/model";
const usage = { input: 10, output: 5, cacheRead: 2, cacheWrite: 0, totalTokens: 17, cost: { total: 0.01 } };
const text = (value: string) => [{ type: "text", text: value }];
const assistant = (answer: string, overrides = {}) => ({ type: "message_end", message: {
  role: "assistant", model, provider: "openrouter", content: text(answer), stopReason: "stop", usage, ...overrides,
} });
function tool(name = "read", result = '{"content":"x"}', id = "call-1", error = false, args: unknown = { path: "package.json" }) {
  return [
    { type: "tool_execution_start", toolName: name, toolCallId: id, args },
    { type: "tool_execution_end", toolName: name, toolCallId: id, isError: error, result: { content: text(result) } },
  ];
}
const start = { type: "agent_start" }, end = { type: "agent_end", messages: [] };
const serial = (events: unknown[]) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
const expected = { name: "atlas", version: "2.4.1", testScript: "bun test" };
const stock = repoPolicy("stock-pi", expected);
const typed = repoPolicy("typed-quickjs", expected);
const run = (events: unknown[], policy = stock, extra = {}) =>
  assess({ task: "T1", profile: "stock-pi", model, exitCode: 0, termination: null, stdout: serial(events), policy, ...extra });
const answer = '```json\n{"name":"atlas","version":"2.4.1","testScript":"bun test"}\n```';

test("repo grading uses only the final completed answer", async () => {
  expect(run([start, ...tool(), assistant(answer), end]).success).toBe(true);
  const earlierRight = run([start, assistant(answer), ...tool("read", "{}", "c2"), assistant('{"name":"wrong"}'), end]);
  expect(earlierRight.correctness.correct).toBe(false);
  expect(earlierRight.success).toBe(false);
  expect(run([start, ...tool(), assistant('{"name":"atlas"}'), end]).correctness.correct).toBe(false);
});

test("repo grading rejects extra, missing and malformed answers", async () => {
  for (const bad of [
    '{"name":"atlas","version":"2.4.1","testScript":"bun test","extra":1}',
    '{"name":"atlas"}',
    'not json at all',
    '```json\n{"name":"atlas"}\n```',
  ])
    expect(run([start, ...tool(), assistant(bad), end]).correctness.correct).toBe(false);
});

test("repo traces: malformed lines, timeouts and exit codes invalidate success, not correctness", async () => {
  const malformed = run([start, ...tool(), assistant(answer), end]);
  expect(malformed.success).toBe(true);
  const badLine = assess({ task: "T1", profile: "stock-pi", model, exitCode: 0, termination: null,
    stdout: serial([start, ...tool(), assistant(answer), end]) + "{broken\n", policy: stock });
  expect(badLine.harness.healthy).toBe(false);
  expect(badLine.success).toBe(false);
  const timed = run([start, ...tool(), assistant(answer), end], stock, { termination: "timeout" as const });
  expect(timed.correctness.correct).toBe(true);
  expect(timed.harness.healthy).toBe(false);
  expect(timed.success).toBe(false);
  const exited = run([start, ...tool(), assistant(answer), end], stock, { exitCode: 1 });
  expect(exited.success).toBe(false);
});

test("repo accounting: missing usage stays null", async () => {
  const r = run([start, ...tool(), assistant(answer, { usage: undefined }), end]);
  expect(r.usage.cost).toBeNull();
  expect(r.usage.totalTokens).toBeNull();
  expect(r.accounting.complete).toBe(false);
  expect(r.correctness.correct).toBe(true);
});

test("repo tool policy separates stock and typed profiles", async () => {
  expect(run([start, ...tool("read"), assistant(answer), end]).policy.compliant).toBe(true);
  expect(run([start, ...tool("typed_program"), assistant(answer), end]).policy.compliant).toBe(false);
  const typedOk = run([start, ...tool("typed_program", '{"result":1}'), assistant(answer), end], typed);
  expect(typedOk.policy.compliant).toBe(true);
  const typedBash = run([start, ...tool("bash", "{}"), assistant(answer), end], typed);
  expect(typedBash.policy.compliant).toBe(false);
  expect(typedBash.policy.violations).toEqual(["Non-typed tool: bash"]);
});

test("repo typed metrics recorded for typed profiles, null for stock", async () => {
  const report = JSON.stringify({ result: { a: 1 }, metrics: { capabilityCalls: 2,
    rawCapabilityBytes: 40, bytesExposedToPi: 120, calls: [], diagnostics: [] } });
  const t = run([start, ...tool("typed_program", report), assistant(answer), end], typed);
  expect(t.metrics.capabilityCalls).toBe(2);
  expect(t.metrics.rawCapabilityBytes).toBe(40);
  const s = run([start, ...tool("read"), assistant(answer), end]);
  expect(s.metrics.capabilityCalls).toBeNull();
});

test("canary detector flags evaluator-material access through tool args", async () => {
  const token = "canary-token-abc123";
  const clean = serial([start, ...tool("read", "{}", "c1", false, { path: "package.json" }), assistant(answer), end]);
  expect(snoopedCanary(clean, token)).toBe(false);
  const snoop = serial([start,
    ...tool("bash", "x", "c1", false, { command: "cat .canary-canary-token-abc123" }),
    assistant(answer), end]);
  expect(snoopedCanary(snoop, token)).toBe(true);
  const malformed = clean + "{not json\n";
  expect(snoopedCanary(malformed, token)).toBe(false);
});

test("repo cell planning counterbalances profiles and validates nothing silently", async () => {
  const cells = planCells(["T1", "T2"], ["stock-pi", "typed-quickjs", "typed-bun"], 2);
  expect(cells).toHaveLength(12);
  expect(new Set(cells.map((c) => c.id)).size).toBe(12);
  expect(cells.filter((c) => c.task === "T1").map((c) => c.profile).join(",")).toBe(
    "stock-pi,typed-quickjs,typed-bun,typed-quickjs,typed-bun,stock-pi",
  );
  expect(cells.filter((c) => c.task === "T2").map((c) => c.profile).join(",")).toBe(
    "typed-quickjs,typed-bun,stock-pi,typed-bun,stock-pi,typed-quickjs",
  );
});

test("trial registry builds every task fixture offline", async () => {
  const { buildTrialFixture, trialTasks } = await import("../../examples/repo-protocol.ts");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  expect(trialTasks.map((t) => t.id)).toEqual([
    "T1", "T2", "T3",
    "R-EXPORT-1", "R-EXPORT-2", "R-EXPORT-3", "R-EXPORT-4",
    "R-LOG-1", "R-LOG-2", "R-LOG-3", "R-LOG-4",
    "R-LOC-1", "R-LOC-2", "R-LOC-3", "R-LOC-4",
  ]);
  for (const task of trialTasks) {
    const dir = await mkdtemp(join(tmpdir(), "strata-registry-"));
    try {
      const built = await buildTrialFixture(task.id, dir);
      expect(built.ask.length).toBeGreaterThan(0);
      expect(built.expected).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  await expect(buildTrialFixture("NOPE", tmpdir())).rejects.toThrow("Unknown trial task");
});
