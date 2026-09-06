// R-EXPORT reference task (issue 028): trace public exports through a small
// original fixture. Runnable offline check AND importer of the fixture builder
// for later trial runners. No model calls.
//
// Fixture contract (stated in the task prompt, exhaustive for this fixture):
// - package.json "exports" maps public subpaths to entry files.
// - Supported re-export syntax: export { x } from "./p(.js)" and
//   export { x as y } from "./p(.js)". A from-path ending .js resolves to the
//   same-named .ts file. No `export *`, no dynamic exports.
// - Supported definitions: direct `export function` / `export const`.
// - Task rule "value exports only": `export type` entries are ignored.
// - The graph is finite and acyclic.
//
// Oracle: hand-derived from the fixture specification below, verified against
// source by test/integration/repo-tasks.test.ts using plain filesystem reads
// (independent of the capability adapter being compared).
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

export interface RexportTask {
  id: string;
  ask: string;
  /** Index into FIXTURES below. */
  fixture: number;
  subpath: string;
  expected: { exports: { name: string; path: string; symbol: string }[] };
  /** Same-name/type traps that must stay out of the oracle. */
  decoys: { paths: string[]; symbols: string[] };
}

const FILES: Record<string, string> = {
  "package.json":
    JSON.stringify({ name: "atlas", version: "2.4.1", exports: { ".": "./entry.ts", "./lite": "./lite.ts" } }, null, 2) + "\n",
  "entry.ts":
    'export { greet } from "./core.js";\n' +
    'export { helper as util } from "./util.js";\n' +
    'export type { Opts } from "./types.js";\n',
  "core.ts":
    "export function greet(name: string) {\n  return `hello ${name}`;\n}\nfunction internal() {\n  return 0;\n}\n",
  "util.ts":
    "export function helper(n: string) {\n  return n.trim();\n}\nexport const VERSION = \"2.4.1\";\n",
  "types.ts": "export type Opts = { verbose: boolean };\nexport interface Cfg {\n  root: string;\n}\n",
  "lite.ts": 'export { greet as welcome } from "./core.js";\n',
  "decoy.ts": "export function greet(name: string) {\n  return `decoy ${name}`;\n}\n",
};

const FILES_HELDOUT: Record<string, string> = {
  "package.json":
    JSON.stringify({ name: "beacon", version: "1.0.0", exports: { ".": "./src/index.ts", "./util": "./src/str.ts" } }, null, 2) + "\n",
  "src/index.ts":
    'export { parse as parseCfg } from "./cfg.js";\n' +
    'export { run } from "./run.js";\n' +
    'export type { Mode } from "./mode.js";\n',
  "src/cfg.ts":
    "export function parse(text: string): Record<string, string> {\n  return {};\n}\nexport const DEFAULT_PORT = 8080;\n",
  "src/run.ts": "export function run(): void {\n}\n",
  "src/mode.ts": "export type Mode = \"a\" | \"b\";\n",
  "src/parse.ts": "export function parse(s: string): string[] {\n  return [];\n}\n",
  "src/str.ts": 'export { trim as tidy } from "./text.js";\n',
  "src/text.ts": "export function trim(s: string): string {\n  return s.trim();\n}\n",
};


// Wave-2 fixture (hypothesis-targeted): two-hop re-export chain. a.ts
// re-exports q from b.ts, which re-exports it from c.ts; b.ts also defines
// an unrelated qHelper, d.ts defines an unreachable q decoy.
const FILES_CHAIN: Record<string, string> = {
  "package.json":
    JSON.stringify({ name: "chain", version: "1.0.0", exports: { ".": "./a.ts" } }, null, 2) + "\n",
  "a.ts": 'export { q } from "./b.js";\n',
  "b.ts":
    'export { q } from "./c.js";\n' +
    "export function qHelper(): number {\n  return 0;\n}\n",
  "c.ts": "export function q(id: string): string {\n  return id;\n}\n",
  "d.ts": "export function q(): void {\n}\n",
};

const FIXTURES = [FILES, FILES_HELDOUT, FILES_CHAIN];

export const REXPORT_TASKS: RexportTask[] = [
  {
    id: "R-EXPORT-1",
    ask: 'Package atlas, public subpath ".". Follow value re-exports only (ignore `export type`). Return exactly {"exports": [{"name","path","symbol"}]} sorted by name, where path is the defining file repo-relative and symbol the defined name.',
    fixture: 0,
    subpath: ".",
    expected: {
      exports: [
        { name: "greet", path: "core.ts", symbol: "greet" },
        { name: "util", path: "util.ts", symbol: "helper" },
      ],
    },
    decoys: { paths: ["decoy.ts"], symbols: ["Opts"] },
  },
  {
    id: "R-EXPORT-2",
    ask: 'Package atlas, public subpath "./lite". Follow value re-exports only. Return exactly {"exports": [{"name","path","symbol"}]} sorted by name.',
    fixture: 0,
    subpath: "./lite",
    expected: {
      exports: [{ name: "welcome", path: "core.ts", symbol: "greet" }],
    },
    decoys: { paths: ["decoy.ts"], symbols: ["Opts", "VERSION"] },
  },
  {
    id: "R-EXPORT-3",
    ask: 'Package beacon, public subpath ".". Follow value re-exports only (ignore `export type`). Return exactly {"exports": [{"name","path","symbol"}]} sorted by name, where path is the defining file repo-relative and symbol the defined name.',
    fixture: 1,
    subpath: ".",
    expected: {
      exports: [
        { name: "parseCfg", path: "src/cfg.ts", symbol: "parse" },
        { name: "run", path: "src/run.ts", symbol: "run" },
      ],
    },
    decoys: { paths: ["src/parse.ts"], symbols: ["Mode", "DEFAULT_PORT"] },
  },
  {
    id: "R-EXPORT-4",
    ask: 'Package beacon, public subpath "./util". Follow value re-exports only. Return exactly {"exports": [{"name","path","symbol"}]} sorted by name.',
    fixture: 1,
    subpath: "./util",
    expected: {
      exports: [{ name: "tidy", path: "src/text.ts", symbol: "trim" }],
    },
    decoys: { paths: ["src/parse.ts"], symbols: ["Mode"] },
  },
  {
    id: "R-EXPORT-5",
    ask: 'Package chain, public subpath ".". Follow value re-exports through every level until the defining file (more than one hop may be needed). Return exactly {"exports": [{"name","path","symbol"}]} sorted by name.',
    fixture: 2,
    subpath: ".",
    expected: {
      exports: [{ name: "q", path: "c.ts", symbol: "q" }],
    },
    decoys: { paths: ["d.ts"], symbols: ["qHelper"] },
  },
];

