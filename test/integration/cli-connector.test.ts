import { test, expect, beforeAll, afterAll } from "bun:test";
import { isDeepStrictEqual } from "node:util";
import { createSession } from "../../src/session.ts";
import { connectCli } from "../../src/capabilities/cli/connector.ts";
import { fileURLToPath } from "node:url";
import { fixtureSession } from "../../examples/fixture.ts";
import { cliOperations, cliSession } from "../fixture-cli/operations.ts";

let cli: Awaited<ReturnType<typeof cliSession>>;
beforeAll(async () => {
  cli = await cliSession();
});
afterAll(async () => {
  await cli.session.close();
});
const program = (body: string) =>
  `import { api } from '@cap/cli';\nexport async function main() { ${body} }`;

test("CLI: typed structured invocation", async () => {
  const result = await cli.session.run(
    program(
      "const r = await api.customers({ country: 'DE' }); return r.customers.map(c => c.id);",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual(["c1"]);
});

test("CLI: programmatic composition over a process boundary", async () => {
  const result = await cli.session.run(
    program(
      "const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.filter(i => i.amount > 10000).map(i => i.id);",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual(["i0"]);
  expect(result.metrics.capabilityCalls).toBe(2);
});

test("CLI: large process output stays outside Pi context", async () => {
  const result = await cli.session.run(
    program(
      "const r = await api.records({ count: 10000 }); return { total: r.records.length, selected: r.records.filter(r => r.score > 0.98).slice(0, 5).map(r => r.id) };",
    ),
  );
  expect(result.error).toBeUndefined();
  expect(result.result).toEqual({
    total: 10000,
    selected: [99, 199, 299, 399, 499],
  });
  expect(result.metrics.rawCapabilityBytes).toBeGreaterThan(1_000_000);
  expect(result.metrics.bytesExposedToPi).toBeLessThan(1000);
});

test("CLI: enum violation is rejected at compile time, zero spawns", async () => {
  const before = cli.spawned();
  const result = await cli.session.run(
    program("return await api.customers({ country: 'XX' });"),
  );
  expect(result.error).toContain("compilation failed");
  expect(result.metrics.capabilityCalls).toBe(0);
  expect(cli.spawned()).toBe(before);
});

test("CLI: range violation is rejected by input validation before spawn", async () => {
  const before = cli.spawned();
  // count: 0 typechecks (number) but violates minimum: 1 at runtime.
  const result = await cli.session.run(
    program("return await api.records({ count: 0 });"),
  );
  expect(result.error).toContain("cli.records: input:");
  expect(result.metrics.validationFailures).toBe(1);
  expect(result.metrics.capabilityCalls).toBe(0);
  expect(cli.spawned()).toBe(before);
});

test("CLI: local policy blocks before process spawn", async () => {
  const restricted = await cliSession(new Set(["customers"]));
  try {
    const before = restricted.spawned();
    const result = await restricted.session.run(
      program(
        "const c = await api.customers({ country: 'DE' }); return c.customers.length;",
      ),
    );
    expect(result.error).toBeUndefined();
    const denied = await restricted.session.run(
      program("return await api.invoices({ customerIds: ['c1'] });"),
    );
    expect(denied.error).toContain("cli.invoices: policy:");
    expect(denied.metrics.policyFailures).toBe(1);
    expect(restricted.spawned()).toBe(before + 1);
  } finally {
    await restricted.session.close();
  }
});

test("CLI: exit codes and spawn failures become transport errors", async () => {
  // An operation that passes the broker but makes the CLI exit non-zero:
  // the CLI usage error (with stderr) becomes a transport failure.
  const usage = await connectCli(
    "cli",
    {
      command: process.execPath,
      args: [fileURLToPath(new URL("../fixture-cli/cli.ts", import.meta.url))],
    },
    {
      ...cliOperations,
      badUsage: {
        description: "Test hook missing a required CLI flag.",
        inputSchema: { type: "object", properties: {} },
        outputSchema: { type: "object", properties: {} },
        toArgs: () => ["customers"],
      },
    },
  );
  try {
    const session = await createSession(
      usage.manifest,
      usage.connector,
      new Set(["badUsage"]),
    );
    try {
      const result = await session.run(
        `import { api } from '@cap/cli';\nexport async function main() { return await api.badUsage({}); }`,
      );
      expect(result.error).toContain("cli.badUsage: transport: exit 2");
      expect(result.error).toContain("missing --country");
    } finally {
      await session.close();
    }
  } finally {
    await usage.connector.close();
  }
  // Unstartable command surfaces as a broker transport failure.
  const bad = await connectCli(
    "cli",
    { command: "/nonexistent/fixture-cli" },
    cliOperations,
  );
  const session = await createSession(
    bad.manifest,
    bad.connector,
    new Set(["customers"]),
  );
  try {
    const result = await session.run(
      program("return await api.customers({ country: 'DE' });"),
    );
    expect(result.error).toContain("cli.customers: transport:");
  } finally {
    await session.close();
  }
});

test("CLI/MCP twin parity: identical contracts, identical data", async () => {
  const mcp = await fixtureSession();
  try {
    const cases: Array<{ op: "customers" | "invoices" | "records"; body: string }> = [
      {
        op: "customers",
        body: "const r = await api.customers({ country: 'DE' }); return r.customers;",
      },
      {
        op: "invoices",
        body: "const r = await api.invoices({ customerIds: ['c1'] }); return r.invoices;",
      },
      {
        op: "records",
        body: "const r = await api.records({ count: 5 }); return r.records;",
      },
    ];
    for (const { body } of cases) {
      const viaCli = await cli.session.run(
        `import { api } from '@cap/cli';\nexport async function main() { ${body} }`,
      );
      const viaMcp = await mcp.run(
        `import { api } from '@cap/fixture';\nexport async function main() { ${body} }`,
      );
      expect(viaCli.error).toBeUndefined();
      expect(viaMcp.error).toBeUndefined();
      expect(isDeepStrictEqual(viaCli.result, viaMcp.result)).toBe(true);
    }
  } finally {
    await mcp.close();
  }
});
