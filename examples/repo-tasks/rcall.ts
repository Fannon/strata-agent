// R-CALL reference task (issue 004 confirmation): disambiguate direct call
// sites of one exported binding over seeded repositories. Runnable offline
// check AND importer of the fixture builder for later trial runners. No
// model calls.
//
// Provenance: ORIGINAL fixtures (no upstream case, description, or snapshot
// copied). Follows the 028 R-CALL contract: given a definition path and
// export name, report sorted {path,line} direct calls to that binding in the
// declared TS source scope (here: files matching src/**/*.ts; test/ and all
// other locations are out of scope). A call counts only when the called name
// is bound to the target by a named import from the definition file in the
// same file, including `as` aliases. Comment text, string-literal contents,
// dynamic property calls, same-name locals, other-path imports, and the
// definition file itself are excluded. Line means the 1-based line where the
// call expression starts (multiline calls count at their first line).
//
// Fixture limits (stated in each ask, exhaustive): single-line `import`
// statements only, no `export *`, no dynamic imports, no block comments, no
// backtick literals. The oracle is hand-derived from the fixture
// specification below and recomputed independently from plain filesystem
// reads in test/integration/repo-tasks.test.ts (never via the adapter).
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

export interface RcallTask {
  id: string;
  ask: string;
  /** Index into FIXTURES below. */
  fixture: number;
  /** Exported target symbol. */
  symbol: string;
  /** Defining file, repo-relative. */
  defFile: string;
  expected: { calls: { path: string; line: number }[] };
  /** Traps that must stay out of the oracle (scope/binding exclusions). */
  decoys: { paths: string[]; describe: string[] };
}

// Instance 1: target `format` in src/format.ts. One plain call, one aliased
// multiline call; traps are a same-name local (no import), a comment, a
// string literal holding `format(`, and a test-file call out of scope.
const CALL_1: Record<string, string> = {
  "src/format.ts":
    "export function format(value: string): string {\n  return value.trim();\n}\n",
  "src/report.ts":
    'import { format } from "./format.js";\n' +
    "\n" +
    "export function reportTitle(title: string): string {\n" +
    "  return format(title);\n" +
    "}\n" +
    "\n" +
    "// format the footer below (comment, not a call)\n" +
    'export const hint = "call format( to render";\n',
  "src/summary.ts":
    'import { format as fmt } from "./format.js";\n' +
    "\n" +
    "export function summary(items: string[]): string {\n" +
    "  return fmt(\n" +
    "    items.join(\", \"),\n" +
    "  );\n" +
    "}\n",
  "src/legacy.ts":
    "function format(raw: string): string {\n" +
    "  return raw;\n" +
    "}\n" +
    "\n" +
    "export function legacyReport(raw: string): string {\n" +
    "  return format(raw);\n" +
    "}\n",
  "test/format.test.ts":
    'import { format } from "../src/format.js";\n' +
    "\n" +
    "export function check(): boolean {\n" +
    '  return format("x") === "x";\n' +
    "}\n",
};

// Instance 2: target `load` in src/store.ts. One plain call, one aliased
// multiline call; traps are an other-path import (./cache.js), a same-name
// definition in cache.ts, a dynamic property call, a comment, and a
// test-file call out of scope.
const CALL_2: Record<string, string> = {
  "src/store.ts":
    "export function load(key: string): string {\n  return key;\n}\n",
  "src/cache.ts":
    'export function load(key: string): string {\n  return "cached:" + key;\n}\n',
  "src/app.ts":
    'import { load } from "./store.js";\n' +
    "\n" +
    "export function boot(): string {\n" +
    '  const a = load("config");\n' +
    "  return a;\n" +
    "}\n" +
    "\n" +
    '// load("later") is deferred (comment, not a call)\n',
  "src/prefetch.ts":
    'import { load as fetch } from "./store.js";\n' +
    "\n" +
    "export function warm(key: string): string {\n" +
    "  return fetch(\n" +
    "    key,\n" +
    "  );\n" +
    "}\n",
  "src/widget.ts":
    'import { load } from "./cache.js";\n' +
    "\n" +
    "export function render(key: string): string {\n" +
    "  return load(key);\n" +
    "}\n",
  "src/remote.ts":
    "export function pull(client: { load: (k: string) => string }, key: string): string {\n" +
    "  return client.load(key);\n" +
    "}\n",
  "test/store.test.ts":
    'import { load } from "../src/store.js";\n' +
    "\n" +
    "export function check(): boolean {\n" +
    '  return load("x") === "x";\n' +
    "}\n",
};

