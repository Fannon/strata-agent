import { fileURLToPath } from "node:url";
import { connectCli } from "../../src/capabilities/cli/connector.ts";
import type { CliOperation } from "../../src/capabilities/cli/connector.ts";
import { createSession } from "../../src/session.ts";

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

/** CLI twin operations: identical data contract to the MCP fixture subset. */
export const cliOperations: Record<string, CliOperation> = {
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

export const cliAllowed = new Set(["customers", "invoices", "records"]);

export async function cliConnection() {
  return connectCli(
    "cli",
    {
      command: process.execPath,
      args: [fileURLToPath(new URL("./cli.ts", import.meta.url))],
    },
    cliOperations,
  );
}

export async function cliSession(allowed: ReadonlySet<string> = cliAllowed) {
  const { manifest, connector, spawned } = await cliConnection();
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
