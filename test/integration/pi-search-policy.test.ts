import { test, expect, afterEach } from "bun:test";
import { discoverAndLoadExtensions } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const extensionPath = fileURLToPath(
  new URL("../../src/pi/extension.ts", import.meta.url),
);

type AnyTool = { definition: { execute: (...args: any[]) => Promise<any> } };
type AnyHandlers = Map<string, Array<(event: any, ctx: any) => Promise<unknown>>>;
type Started = {
  extension: { tools: Map<string, AnyTool>; handlers: AnyHandlers };
  directory: string;
  previousConfig: string | undefined;
  hadConfig: boolean;
};

const live: Started[] = [];
afterEach(async () => {
  while (live.length) {
    const started = live.pop()!;
    for (const handler of started.extension.handlers.get("session_shutdown") ?? [])
      await handler({} as never, {} as never);
    if (started.hadConfig) process.env.STRATA_CONFIG = started.previousConfig!;
    else delete process.env.STRATA_CONFIG;
    await rm(started.directory, { recursive: true, force: true });
  }
});

/** Start the real extension with a catalog config through session_start. */
async function startWithAllow(
  allow: Record<string, string[]>,
  preload = ["cli"],
): Promise<Started> {
  const directory = await mkdtemp(join(tmpdir(), "strata-pi-search-policy-"));
  await writeFile(
    join(directory, "catalog.json"),
    JSON.stringify({ transport: "catalog", preload, allow }),
  );
  const previousConfig = process.env.STRATA_CONFIG;
  const hadConfig = "STRATA_CONFIG" in process.env;
  process.env.STRATA_CONFIG = join(directory, "catalog.json");
  const loaded = await discoverAndLoadExtensions(
    [extensionPath],
    directory,
    directory,
  );
  expect(loaded.errors).toEqual([]);
  const extension = loaded.extensions.find((e) =>
    e.tools.has("load_capability"),
  )! as unknown as Started["extension"];
  expect(extension).toBeDefined();
  for (const handler of extension.handlers.get("session_start") ?? [])
    await handler({} as never, {} as never);
  const started = { extension, directory, previousConfig, hadConfig };
  live.push(started);
  return started;
}

type SearchResult = {
  id: string;
  description?: string;
  matchedOperations: string[];
  loaded: boolean;
};

async function search(
  extension: Started["extension"],
  query: string,
  limit?: number,
): Promise<SearchResult[]> {
  const tool = extension.tools.get("search_capabilities")!;
  const params: Record<string, unknown> = { query };
  if (limit !== undefined) params.limit = limit;
  const found = (await tool.definition.execute(
    "test",
    params,
    undefined,
    undefined,
    {},
  )) as unknown as { content: [{ type: string; text: string }] };
  return JSON.parse(found.content[0].text).results as SearchResult[];
}

async function load(
  extension: Started["extension"],
  id: string,
): Promise<Record<string, unknown>> {
  const tool = extension.tools.get("load_capability")!;
  const result = (await tool.definition.execute(
    "test",
    { id },
    undefined,
    undefined,
    {},
  )) as unknown as { content: [{ type: string; text: string }] };
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

const coreAllow = { cli: ["customers", "invoices"] };

test("absent grant: denied module hidden from search, refused on load", async () => {
  const { extension } = await startWithAllow(coreAllow);
  // cli-records is outside the allowlist, so a records query finds nothing …
  expect(await search(extension, "bulk records filtering")).toEqual([]);
  // … while the permitted core module stays discoverable.
  const core = await search(extension, "customers");
  expect(core.map((r) => r.id)).toContain("cli");
  expect(
    core.find((r) => r.id === "cli")?.matchedOperations,
  ).toContain("customers");
  await expect(load(extension, "cli-records")).rejects.toThrow(
    'Capability "cli-records" is not in the configured allowlist',
  );
}, 30000);

test("empty grant set hides and refuses exactly like an absent grant", async () => {
  const { extension } = await startWithAllow({
    ...coreAllow,
    "cli-records": [],
  });
  expect(await search(extension, "bulk records filtering")).toEqual([]);
  await expect(load(extension, "cli-records")).rejects.toThrow(
    'Capability "cli-records" is not in the configured allowlist',
  );
}, 30000);

test("partial grants filter operations before matching and output", async () => {
  const { extension } = await startWithAllow({
    cli: ["customers"],
    "cli-records": ["records"],
  });  // "invoices" survives only in the module description, so cli stays
  // discoverable by description but reports no granted operation match.
  const hits = await search(extension, "invoices");
  const core = hits.find((r) => r.id === "cli");
  expect(core).toBeDefined();
  expect(core?.matchedOperations).toEqual([]);
  expect(
    hits.flatMap((r) => r.matchedOperations),
  ).not.toContain("invoices");
  // The granted operation still matches and is reported.
  const customers = await search(extension, "customers");
  expect(
    customers.find((r) => r.id === "cli")?.matchedOperations,
  ).toEqual(["customers"]);
  // Load output lists only granted operations; the denied call still fails
  // at the unchanged broker policy. cli is preloaded, so load the partial
  // grant through a second instance preloaded with cli-records instead.
  const second = await startWithAllow(
    { cli: ["customers"], "cli-records": ["records"] },
    ["cli-records"],
  );
  const body = await load(second.extension, "cli");
  expect(body.module).toBe("@c/cli");
  expect(body.operations).toEqual(["customers"]);
  const typed = second.extension.tools.get("typed_program")!;
  await expect(
    typed.definition.execute(
      "test",
      {
        source:
          "import { api } from '@c/cli'; export async function main() { return await api.invoices({ customerIds: ['c0'] }); }",
      },
      undefined,
      undefined,
      {},
    ),
  ).rejects.toThrow("policy");
}, 30000);

test("denied hits cannot crowd out allowed hits under limit", async () => {
  const { extension } = await startWithAllow(coreAllow);
  // Unfiltered, cli-records outranks cli on "customers records" (records is
  // an id-token hit weighing double vs cli's single text-token hit), so
  // limit 1 would return only the denied module.
  const hits = await search(extension, "customers records", 1);
  expect(hits.map((r) => r.id)).toEqual(["cli"]);
}, 30000);

test("grants naming no declared operation hide the module and refuse load", async () => {
  const { extension } = await startWithAllow({
    cli: ["customers"],
    "cli-records": ["nonexistent-op"],
  });
  expect(await search(extension, "bulk records filtering")).toEqual([]);
  expect(await search(extension, "records")).toEqual([]);
  // cli stays discoverable by its granted operation.
  const core = await search(extension, "customers");
  expect(core.map((r) => r.id)).toEqual(["cli"]);
  expect(core[0]?.matchedOperations).toEqual(["customers"]);
  await expect(load(extension, "cli-records")).rejects.toThrow(
    "grants no known operations",
  );
  // Preload fails fast the same way: startup leaves the runtime
  // unavailable with the grant error as the cause.
  const bad = await startWithAllow({ "cli-records": ["nope"] }, [
    "cli-records",
  ]);
  await expect(search(bad.extension, "records")).rejects.toThrow(
    "grants no known operations",
  );
}, 30000);

test("search and load fail closed after shutdown", async () => {
  const { extension } = await startWithAllow(coreAllow);
  expect(await search(extension, "customers")).not.toEqual([]);
  for (const handler of extension.handlers.get("session_shutdown") ?? [])
    await handler({} as never, {} as never);
  await expect(search(extension, "customers")).rejects.toThrow(
    "Typed runtime unavailable",
  );
  await expect(load(extension, "cli")).rejects.toThrow(
    "Typed runtime unavailable",
  );
}, 30000);
