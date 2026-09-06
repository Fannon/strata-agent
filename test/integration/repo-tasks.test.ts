import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRexportFixture, REXPORT_TASKS } from "../../examples/repo-tasks/rexport.ts";

let dir = "";
let files: Record<string, string> = {};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
  files = await buildRexportFixture(dir);
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("oracle records match the fixture specification", async () => {
  for (const [name, content] of Object.entries(files))
    expect(await readFile(join(dir, name), "utf8")).toBe(content);
});

test("every expected record has its defining line in source", async () => {
  for (const task of REXPORT_TASKS) {
    expect(task.expected.exports.length).toBeGreaterThan(0);
    const names = task.expected.exports.map((e) => e.name);
    expect([...names].sort()).toEqual(names);
    for (const record of task.expected.exports) {
      const source = await readFile(join(dir, record.path), "utf8");
      const defining = source
        .split("\n")
        .some((line) => new RegExp(`export\\s+(function|const)\\s+${record.symbol}\\b`).test(line));
      expect(defining).toBe(true);
    }
  }
});

test("decoys and type-only entries are excluded from every oracle", async () => {
  const decoy = await readFile(join(dir, "decoy.ts"), "utf8");
  expect(decoy).toContain("greet");
  for (const task of REXPORT_TASKS) {
    expect(task.expected.exports.some((e) => e.path === "decoy.ts")).toBe(false);
    expect(task.expected.exports.some((e) => e.symbol === "Opts")).toBe(false);
  }
  // The type-only entry point exists in source but the value-only rule drops it.
  expect(files["entry.ts"]).toContain("export type");
});
