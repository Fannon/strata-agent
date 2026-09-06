import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sessionFromConfig,
  isStrictBlocked,
  strictBlockedTools,
} from "../../src/pi/extension.ts";

const program = (body: string) =>
  `import { api } from '@cap/cli';\nexport async function main() { ${body} }`;

test("STRATA_CONFIG cli-twin selects the CLI capability with an allowlist", async () => {
  const configured = await sessionFromConfig({
    transport: "cli-twin",
    allow: ["customers", "invoices"],
  });
  const session = configured.session;
  try {
    expect(session.declarations).toContain("@cap/cli");
    const composed = await session.run(
      program(
        "const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.map(i => i.id);",
      ),
    );
    expect(composed.error).toBeUndefined();
    expect(composed.result).toEqual(["i0"]);
    const denied = await session.run(
      program("return await api.records({ count: 5 });"),
    );
    expect(denied.error).toContain("cli.records: policy:");
  } finally {
    await session.close();
  }
});

test("STRATA_CONFIG rejects unknown shapes with a clear error", async () => {
  await expect(sessionFromConfig(null)).rejects.toThrow("must contain an object");
  await expect(
    sessionFromConfig({ transport: "cli-twin", allow: "customers" }),
  ).rejects.toThrow("cli-twin requires allow: string[]");
  await expect(sessionFromConfig({ id: "x" })).rejects.toThrow(
    "requires id, command, args: string[], allow: string[]",
  );
  await expect(sessionFromConfig({ transport: "repo" })).rejects.toThrow(
    "repo requires root",
  );
});

test("STRATA_CONFIG repo wires the native connector with scoped reads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "strata-pi-repo-"));
  try {
    await writeFile(join(dir, "a.txt"), "hello\n");
    const configured = await sessionFromConfig({
      transport: "repo",
      root: dir,
      allow: ["readText", "searchText", "gitStatus"],
    });
    expect(configured.initialIds).toEqual(["repo"]);
    const session = configured.session;
    try {
      expect(session.declarations).toContain("@c/repo");
      const ok = await session.run(
        `import { api } from '@c/repo'; export async function main() { return (await api.readText({ path: "a.txt" })).content; }`,
      );
      expect(ok.error).toBeUndefined();
      expect(ok.result).toBe("hello\n");
      const denied = await session.run(
        `import { api } from '@c/repo'; export async function main() { return await api.readText({ path: "../x" }); }`,
      );
      expect(denied.error ?? "").toContain("denied");
    } finally {
      await session.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("STRATA_CONFIG executor selects the Bun engine without changing contracts", async () => {
  const configured = await sessionFromConfig(
    { transport: "cli-twin", allow: ["customers"] },
    undefined,
    "bun",
  );
  const session = configured.session;
  try {
    const ok = await session.run(program("return await api.customers({ country: 'DE' });"));
    expect(ok.error).toBeUndefined();
    expect(ok.metrics.engine).toBe("bun");
    const denied = await session.run(program("return await api.records({ count: 5 });"));
    expect(denied.error).toContain("cli.records: policy:");
  } finally {
    await session.close();
  }
});

test("strict profile blocks direct-effect tools, keeps typed_program", () => {
  for (const name of ["bash", "read", "write", "edit", "find", "grep", "ls"])
    expect(isStrictBlocked(name)).toBe(true);
  expect(strictBlockedTools.has("typed_program")).toBe(false);
  expect(isStrictBlocked("typed_program")).toBe(false);
  expect(isStrictBlocked("search_capabilities")).toBe(false);
});
