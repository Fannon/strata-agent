import { fileURLToPath } from "node:url";
import { connectCli } from "../src/capabilities/cli/connector.ts";
import type { CliOperation } from "../src/capabilities/cli/connector.ts";
import { createSession } from "../src/session.ts";

const object = (
  properties: Record<string, unknown>,
  required: string[] = Object.keys(properties),
) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const customer = object({
  id: { type: "string" },
  country: { type: "string" },
});

/**
 * Full-twin session helpers for the benchmark (conditions B/C) and the
 * `cli-twin` transport. Self-contained: twin parity with the MCP fixture is
 * asserted in cli-connector.test.ts. Discovery catalog entries live in
 * catalog/ and are intentionally separate so baseline artifacts never shift.
 */
export const cliTwinOperations: Record<string, CliOperation> = {
  customers: {
    description: "Search customers by country (CLI twin).",
    inputSchema: object({
      country: { type: "string", enum: ["DE", "US"] },
    }),
    outputSchema: object({
      customers: { type: "array", items: customer },
    }),
    toArgs: (input) => ["customers", "--country", input.country as string],
  },
  invoices: {
    description: "Fetch invoices for customer IDs (CLI twin).",
    inputSchema: object({
      customerIds: { type: "array", items: { type: "string" } },
    }),
    outputSchema: object({
      invoices: {
        type: "array",
        items: object({
          id: { type: "string" },
          customerId: { type: "string" },
          amount: { type: "number" },
        }),
      },
    }),
    toArgs: (input) => [
      "invoices",
      "--customer-ids",
      (input.customerIds as string[]).join(","),
    ],
  },
  records: {
    description: "Generate deterministic records (CLI twin).",
    inputSchema: object({
      count: { type: "integer", minimum: 1, maximum: 10000 },
    }),
    outputSchema: object({
      records: {
        type: "array",
        items: object({
          id: { type: "integer" },
          score: { type: "number" },
          text: { type: "string" },
        }),
      },
    }),
    toArgs: (input) => ["records", "--count", String(input.count)],
  },
};

export const cliTwinAllowed = new Set(["customers", "invoices", "records"]);

export const cliTwinScript = fileURLToPath(
  new URL("../test/fixture-cli/cli.ts", import.meta.url),
);

export async function cliTwinConnection() {
  return connectCli(
    "cli",
    { command: process.execPath, args: [cliTwinScript] },
    cliTwinOperations,
  );
}

export async function cliTwinSession(
  allowed: ReadonlySet<string> = cliTwinAllowed,
) {
  const { manifest, connector, spawned } = await cliTwinConnection();
  try {
    return {
      session: await createSession(manifest, connector, allowed),
      spawned,
    };
  } catch (error) {
    await connector.close();
    throw error;
  }
}
