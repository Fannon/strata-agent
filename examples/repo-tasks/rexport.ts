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
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

export interface RexportTask {
  id: string;
  ask: string;
  expected: { exports: { name: string; path: string; symbol: string }[] };
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

export const REXPORT_TASKS: RexportTask[] = [
  {
    id: "R-EXPORT-1",
    ask: 'Package atlas, public subpath ".". Follow value re-exports only (ignore `export type`). Return exactly {"exports": [{"name","path","symbol"}]} sorted by name, where path is the defining file repo-relative and symbol the defined name.',
    expected: {
      exports: [
        { name: "greet", path: "core.ts", symbol: "greet" },
        { name: "util", path: "util.ts", symbol: "helper" },
      ],
    },
  },
  {
    id: "R-EXPORT-2",
    ask: 'Package atlas, public subpath "./lite". Follow value re-exports only. Return exactly {"exports": [{"name","path","symbol"}]} sorted by name.',
    expected: {
      exports: [{ name: "welcome", path: "core.ts", symbol: "greet" }],
    },
  },
];

/** Write the fixture into an existing directory. Returns the file map for oracle checks. */
export async function buildRexportFixture(dir: string): Promise<Record<string, string>> {
  for (const [name, content] of Object.entries(FILES)) await writeFile(join(dir, name), content);
  return { ...FILES };
}

// Human-written reference composition (kept out of candidate prompts): read
// the manifest, follow one re-export level, confirm definitions by text
// search. Proves the task is solvable through the supported read/search API.
const REFERENCE = `import { api } from '@c/repo';
export async function main() {
  const subpath = "__SUBPATH__";
  const pkg = JSON.parse((await api.readText({ path: "package.json" })).content);
  const entry = (pkg.exports as Record<string, string>)[subpath].replace(/^\\.\\//, "");
  const entrySrc = (await api.readText({ path: entry })).content;
  const out: { name: string; path: string; symbol: string }[] = [];
  const re = /export\\s+(?!type\\b)\\{\\s*([A-Za-z_$][\\w$]*)(?:\\s+as\\s+([A-Za-z_$][\\w$]*))?\\s*\\}\\s*from\\s*["']([^"']+)["']/g;
  for (let m = re.exec(entrySrc); m; m = re.exec(entrySrc)) {
    const symbol = m[1]!;
    const name = m[2] ?? symbol;
    const target = m[3]!.replace(/\\.js$/, ".ts").replace(/^\\.\\//, "");
    const found = await api.searchText({ pattern: symbol, include: [target] });
    const def = found.matches.find((l) => l.text.includes(symbol));
    if (!def) throw new Error("no definition for " + symbol + " in " + target);
    out.push({ name, path: target, symbol });
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
    await buildRexportFixture(dir);
    for (const task of REXPORT_TASKS) {
      const subpath = task.id === "R-EXPORT-1" ? "." : "./lite";
      const quick = await runReference(dir, "quickjs", subpath);
      const bun = await runReference(dir, "bun", subpath);
      if (!isDeepStrictEqual(quick, bun))
        throw new Error(`${task.id}: engines disagree:\n${JSON.stringify({ quick, bun }, null, 2)}`);
      if (!isDeepStrictEqual(quick, task.expected))
        throw new Error(`${task.id}: unexpected answer:\n${JSON.stringify(quick, null, 2)}`);
      console.log(`ok ${task.id} (engines agree, oracle matched)`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
