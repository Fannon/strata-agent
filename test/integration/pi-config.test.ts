import { test, expect } from "bun:test";
import { sessionFromConfig } from "../../src/pi/extension.ts";

const program = (body: string) =>
  `import { api } from '@cap/cli';\nexport async function main() { ${body} }`;

test("STRATA_CONFIG cli-twin selects the CLI capability with an allowlist", async () => {
  const configured = await sessionFromConfig({
    transport: "cli-twin",
    allow: ["customers", "invoices"],
  });
  const session = configured.session;
  try {
    expect(session.declarations).toContain("@cap/cli");
    const composed = await session.run(
      program(
        "const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.map(i => i.id);",
      ),
    );
    expect(composed.error).toBeUndefined();
    expect(composed.result).toEqual(["i0"]);
    const denied = await session.run(
      program("return await api.records({ count: 5 });"),
    );
    expect(denied.error).toContain("cli.records: policy:");
  } finally {
    await session.close();
  }
});

test("STRATA_CONFIG rejects unknown shapes with a clear error", async () => {
  await expect(sessionFromConfig(null)).rejects.toThrow("must contain an object");
  await expect(
    sessionFromConfig({ transport: "cli-twin", allow: "customers" }),
  ).rejects.toThrow("cli-twin requires allow: string[]");
  await expect(sessionFromConfig({ id: "x" })).rejects.toThrow(
    "requires id, command, args: string[], allow: string[]",
  );
});
