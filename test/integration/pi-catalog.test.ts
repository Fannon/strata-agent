import { test, expect, beforeAll, afterAll } from "bun:test";
import { discoverAndLoadExtensions } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let directory = "";
let configFile = "";
let previousConfig: string | undefined;
let hasConfig = false;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "strata-pi-catalog-"));
  configFile = join(directory, "catalog.json");
  await writeFile(
    configFile,
    JSON.stringify({
      transport: "catalog",
      preload: ["cli"],
      allow: { cli: ["customers", "invoices"], "cli-records": ["records"] },
    }),
  );
  previousConfig = process.env.STRATA_CONFIG;
  hasConfig = "STRATA_CONFIG" in process.env;
  process.env.STRATA_CONFIG = configFile;
});
afterAll(async () => {
  if (hasConfig) process.env.STRATA_CONFIG = previousConfig!;
  else delete process.env.STRATA_CONFIG;
  await rm(directory, { recursive: true, force: true });
});

async function started() {
  const loaded = await discoverAndLoadExtensions(
    [fileURLToPath(new URL("../../src/pi/extension.ts", import.meta.url))],
    directory,
    directory,
  );
  expect(loaded.errors).toEqual([]);
  const extension = loaded.extensions.find((e) => e.tools.has("load_capability"))!;
  expect(extension).toBeDefined();
  for (const handler of extension.handlers.get("session_start") ?? [])
    await handler({ type: "session_start", reason: "startup" }, {});
  return extension;
}

test("catalog lifecycle: search, load, then typed records", async () => {
  const extension = await started();
  try {
    const search = extension.tools.get("search_capabilities")!;
    const found = await search.definition.execute(
      "test",
      { query: "bulk records filtering" },
      undefined,
      undefined,
      {} as never,
    );
    const results = JSON.parse(
      (found.content[0] as { type: string; text: string }).text,
    ).results as Array<{ id: string; loaded: boolean }>;
    expect(results[0]?.id).toBe("cli-records");
    expect(results[0]?.loaded).toBe(false);

    const load = extension.tools.get("load_capability")!;
    const loadedResult = await load.definition.execute(
      "test",
      { id: "cli-records" },
      undefined,
      undefined,
      {} as never,
    );
    const body = JSON.parse(
      (loadedResult.content[0] as { type: string; text: string }).text,
    );
    expect(body.module).toBe("@c/cli-records");
    expect(body.operations).toEqual(["records"]);

    const typed = extension.tools.get("typed_program")!;
    const result = await typed.definition.execute(
      "test",
      {
        source:
          "import { api } from '@cap/cli-records'; export async function main() { return (await api.records({ count: 5 })).records.map(r => r.id); }",
      },
      undefined,
      undefined,
      {} as never,
    );
    expect(
      JSON.parse((result.content[0] as { type: string; text: string }).text).result,
    ).toEqual([0, 1, 2, 3, 4]);

    const again = await search.definition.execute(
      "test",
      { query: "bulk records" },
      undefined,
      undefined,
      {} as never,
    );
    const reloaded = JSON.parse(
      (again.content[0] as { type: string; text: string }).text,
    ).results as Array<{ id: string; loaded: boolean }>;
    expect(reloaded.find((r) => r.id === "cli-records")?.loaded).toBe(true);

    await expect(
      load.definition.execute("test", { id: "nope" }, undefined, undefined, {} as never),
    ).rejects.toThrow('Unknown capability "nope"');
  } finally {
    for (const handler of extension.handlers.get("session_shutdown") ?? [])
      await handler({ type: "session_shutdown" }, {});
  }
}, 30000);
