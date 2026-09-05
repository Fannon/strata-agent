import type { CapabilityMeta } from "../src/capabilities/catalog.ts";

/**
 * Catalog entry: heavyweight records, discovered on demand. Same format and
 * extraction rules as catalog/cli-core.ts. Related to the core capability;
 * shares its CLI backend process-per-call.
 */
export const meta = {
  id: "cli-records",
  description: "Deterministic bulk records for filtering and aggregation.",
  transport: { kind: "cli-twin" },
  operations: [
    {
      name: "records",
      description: "Generate deterministic records.",
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
  related: ["cli"],
} satisfies CapabilityMeta;

/** Argument mappers: validated input becomes an argv array, never a shell string. */
export const bindings: Record<string, (input: Record<string, unknown>) => string[]> = {
  records: (input) => ["records", "--count", String(input.count)],
};
