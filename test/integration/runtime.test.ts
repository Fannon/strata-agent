import { test, expect, beforeAll, afterAll } from "bun:test";
import { fixtureSession } from "../../examples/fixture.ts";
let session: Awaited<ReturnType<typeof fixtureSession>>;
beforeAll(async () => {
  session = await fixtureSession();
});
afterAll(async () => {
  await session.close();
});
const program = (body: string) =>
  `import { api } from '@cap/fixture';\nexport async function main() { ${body} }`;
async function count() {
  return (await session.run(program("return await api.stats({});"))).result as {
    invocations: number;
  };
}

test("A: invalid property has useful TS diagnostic and zero MCP invocations", async () => {
  const before = await count();
  const result = await session.run(
    program("return await api.customers({ county: 'DE' });"),
  );
  expect(result.error).toContain("compilation failed");
  expect(result.metrics.diagnostics.join("\n")).toContain("country");
  expect(result.metrics.capabilityCalls).toBe(0);
  expect(await count()).toEqual(before);
});
test("B: typed structured invocation", async () => {
  const result = await session.run(
    program(
      "const r = await api.customers({ country: 'DE', filters: { status: 'active', limit: 2 } }); return r.customers.map(c => c.id);",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual(["c1"]);
});
test("C: programmatic composition", async () => {
  const result = await session.run(
    program(
      "const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.filter(i => i.amount > 10000).map(i => i.id);",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual(["i0"]);
  expect(result.metrics.capabilityCalls).toBe(2);
});
test("D: output schema violations identify operation and stage", async () => {
  const result = await session.run(program("return await api.broken({});"));
  expect(result.error).toContain("fixture.broken: output:");
  expect(result.metrics.validationFailures).toBe(1);
});
test("E: absent output schema produces unknown and requires narrowing", async () => {
  const result = await session.run(
    program("const r = await api.untyped({}); return r.untrusted;"),
  );
  expect(result.metrics.diagnostics.join("\n")).toContain("unknown");
  expect(result.metrics.capabilityCalls).toBe(0);
  const narrowed = await session.run(
    program(
      "const r = await api.untyped({}); return typeof r === 'object' && r !== null && 'content' in r;",
    ),
  );
  expect(narrowed.result).toBe(true);
});
test("F: large intermediates stay outside Pi context; exact byte metric", async () => {
  const result = await session.run(
    program(
      "const r = await api.records({ count: 10000 }); return r.records.filter(r => r.score > 0.98).slice(0, 3).map(r => r.id);",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual([99, 199, 299]);
  expect(result.metrics.rawCapabilityBytes).toBeGreaterThan(1_000_000);
  expect(result.metrics.bytesExposedToPi).toBe(Buffer.byteLength(result.text));
  expect(result.metrics.bytesExposedToPi).toBeLessThan(2000);
});
test("G: local policy blocks before connector executes", async () => {
  const before = await count();
  const result = await session.run(program("return await api.deleteAll({});"));
  expect(result.error).toContain("fixture.deleteAll: policy:");
  expect(result.metrics.capabilityCalls).toBe(0);
  expect(result.metrics.policyFailures).toBe(1);
  expect(await count()).toEqual(before);
});
test("runtime validates constraints TypeScript cannot express", async () => {
  const before = await count();
  const result = await session.run(
    program("return await api.records({ count: -1 });"),
  );
  expect(result.error).toContain("fixture.records: input:");
  expect(result.metrics.capabilityCalls).toBe(0);
  expect(await count()).toEqual(before);
});
test("host access and arbitrary imports are unavailable", async () => {
  for (const body of [
    "return process.env;",
    "return Bun.spawn([]);",
    'return fetch("https://example.com");',
  ]) {
    expect(
      (await session.run(program(body))).metrics.diagnostics.length,
    ).toBeGreaterThan(0);
  }
  const result = await session.run(
    program(
      "return [typeof (globalThis as any).process, typeof (globalThis as any).Bun, typeof (globalThis as any).fetch];",
    ),
  );
  expect(result.result).toEqual(["undefined", "undefined", "undefined"]);
  expect(
    (
      await session.run(
        "import fs from 'node:fs'; export function main() { return fs; }",
      )
    ).error,
  ).toContain("compilation failed");
});
test("timeout isolates infinite loop; session works afterwards", async () => {
  const result = await session.run(
    "export function main() { while (true) {} }",
    { timeoutMs: 150 },
  );
  expect(result.error).toMatch(/timeout|interrupted/);
  expect((await count()).invocations).toBeGreaterThanOrEqual(0);
});
test("cancellation terminates pending capability execution", async () => {
  const abort = new AbortController();
  const running = session.run(program("return await api.slow({});"), {
    signal: abort.signal,
  });
  setTimeout(() => abort.abort(), 100);
  expect((await running).error).toContain("cancelled");
});
test("each program has fresh globals", async () => {
  await session.run(
    "export function main() { (globalThis as any).secret = 42; return null; }",
  );
  expect(
    (
      await session.run(
        "export function main() { return typeof (globalThis as any).secret; }",
      )
    ).result,
  ).toBe("undefined");
});

test("logs are bounded and oversized results fail without dumping data", async () => {
  const logged = await session.run(
    'export function main() { for(let i=0;i<100;i++) console.log("x".repeat(500)); return 1; }',
  );
  expect(logged.error).toBeUndefined();
  expect(logged.result).toBe(1);
  expect(Buffer.byteLength(logged.logs.join(""))).toBeLessThanOrEqual(2048);
  const large = await session.run(
    'export function main() { return "x".repeat(10000); }',
  );
  expect(large.error).toContain("Result exceeds");
  expect(Buffer.byteLength(large.text)).toBeLessThan(24000);
});
test("JSON result serialization failures are useful and recoverable", async () => {
  for (const source of [
    "export function main() {}",
    "export function main() { return 1n; }",
    "export function main() { const a: any = {}; a.a = a; return a; }",
  ]) {
    expect((await session.run(source)).error).toBeDefined();
  }
  expect(
    (await session.run("export function main() { return 7; }")).result,
  ).toBe(7);
});
test("type assertions do not bypass input validation", async () => {
  const before = await count();
  const report = await session.run(
    program("return await api.customers({country:123} as any);"),
  );
  expect(report.error).toContain("fixture.customers: input:");
  expect(report.metrics.capabilityCalls).toBe(0);
  expect(await count()).toEqual(before);
});
test("suppression comments and dynamic imports cannot skip checking", async () => {
  for (const source of [
    "// @ts-nocheck\nexport function main() { return process.env; }",
    'export async function main() { return import("node:fs"); }',
  ]) {
    const report = await session.run(source);
    expect(report.metrics.diagnostics.length).toBeGreaterThan(0);
    expect(report.metrics.capabilityCalls).toBe(0);
  }
});
test("pre-aborted execution performs no capability calls", async () => {
  const before = await count();
  const report = await session.run(
    program("return await api.customers({country:'DE'});"),
    { signal: AbortSignal.abort() },
  );
  expect(report.error).toBeDefined();
  expect(report.metrics.capabilityCalls).toBe(0);
  expect(await count()).toEqual(before);
});
test("closing a session interrupts active execution and rejects later runs", async () => {
  const local = await fixtureSession();
  const running = local.run("export function main() { while(true) {} }");
  await local.close();
  expect((await running).error).toContain("cancelled");
  expect(
    (await local.run("export function main() { return 1; }")).error,
  ).toBeDefined();
});

test("Unicode output respects byte budget, not only character limit", async () => {
  const report = await session.run(
    'export function main() { return "界".repeat(8100); }',
  );
  expect(report.error).toContain("budget");
  expect(Buffer.byteLength(report.text)).toBeLessThanOrEqual(24000);
  expect(report.metrics.bytesExposedToPi).toBe(Buffer.byteLength(report.text));
});
