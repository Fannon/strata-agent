import { test, expect } from "bun:test";
import { discoverAndLoadExtensions } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const extensionPath = fileURLToPath(
  new URL("../../src/pi/extension.ts", import.meta.url),
);

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "strata-pi-cancel-"));
  const loaded = await discoverAndLoadExtensions(
    [extensionPath],
    directory,
    directory,
  );
  expect(loaded.errors).toEqual([]);
  const extension = loaded.extensions.find((e) =>
    e.tools.has("typed_program"),
  )!;
  for (const handler of extension.handlers.get("session_start") ?? [])
    await handler({ type: "session_start", reason: "startup" }, {});
  const shutdown = async () => {
    for (const handler of extension.handlers.get("session_shutdown") ?? [])
      await handler({ type: "session_shutdown" }, {});
    await rm(directory, { recursive: true, force: true });
  };
  const typed = extension.tools.get("typed_program")!;
  const run = (source: string, signal?: AbortSignal) =>
    typed.definition.execute("test", { source }, signal, undefined, {} as never);
  const stats = async () => {
    const res = await run(
      "import { api } from '@c/fixture'; export async function main() { return await api.stats({}); }",
    );
    const text = (res.content[0] as { type: string; text: string }).text;
    return (JSON.parse(text) as { result: { invocations: number } }).result
      .invocations;
  };
  return { shutdown, run, stats };
}

test("pre-aborted Pi tool call performs no capability calls", async () => {
  const { shutdown, run, stats } = await setup();
  try {
    const before = await stats();
    await expect(
      run(
        "import { api } from '@c/fixture'; export async function main() { return await api.customers({country:'DE'}); }",
        AbortSignal.abort(),
      ),
    ).rejects.toThrow();
    expect(await stats()).toBe(before);
  } finally {
    await shutdown();
  }
}, 20000);

test("mid-call abort cancels a slow capability and the next program succeeds", async () => {
  const { shutdown, run } = await setup();
  try {
    const controller = new AbortController();
    const pending = run(
      "import { api } from '@c/fixture'; export async function main() { return await api.slow({}); }",
      controller.signal,
    );
    setTimeout(() => controller.abort(), 200);
    const start = Date.now();
    await expect(pending).rejects.toThrow();
    expect(Date.now() - start).toBeLessThan(9000);
    const result = await run(
      "import { api } from '@c/fixture'; export async function main() { return (await api.customers({country:'DE'})).customers.map(c => c.id); }",
    );
    expect(
      JSON.parse((result.content[0] as { type: string; text: string }).text)
        .result,
    ).toEqual(["c1"]);
  } finally {
    await shutdown();
  }
}, 20000);