const FIXTURES = [CALL_1, CALL_2];

const SCOPE_RULE =
  "in TypeScript files under `src/` (only files matching `src/**/*.ts`; `test/` and all other locations are out of scope)";

function askFor(symbol: string, defFile: string, importPath: string): string {
  return (
    `Function \`${symbol}\` is defined and exported in \`${defFile}\`. ` +
    `Find every direct call to that binding ${SCOPE_RULE}. ` +
    `A call counts only when the called name is bound to the target by a named import from the definition file in the same file ` +
    `(\`import { ${symbol} } from "${importPath}"\` binds \`${symbol}\`, and \`import { ${symbol} as <alias> } from "${importPath}"\` binds \`<alias>\`; ` +
    `"${importPath}" means \`${defFile}\` relative to the importing file). ` +
    `Ignore comment text and string-literal contents; dynamic property calls (\`obj.${symbol}(\`, \`x["${symbol}"]\`); ` +
    `calls whose name is defined locally in the same file or imported from any other path; and calls in the definition file itself. ` +
    `Report exactly {"calls": [{"path" (repo-relative), "line" (1-based line where the call expression starts)}]} sorted by path, then line.`
  );
}

export const RCALL_TASKS: RcallTask[] = [
  {
    id: "R-CALL-1",
    ask: askFor("format", "src/format.ts", "./format.js"),
    fixture: 0,
    symbol: "format",
    defFile: "src/format.ts",
    expected: {
      calls: [
        { path: "src/report.ts", line: 4 },
        { path: "src/summary.ts", line: 4 },
      ],
    },
    decoys: {
      paths: ["src/legacy.ts", "test/format.test.ts"],
      describe: ["same-name local without import", "out-of-scope test call", "comment and string traps"],
    },
  },
  {
    id: "R-CALL-2",
    ask: askFor("load", "src/store.ts", "./store.js"),
    fixture: 1,
    symbol: "load",
    defFile: "src/store.ts",
    expected: {
      calls: [
        { path: "src/app.ts", line: 4 },
        { path: "src/prefetch.ts", line: 4 },
      ],
    },
    decoys: {
      paths: ["src/widget.ts", "src/remote.ts", "test/store.test.ts"],
      describe: ["other-path import", "dynamic property call", "out-of-scope test call", "comment trap"],
    },
  },
];

/** Write one instance fixture into an existing directory. */
export async function buildRcallFixture(dir: string, instance: number): Promise<Record<string, string>> {
  const files = FIXTURES[instance]!;
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return { ...files };
}

