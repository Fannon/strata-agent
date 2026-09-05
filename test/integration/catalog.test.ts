import { test, expect } from "bun:test";
import { isDeepStrictEqual } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  extractMeta,
  loadCatalogFile,
  searchCatalog,
  type CatalogEntry,
} from "../../src/capabilities/catalog.ts";
import { connectCli } from "../../src/capabilities/cli/connector.ts";
import { createSession } from "../../src/session.ts";
import {
  cliTwinOperations,
  cliTwinScript,
} from "../../examples/cli-twin.ts";

const catalogDir = fileURLToPath(
  new URL("../../catalog/", import.meta.url),
);
const coreFile = join(catalogDir, "cli-core.ts");
const recordsFile = join(catalogDir, "cli-records.ts");

test("catalog: core and records entries extract statically", async () => {
  const core = await loadCatalogFile(coreFile);
  expect(core.meta.id).toBe("cli");
  expect(core.meta.operations.map((op) => op.name)).toEqual([
    "customers",
    "invoices",
  ]);
  expect(core.meta.transport).toEqual({ kind: "cli-twin" });
  const records = await loadCatalogFile(recordsFile);
  expect(records.meta.id).toBe("cli-records");
  expect(records.meta.operations.map((op) => op.name)).toEqual(["records"]);
  expect(records.meta.related).toEqual(["cli"]);
});

test("catalog: entry schemas match the twin operation schemas", async () => {
  const core = await loadCatalogFile(coreFile);
  const records = await loadCatalogFile(recordsFile);
  for (const entry of [core, records]) {
    for (const op of entry.meta.operations) {
      const twin = cliTwinOperations[op.name];
      expect(twin, `twin covers ${op.name}`).toBeDefined();
      expect(isDeepStrictEqual(op.inputSchema, twin!.inputSchema)).toBe(true);
      expect(isDeepStrictEqual(op.outputSchema, twin!.outputSchema)).toBe(true);
    }
  }
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

test("catalog: lexical search ranks by id, description and operations", async () => {
  const core = await loadCatalogFile(coreFile);
  const records = await loadCatalogFile(recordsFile);
  const entries: CatalogEntry[] = [core, records];
  const [first] = searchCatalog(entries, "bulk records filtering");
  expect(first?.id).toBe("cli-records");
  expect(first?.matchedOperations).toEqual(["records"]);
  expect(searchCatalog(entries, "zzz-no-match")).toEqual([]);
  expect(searchCatalog(entries, "   ")).toEqual([]);
});

async function entrySession(entry: CatalogEntry, allowed: string[]) {
  const module = (await import(pathToFileURL(entry.file).href)) as {
    bindings: Record<string, (input: Record<string, unknown>) => string[]>;
  };
  const { manifest, connector } = await connectCli(
    entry.meta.id,
    { command: process.execPath, args: [cliTwinScript] },
    Object.fromEntries(
      entry.meta.operations.map((op) => [
        op.name,
        {
          ...(op.description ? { description: op.description } : {}),
          inputSchema: op.inputSchema,
          ...(op.outputSchema ? { outputSchema: op.outputSchema } : {}),
          toArgs: module.bindings[op.name]!,
        },
      ]),
    ),
  );
  return createSession(manifest, connector, new Set(allowed));
}

test("catalog: core-only session gains records through load()", async () => {
  const core = await loadCatalogFile(coreFile);
  const records = await loadCatalogFile(recordsFile);
  const session = await entrySession(core, ["customers", "invoices"]);
  try {
    const before = await session.run(
      `import { api } from '@cap/cli-records';\nexport async function main() { return await api.records({ count: 5 }); }`,
    );
    expect(before.error).toContain("compilation failed");
    expect(before.metrics.diagnostics.join("\n")).toContain("cli-records");
    const added = await (async () => {
      const module = (await import(pathToFileURL(records.file).href)) as {
        bindings: Record<string, (input: Record<string, unknown>) => string[]>;
      };
      const { manifest, connector } = await connectCli(
        records.meta.id,
        { command: process.execPath, args: [cliTwinScript] },
        Object.fromEntries(
          records.meta.operations.map((op) => [
            op.name,
            {
              ...(op.description ? { description: op.description } : {}),
              inputSchema: op.inputSchema,
              ...(op.outputSchema ? { outputSchema: op.outputSchema } : {}),
              toArgs: module.bindings[op.name]!,
            },
          ]),
        ),
      );
      try {
        return await session.load(manifest, connector, new Set(["records"]));
      } catch (error) {
        await connector.close();
        throw error;
      }
    })();
    expect(added).toContain("@cap/cli-records");
    expect(session.declarations).toContain("@cap/cli-records");
    const after = await session.run(
      `import { api } from '@cap/cli-records';\nexport async function main() { const r = await api.records({ count: 5 }); return r.records.map(r => r.id); }`,
    );
    expect(after.error).toBeUndefined();
    expect(after.result).toEqual([0, 1, 2, 3, 4]);
    const composed = await session.run(
      `import { api } from '@cap/cli';\nimport { api as rec } from '@cap/cli-records';\nexport async function main() { const c = await api.customers({ country: 'DE' }); const r = await rec.records({ count: 3 }); return [c.customers.length, r.records.length]; }`,
    );
    expect(composed.error).toBeUndefined();
    expect(composed.result).toEqual([1, 3]);
  } finally {
    await session.close();
  }
});

test("catalog: same-named operations stay isolated per capability", async () => {
  const core = await loadCatalogFile(coreFile);
  const session = await entrySession(core, ["customers", "invoices"]);
  try {
    // Second module reuses the customers operation name under another id.
    const { manifest, connector } = await connectCli(
      "cli-shadow",
      { command: process.execPath, args: [cliTwinScript] },
      {
        customers: {
          description: "Shadow copy",
          inputSchema: { type: "object", properties: {}, required: [] },
          toArgs: () => ["customers", "--country", "US"],
        },
      },
    );
    try {
      await session.load(manifest, connector, new Set());
      const result = await session.run(
        `import { api } from '@cap/cli';\nimport { api as shadow } from '@cap/cli-shadow';\nexport async function main() { const a = await api.customers({ country: 'DE' }); let denied = \"\"; try { await shadow.customers({}); } catch (e) { denied = String(e); } return [a.customers.map(c => c.id), denied.includes(\"cli-shadow.customers: policy:\")]; }`,
      );
      expect(result.error).toBeUndefined();
      expect(result.result).toEqual([["c1"], true]);
    } finally {
      await connector.close();
    }
  } finally {
    await session.close();
  }
});