/** Write one instance fixture into an existing directory. */
export async function buildRexportFixture(dir: string, instance: number): Promise<Record<string, string>> {
  const files = FIXTURES[instance]!;
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return { ...files };
}

// Human-written reference composition (kept out of candidate prompts): read
// the manifest, follow one re-export level, confirm definitions by text
// search. Proves the task is solvable through the supported read/search API.
const REFERENCE = `import { api } from '@c/repo';
function noDot(p: string): string {
  return p.startsWith("./") ? p.slice(2) : p;
}
function parseExports(src: string, dir: string): { symbol: string; name: string; file: string }[] {
  const out: { symbol: string; name: string; file: string }[] = [];
  for (const raw of src.split("\\n")) {
    const t = raw.trim();
    if (!t.startsWith("export {") || t.indexOf("export type") !== -1) continue;
    const fromAt = t.indexOf("} from ");
    if (fromAt === -1) continue;
    const names = t.slice("export {".length, fromAt).trim();
    const fromQ = t.slice(fromAt + 6).trim();
    const unquoted = fromQ.endsWith(";") ? fromQ.slice(0, -1) : fromQ;
    const from = unquoted.slice(1, -1);
    const target = dir + noDot(from.endsWith(".js") ? from.slice(0, -3) + ".ts" : from);
    for (const part of names.split(",")) {
      const bits = part.split(" as ").map((x) => x.trim());
      const symbol = bits[0]!;
      out.push({ symbol, name: bits.length > 1 ? bits[1]! : symbol, file: target });
    }
  }
  return out;
}
function hasDef(src: string, symbol: string): boolean {
  return src.split("\\n").some((l) => l.startsWith("export function " + symbol + "(") || l.startsWith("export const " + symbol));
}
export async function main() {
  const subpath = "__SUBPATH__";
  const pkg = JSON.parse((await api.readText({ path: "package.json" })).content);
  const entry = noDot((pkg.exports as Record<string, string>)[subpath]);
  const entryDir = entry.indexOf("/") === -1 ? "" : entry.slice(0, entry.lastIndexOf("/") + 1);
  const entrySrc = (await api.readText({ path: entry })).content;
  const seen = new Set<string>();
  let frontier = parseExports(entrySrc, entryDir);
  const out: { name: string; path: string; symbol: string }[] = [];
  for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
    const next: { symbol: string; name: string; file: string }[] = [];
    for (const r of frontier) {
      const key = r.file + "#" + r.symbol;
      if (seen.has(key)) continue;
      seen.add(key);
      const src = (await api.readText({ path: r.file })).content;
      if (hasDef(src, r.symbol)) {
        out.push({ name: r.name, path: r.file, symbol: r.symbol });
        continue;
      }
      const dir2 = r.file.indexOf("/") === -1 ? "" : r.file.slice(0, r.file.lastIndexOf("/") + 1);
      for (const r2 of parseExports(src, dir2)) {
        if (r2.symbol === r.symbol) next.push({ symbol: r2.symbol, name: r.name, file: r2.file });
      }
    }
    frontier = next;
  }
  out.sort((a, b) => (a.name < b.name ? -1 : 1));
  return { exports: out };
}`;

async function runReference(dir: string, engine: ExecutorKind, subpath: string) {
  const { manifest, connector } = await connectRepo({ root: dir });
  const session = await createSession(
    manifest,
    connector,
    new Set(["readText", "searchText", "listFiles"]),
    { executor: engine },
  );
  try {
    const out = await session.run(REFERENCE.replace("__SUBPATH__", subpath));
    if (out.error) throw new Error(`${subpath}@${engine}: ${out.error}`);
    return out.result;
  } finally {
    await session.close();
  }
}

if (import.meta.main) {
  const dir = await mkdtemp(join(tmpdir(), "strata-rexport-"));
  try {
    for (const task of REXPORT_TASKS) {
      await buildRexportFixture(dir, task.fixture);
      const quick = await runReference(dir, "quickjs", task.subpath);
      const bun = await runReference(dir, "bun", task.subpath);
      if (!isDeepStrictEqual(quick, bun))
        throw new Error(`${task.id}: engines disagree:\n${JSON.stringify({ quick, bun }, null, 2)}`);
      if (!isDeepStrictEqual(quick, task.expected))
        throw new Error(`${task.id}: unexpected answer:\n${JSON.stringify(quick, null, 2)}`);
      console.log(`ok ${task.id} (engines agree, oracle matched)`);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