// Human-written reference composition (kept out of candidate prompts):
// search the symbol, read matched src/ files to learn import aliases bound
// to the target, follow up with alias searches, then keep only lines that
// start a direct call through a bound name. Proves the task is solvable
// through the supported read/search API.
const REFERENCE = `import { api } from '@c/repo';
const SYMBOL = "__SYMBOL__";
const DEFFILE = "__DEFFILE__";
function stripStrings(s: string): string {
  let out = "";
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (quote !== "") {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    out += c;
  }
  return out;
}
function codeOf(line: string): string {
  return stripStrings(line.split("//")[0] ?? "");
}
function esc(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "\\\\$&");
}
function dirOf(path: string): string {
  const at = path.lastIndexOf("/");
  return at === -1 ? "" : path.slice(0, at + 1);
}
function resolveFrom(dir: string, from: string): string {
  const rel = from.startsWith("./") ? from.slice(2) : from;
  return dir + (rel.endsWith(".js") ? rel.slice(0, -3) + ".ts" : rel);
}
function parseImports(src: string, dir: string): Record<string, { symbol: string; file: string }> {
  const map: Record<string, { symbol: string; file: string }> = {};
  for (const raw of src.split("\\n")) {
    // Comment-stripped but string-preserving: the from-path needs
    // its quotes (fixture import lines never hold // inside a string).
    const line = raw.split("//")[0]!.trim();
    const m = /^import\\s*\\{([^}]*)\\}\\s*from\\s*["']([^"']+)["'];?$/.exec(line);
    if (!m) continue;
    const file = resolveFrom(dir, m[2]!);
    for (const part of m[1]!.split(",")) {
      const bits = part.split(" as ").map((x) => x.trim()).filter((x) => x.length > 0);
      if (bits.length === 1) map[bits[0]!] = { symbol: bits[0]!, file };
      else if (bits.length === 2) map[bits[1]!] = { symbol: bits[0]!, file };
    }
  }
  return map;
}
function isDefLine(code: string, name: string): boolean {
  return new RegExp("^(export\\\\s+)?(async\\\\s+)?function\\\\s+" + esc(name) + "\\\\b").test(code.trim());
}
function isCall(code: string, name: string): boolean {
  return new RegExp("(^|[^.\\\\w$])" + esc(name) + "\\\\s*\\\\(").test(code);
}
function inScope(path: string): boolean {
  return path.startsWith("src/") && path.endsWith(".ts");
}
export async function main() {
  const bindings: Record<string, Record<string, { symbol: string; file: string }>> = {};
  async function learn(path: string): Promise<void> {
    if (bindings[path]) return;
    const src = (await api.readText({ path })).content as string;
    bindings[path] = parseImports(src, dirOf(path));
  }
  const searched: Record<string, boolean> = {};
  let queue: string[] = [SYMBOL];
  const names: string[] = [];
  while (queue.length > 0) {
    const next: string[] = [];
    for (const name of queue) {
      if (searched[name]) continue;
      searched[name] = true;
      names.push(name);
      const res = await api.searchText({ pattern: name });
      for (const m of res.matches) {
        if (!inScope(m.path)) continue;
        await learn(m.path);
        for (const local of Object.keys(bindings[m.path]!)) {
          const b = bindings[m.path]![local]!;
          if (b.symbol === SYMBOL && b.file === DEFFILE && !searched[local]) next.push(local);
        }
      }
    }
    queue = next;
  }
  const found: Record<string, boolean> = {};
  const out: { path: string; line: number }[] = [];
  for (const name of names) {
    const res = await api.searchText({ pattern: name });
    for (const m of res.matches) {
      if (!inScope(m.path) || m.path === DEFFILE) continue;
      await learn(m.path);
      const line = ((await api.readText({ path: m.path, fromLine: m.line, maxLines: 1 })).content as string).split("\\n")[0] ?? "";
      const code = codeOf(line);
      if (!isCall(code, name)) continue;
      if (/^\\s*import\\s/.test(code)) continue;
      if (isDefLine(code, name)) continue;
      const b = (bindings[m.path] ?? {})[name];
      if (!b || b.symbol !== SYMBOL || b.file !== DEFFILE) continue;
      const key = m.path + ":" + m.line;
      if (!found[key]) { found[key] = true; out.push({ path: m.path, line: m.line }); }
    }
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
  return { calls: out };
}`;

async function runReference(dir: string, engine: ExecutorKind, task: RcallTask) {
  const { manifest, connector } = await connectRepo({ root: dir });
  const session = await createSession(
    manifest,
    connector,
    new Set(["readText", "searchText", "listFiles"]),
    { executor: engine },
  );
  try {
    const out = await session.run(
      REFERENCE.replace("__SYMBOL__", task.symbol).replace("__DEFFILE__", task.defFile),
    );
    if (out.error) throw new Error(`${task.id}@${engine}: ${out.error}`);
    return out.result;
  } finally {
    await session.close();
  }
}

if (import.meta.main) {
  const dir = await mkdtemp(join(tmpdir(), "strata-rcall-"));
  try {
    for (const task of RCALL_TASKS) {
      await buildRcallFixture(dir, task.fixture);
      const quick = await runReference(dir, "quickjs", task);
      const bun = await runReference(dir, "bun", task);
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
