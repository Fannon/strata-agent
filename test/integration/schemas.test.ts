import { test, expect } from "bun:test";
import { adaptTools } from "../../src/capabilities/mcp/adapter.ts";
import { declarations } from "../../src/capabilities/schemas.ts";
import { Workspace } from "../../src/compiler/workspace.ts";

test("exact tool names avoid normalization collisions and schema titles cannot rename signatures", async () => {
  const manifest = adaptTools(
    "names",
    ["a-b", "a_b", "__proto__", "constructor"].map((name) => ({
      name,
      inputSchema: {
        type: "object",
        title: "Shared",
        properties: { nested: { $ref: "#/$defs/Shared" } },
        required: ["nested"],
        additionalProperties: false,
        $defs: { Shared: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        title: "Shared",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
    })),
  );
  const types = await declarations(manifest);
  const workspace = new Workspace(types);
  try {
    const result = workspace.compile(
      `import {api} from '@cap/names'; export async function main() { return (await api['a-b']({nested:'x'})).ok && (await api.a_b({nested:'y'})).ok; }`,
    );
    expect(result.diagnostics).toEqual([]);
  } finally {
    workspace.close();
  }
  expect(() =>
    adaptTools("names", [
      { name: "same", inputSchema: { type: "object" } },
      { name: "same", inputSchema: { type: "object" } },
    ]),
  ).toThrow("Duplicate");
});
test("external schema refs fail generation rather than fetching data", async () => {
  const manifest = adaptTools("refs", [
    {
      name: "bad",
      inputSchema: {
        type: "object",
        properties: { value: { $ref: "https://example.com/schema.json" } },
      },
    },
  ]);
  expect(declarations(manifest)).rejects.toThrow();
});
