import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractMeta,
  loadCatalogFile,
  searchCatalog,
  type CatalogEntry,
} from "../../src/capabilities/catalog.ts";
import { cliManifest } from "../../src/capabilities/cli/connector.ts";
import { bindings } from "../../catalog/cli-twin.ts";
import { createSession } from "../../src/session.ts";
import { cliTwinScript } from "../../examples/cli-twin.ts";

const twinFile = fileURLToPath(
  new URL("../../catalog/cli-twin.ts", import.meta.url),
);

test("catalog: twin meta extracts statically with schemas and edges", async () => {
  const entry = await loadCatalogFile(twinFile);
  expect(entry.meta.id).toBe("cli");
  expect(entry.meta.operations.map((op) => op.name)).toEqual([
    "customers",
    "invoices",
    "records",
  ]);
  expect(entry.meta.dependsOn ?? []).toEqual([]);
});

test("catalog: extraction never executes the module", async () => {
  const dir = await mkdtemp(join(tmpdir(), "strata-catalog-"));
  try {
    const file = join(dir, "evil.ts");
    await writeFile(
      file,
      `(globalThis as any).__strataCatalogExecuted = true;\n` +
        `export const meta = { id: "evil", operations: [{ name: "x", inputSchema: { type: "object" } }] };\n`,
    );
    const entry = await loadCatalogFile(file);
    expect(entry.meta.id).toBe("evil");
    expect((globalThis as Record<string, unknown>).__strataCatalogExecuted).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("catalog: computed metadata is rejected with guidance", async () => {
  expect(() =>
    extractMeta(`const m = { id: "x", operations: [] };\nexport const meta = m;`, "computed.ts"),
  ).toThrow("static literal");
  expect(() =>
    extractMeta(`export const meta = buildMeta();`, "call.ts"),
  ).toThrow("static literal");
  expect(() =>
    extractMeta(`export const other = 1;`, "missing.ts"),
  ).toThrow("requires `export const meta");
  expect(() =>
    extractMeta(`export const meta = { id: "x" };`, "shape.ts"),
  ).toThrow("operations must be a non-empty array");
});

test("catalog: lexical search ranks by id, description and operations", () => {
  const entries: CatalogEntry[] = [
    {
      file: twinFile,
      meta: {
        id: "cli",
        description: "Deterministic fixture data over a CLI subprocess",
        operations: [
          { name: "customers", inputSchema: { type: "object" } },
          { name: "invoices", description: "Fetch bills for ids", inputSchema: { type: "object" } },
        ],
      },
    },
    {
      file: "other.ts",
      meta: {
        id: "calendar",
        description: "Meetings and appointments",
        operations: [{ name: "events", inputSchema: { type: "object" } }],
      },
    },
  ];
  const [first] = searchCatalog(entries, "fetch bills for customer invoices");
  expect(first?.id).toBe("cli");
  expect(first?.matchedOperations).toEqual(["invoices"]);
  expect(searchCatalog(entries, "zzz-no-match")).toEqual([]);
  expect(searchCatalog(entries, "   ")).toEqual([]);
});

test("catalog: meta plus bindings form a working session (load path)", async () => {
  const entry = await loadCatalogFile(twinFile);
  const { manifest, connector } = await import(
    "../../src/capabilities/cli/connector.ts"
  ).then((m) =>
    m.connectCli(
      entry.meta.id,
      { command: process.execPath, args: [cliTwinScript] },
      Object.fromEntries(
        entry.meta.operations.map((op) => [
          op.name,
          {
            ...(op.description ? { description: op.description } : {}),
            inputSchema: op.inputSchema,
            ...(op.outputSchema ? { outputSchema: op.outputSchema } : {}),
            toArgs: bindings[op.name]!,
          },
        ]),
      ),
    ),
  );
  expect(cliManifest(entry.meta.id, {}).id).toBe("cli");
  const session = await createSession(manifest, connector, new Set(["customers"]));
  try {
    const result = await session.run(
      `import { api } from '@cap/cli';\nexport async function main() { const r = await api.customers({ country: 'DE' }); return r.customers.map(c => c.id); }`,
    );
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual(["c1"]);
  } finally {
    await session.close();
  }
});
