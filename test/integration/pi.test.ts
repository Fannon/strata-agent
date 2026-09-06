import { test, expect } from "bun:test";
import { discoverAndLoadExtensions } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Pi jiti loader registers one tool; lifecycle initializes and cleans runtime", async () => {
  const directory = await mkdtemp(join(tmpdir(), "strata-pi-"));
  const loaded = await discoverAndLoadExtensions(
    [fileURLToPath(new URL("../../src/pi/extension.ts", import.meta.url))],
    directory,
    directory,
  );
  expect(loaded.errors).toEqual([]);
  const extension = loaded.extensions.find((e) =>
    e.tools.has("typed_program"),
  )!;
  expect(extension).toBeDefined();
  expect([...extension.tools.keys()]).toEqual([
    "typed_program",
    "program_details",
    "search_capabilities",
    "load_capability",
  ]);
  try {
    for (const handler of extension.handlers.get("session_start") ?? [])
      await handler({ type: "session_start", reason: "startup" }, {});
    const result = await extension.tools
      .get("typed_program")!
      .definition.execute(
        "test",
        {
          source:
            "import {api} from '@cap/fixture'; export async function main() { return (await api.customers({country:'DE'})).customers.length; }",
        },
        undefined,
        undefined,
        {} as never,
      );
    const content = result.content[0];
    expect(content.type).toBe("text");
    if (content.type === "text")
      expect(JSON.parse(content.text).result).toBe(1);
    const prompt = await extension.handlers.get("before_agent_start")![0](
      { systemPrompt: "base" },
      {},
    );
    expect((prompt as { systemPrompt: string }).systemPrompt).toContain(
      "@cap/fixture",
    );
  } finally {
    for (const handler of extension.handlers.get("session_shutdown") ?? [])
      await handler({ type: "session_shutdown" }, {});
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
