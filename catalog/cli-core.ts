import type { CapabilityMeta } from "../src/capabilities/catalog.ts";

/**
 * Catalog entry: always-loaded core. `meta` is pure static data (extracted
 * without executing this module; schemas are inlined literals, no calls).
 * `bindings` execute only when the capability is loaded.
 */
export const meta = {
  id: "cli",
  description: "Core fixture data: customers and their invoices.",
  transport: { kind: "cli-twin" },
  operations: [
    {
      name: "customers",
      description: "Search customers by country.",
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
      description: "Fetch invoices for customer IDs.",
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
  ],
  dependsOn: [],
  related: ["cli-records"],
} satisfies CapabilityMeta;

/** Argument mappers: validated input becomes an argv array, never a shell string. */
export const bindings: Record<string, (input: Record<string, unknown>) => string[]> = {
  customers: (input) => ["customers", "--country", input.country as string],
  invoices: (input) => [
    "invoices",
    "--customer-ids",
    (input.customerIds as string[]).join(","),
  ],
};
