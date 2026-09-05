import type { CapabilityMeta } from "../src/capabilities/catalog.ts";

/**
 * Single-file capability catalog entry: standardized `meta` (pure static data,
 * extracted by the loader WITHOUT executing this module — hence fully inlined
 * literal schemas; no builder calls) plus `bindings` (code, imported only when
 * the capability is loaded). Twin of the MCP fixture subset; parity asserted.
 */
export const meta = {
  id: "cli",
  description: "Deterministic fixture data over a CLI subprocess (benchmark twin).",
  operations: [
    {
      name: "customers",
      description: "Search customers by country (CLI twin).",
      inputSchema: {
        type: "object",
        properties: { country: { type: "string", enum: ["DE", "US"] } },
        required: ["country"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          customers: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, country: { type: "string" } },
              required: ["id", "country"],
              additionalProperties: false,
            },
          },
        },
        required: ["customers"],
        additionalProperties: false,
      },
    },
    {
      name: "invoices",
      description: "Fetch invoices for customer IDs (CLI twin).",
      inputSchema: {
        type: "object",
        properties: { customerIds: { type: "array", items: { type: "string" } } },
        required: ["customerIds"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          invoices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                customerId: { type: "string" },
                amount: { type: "number" },
              },
              required: ["id", "customerId", "amount"],
              additionalProperties: false,
            },
          },
        },
        required: ["invoices"],
        additionalProperties: false,
      },
    },
    {
      name: "records",
      description: "Generate deterministic records (CLI twin).",
      inputSchema: {
        type: "object",
        properties: { count: { type: "integer", minimum: 1, maximum: 10000 } },
        required: ["count"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          records: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                score: { type: "number" },
                text: { type: "string" },
              },
              required: ["id", "score", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["records"],
        additionalProperties: false,
      },
    },
  ],
  dependsOn: [],
  related: [],
} satisfies CapabilityMeta;

/** Argument mappers: validated input becomes an argv array, never a shell string. */
export const bindings: Record<string, (input: Record<string, unknown>) => string[]> = {
  customers: (input) => ["customers", "--country", input.country as string],
  invoices: (input) => [
    "invoices",
    "--customer-ids",
    (input.customerIds as string[]).join(","),
  ],
  records: (input) => ["records", "--count", String(input.count)],
};
