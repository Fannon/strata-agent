import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRexportFixture, REXPORT_TASKS } from "../../examples/repo-tasks/rexport.ts";
import { buildRlogFixture, RLOG_TASKS } from "../../examples/repo-tasks/rlog.ts";
import { buildRlocFixture, RLOC_TASKS } from "../../examples/repo-tasks/rloc.ts";
import { buildRcallFixture, RCALL_TASKS } from "../../examples/repo-tasks/rcall.ts";

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
    const files = await buildRlogFixture(dir, RLOG_TASKS[i]!.fixture);
    const perFile: Record<string, Record<string, number>> = {};
    for (const [name, content] of Object.entries(files)) {
      const base = name.split("/").pop()!;
      const m = /^(\d{4}-\d{2}-\d{2})_.+\.log$/.exec(base);
      if (!base.endsWith(".log") || !m) continue;
      const counts = perFile[m[1]!] ?? { ERROR: 0, WARNING: 0, INFO: 0 };
      perFile[m[1]!] = counts;
      for (const line of content.split("\n"))
        for (const sev of ["ERROR", "WARNING", "INFO"])
          if (line.includes(`[${sev}]`)) counts[sev]!++;
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

// Independent R-CALL oracle recomputation from plain filesystem reads
// (never via the capability adapter): strip comments/strings, resolve each
// name through the file's named imports, and keep only direct calls bound
// to the target symbol in the definition file. The full recomputed set must
// equal the hand-derived oracle.
function rcallCode(line: string): string {
  let out = "";
  let quote = "";
  for (const c of line.split("//")[0]!) {
    if (quote !== "") {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    out += c;
  }
  return out;
}

function rcallRecompute(
  files: Record<string, string>,
  symbol: string,
  defFile: string,
): { path: string; line: number }[] {
  const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
  const importsOf = (path: string): Record<string, { symbol: string; file: string }> => {
    const map: Record<string, { symbol: string; file: string }> = {};
    const dir = dirOf(path);
    for (const raw of files[path]!.split("\n")) {
      const m = /^import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?$/.exec(raw.split("//")[0]!.trim());
      if (!m) continue;
      const rel = m[2]!.startsWith("./") ? m[2]!.slice(2) : m[2]!;
      const file = dir + (rel.endsWith(".js") ? rel.slice(0, -3) + ".ts" : rel);
      for (const part of m[1]!.split(",")) {
        const bits = part.split(" as ").map((x) => x.trim()).filter((x) => x.length > 0);
        if (bits.length === 1) map[bits[0]!] = { symbol: bits[0]!, file };
        else if (bits.length === 2) map[bits[1]!] = { symbol: bits[0]!, file };
      }
    }
    return map;
  };
  const out: { path: string; line: number }[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!(path.startsWith("src/") && path.endsWith(".ts")) || path === defFile) continue;
    const imports = importsOf(path);
    content.split("\n").forEach((raw, i) => {
      const code = rcallCode(raw);
      if (/^\s*import\s/.test(code)) return;
      for (const [local, binding] of Object.entries(imports)) {
        if (binding.symbol !== symbol || binding.file !== defFile) continue;
        if (!new RegExp(`(^|[^.\\w$])${local}\\s*\\(`).test(code)) continue;
        if (new RegExp(`^(export\\s+)?(async\\s+)?function\\s+${local}\\b`).test(code.trim())) continue;
        out.push({ path, line: i + 1 });
      }
    });
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
  return out;
}

test("rcall oracle recomputed independently from fixture files", async () => {
  for (const task of RCALL_TASKS) {
    const files = await buildRcallFixture(dir, task.fixture);
    // Fixture files on disk match the in-memory specification.
    for (const [name, content] of Object.entries(files))
      expect(await readFile(join(dir, name), "utf8")).toBe(content);
    expect(task.expected.calls.length).toBeGreaterThan(0);
    expect(rcallRecompute(files, task.symbol, task.defFile)).toEqual(task.expected.calls);
    // Every decoy path holds a same-name trap yet contributes no oracle row.
    for (const trap of task.decoys.paths) {
      const content = files[trap];
      expect(content).toBeDefined();
      expect(content!.includes(task.symbol)).toBe(true);
      expect(task.expected.calls.some((c) => c.path === trap)).toBe(false);
    }
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    dir = await mkdtemp(join(tmpdir(), "strata-rexport-oracle-"));
  }
});
