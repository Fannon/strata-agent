import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRexportFixture, REXPORT_TASKS } from "../../examples/repo-tasks/rexport.ts";
import { buildRlogFixture, RLOG_TASKS } from "../../examples/repo-tasks/rlog.ts";
import { buildRlocFixture, RLOC_TASKS } from "../../examples/repo-tasks/rloc.ts";

let dir = "";
let files: Record<string, string> = {};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
  files = await buildRexportFixture(dir, 0);
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
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
    files = await buildRexportFixture(dir, task.fixture);
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
  for (const task of REXPORT_TASKS) {
    for (const trap of task.decoys.paths)
      expect(task.expected.exports.some((e) => e.path === trap)).toBe(false);
    for (const symbol of task.decoys.symbols)
      expect(task.expected.exports.some((e) => e.symbol === symbol)).toBe(false);
  }
  // A type-only entry point exists in source but the value-only rule drops it.
  expect(await taskExpectedHasTypeExport()).toBe(true);
});

async function taskExpectedHasTypeExport(): Promise<boolean> {
  for (const fixture of [0, 1]) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
    files = await buildRexportFixture(dir, fixture);
    if (Object.values(files).some((content) => content.includes("export type"))) return true;
  }
  return false;
}

test("rlog oracle recomputed independently from fixture files", async () => {
  for (let i = 0; i < RLOG_TASKS.length; i++) {
    const task = RLOG_TASKS[i]!;
    const files = await buildRlogFixture(dir, i as 0 | 1);
    const perFile: Record<string, Record<string, number>> = {};
    for (const [name, content] of Object.entries(files)) {
      const base = name.split("/").pop()!;
      const m = /^(\d{4}-\d{2}-\d{2})_.+\.log$/.exec(base);
      if (!base.endsWith(".log") || !m) continue;
      const counts: Record<string, number> = { ERROR: 0, WARNING: 0, INFO: 0 };
      for (const line of content.split("\n"))
        for (const sev of ["ERROR", "WARNING", "INFO"])
          if (line.includes(`[${sev}]`)) counts[sev]!++;
      perFile[m[1]!] = counts;
    }
    const at = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
    const inRange = (d: string, from: string, to: string) => at(d) >= at(from) && at(d) <= at(to);
    const shift = (days: number) => new Date(at(task.refDate) - days * 86400000).toISOString().slice(0, 10);
    const ranges: Record<string, [string, string] | null> = {
      today: [task.refDate, task.refDate],
      last_7_days: [shift(6), task.refDate],
      last_30_days: [shift(29), task.refDate],
      month_to_date: [`${task.refDate.slice(0, 8)}01`, task.refDate],
      total: null,
    };
    const periods: Record<string, Record<string, number>> = {};
    for (const [period, range] of Object.entries(ranges)) {
      const total: Record<string, number> = { ERROR: 0, WARNING: 0, INFO: 0 };
      for (const [date, counts] of Object.entries(perFile))
        if (range === null || inRange(date, range[0], range[1]))
          for (const sev of ["ERROR", "WARNING", "INFO"]) total[sev]! += counts[sev]!;
      periods[period] = total;
    }
    expect({ periods }).toEqual(task.expected);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
  }
});

test("rloc oracle locations and decoys verified against source", async () => {
  for (let i = 0; i < RLOC_TASKS.length; i++) {
    const task = RLOC_TASKS[i]!;
    const files = await buildRlocFixture(dir, i);
    const lines = files[task.expected.path]!.split("\n");
    expect(lines[task.expected.line - 1]!.trim()).toBe(task.expected.definition);
    // Same-name traps exist but resolve elsewhere or out of scope.
    const trapHits = Object.entries(files)
      .filter(([name]) => name !== task.expected.path)
      .flatMap(([name, content]) => content.split("\n").map((l) => ({ name, l })))
      .filter(({ l }) => l.includes(task.expected.name));
    expect(trapHits.length).toBeGreaterThan(0);
    for (const { name } of trapHits) expect(name).not.toBe(task.expected.path);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
  }
});
