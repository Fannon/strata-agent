// R-LOC reference task (issue 028): description → function location over
// seeded repositories. Runnable offline check AND importer of the fixture
// builder for later trial runners. No model calls.
//
// Provenance: ORIGINAL fixture in the RepoQA SNF shape (Apache-2.0;
// https://github.com/evalplus/repoqa). No upstream case, description, or
// repository snapshot is copied: SNF cases need full pinned repo clones with
// per-snapshot license checks, deferred to held-out selection. Preserved
// shape: natural-language description without symbol keywords, oracle is
// path + qualified name + definition line, multiple plausible functions so
// navigation and comprehension matter, ambiguous descriptions rejected
// (decoys documented below).
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

export interface RlocTask {
  id: string;
  ask: string;
  expected: { path: string; name: string; line: number; definition: string };
}

// Instance 1: display formatting. Target formatUser; traps are formatAdmin
// (plausible sibling), formatUserName (name prefix trap), a test-local
// formatUser helper (scope trap) and a comment repeating the description.
const LOC_1: Record<string, string> = {
  "src/users.ts":
    'import type { User } from "./types.js";\n' +
    "\n" +
    "// Shared display helpers live here.\n" +
    "\n" +
    "export function formatUser(user: User): string {\n" +
    "  const name = user.name.length > 12 ? user.name.slice(0, 12) : user.name;\n" +
    "  return `${name} <${user.email}>`;\n" +
    "}\n",
  "src/admin.ts":
    'import type { Admin } from "./types.js";\n' +
    "\n" +
    "export function formatAdmin(admin: Admin): string {\n" +
    "  return `[admin] ${admin.email}`;\n" +
    "}\n",
  "src/username.ts": "export function formatUserName(name: string): string {\n  return name.trim();\n}\n",
  "src/types.ts":
    "export interface User {\n  name: string;\n  email: string;\n}\nexport interface Admin {\n  email: string;\n}\n",
  "test/users.test.ts":
    "// Formats a user record for display in test snapshots.\n" +
    'import { formatUser } from "../src/users.js";\n' +
    "\n" +
    "function formatUserLocal(u: unknown): string {\n  return JSON.stringify(u);\n}\n",
};

// Instance 2: retry helper. Target withRetry; traps are delay (plausible
// sibling), retryPolicy (name trap), a test-local withRetry mock (scope
// trap) and a README comment repeating the description.
const LOC_2: Record<string, string> = {
  "lib/retry.ts":
    "export interface RetryOpts {\n  attempts: number;\n  baseMs: number;\n}\n" +
    "\n" +
    "export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {\n" +
    "  let last: unknown;\n" +
    "  for (let i = 0; i < opts.attempts; i++) {\n" +
    "    try {\n" +
    "      return await fn();\n" +
    "    } catch (e) {\n" +
    "      last = e;\n" +
    "      await new Promise((r) => setTimeout(r, opts.baseMs * 2 ** i));\n" +
    "    }\n" +
    "  }\n" +
    "  throw last;\n" +
    "}\n",
  "lib/delay.ts": "export function delay(ms: number): Promise<void> {\n  return new Promise((r) => setTimeout(r, ms));\n}\n",
  "lib/retryPolicy.ts":
    "export function retryPolicy(max: number): { max: number } {\n  return { max };\n}\n",
  "test/retry.test.ts":
    'import { withRetry } from "../lib/retry.js";\n' +
    "\n" +
    "async function withRetryMock(): Promise<number> {\n  return 0;\n}\n",
  "README.md": "# lib\n\nRuns an async operation again with growing delays when it fails.\n",
};

export const RLOC_TASKS: RlocTask[] = [
  {
    id: "R-LOC-1",
    ask: "Takes a user record and returns a one-line display string, shortening names longer than 12 characters. Report exactly {\"path\" (defining file repo-relative), \"name\" (function name), \"line\" (1-based definition line), \"definition\" (the full definition line, trimmed)}.",
    expected: {
      path: "src/users.ts",
      name: "formatUser",
      line: 5,
      definition: "export function formatUser(user: User): string {",
    },
  },
  {
    id: "R-LOC-2",
    ask: "Runs an async operation again with growing delays when it fails, giving up after a fixed number of attempts. Report exactly {\"path\" (defining file repo-relative), \"name\" (function name), \"line\" (1-based definition line), \"definition\" (the full definition line, trimmed)}.",
    expected: {
      path: "lib/retry.ts",
      name: "withRetry",
      line: 6,
      definition: "export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {",
    },
  },
];

const FIXTURES = [LOC_1, LOC_2];

/** Write one instance fixture into an existing directory. */
export async function buildRlocFixture(dir: string, instance: 0 | 1): Promise<Record<string, string>> {
  const files = FIXTURES[instance]!;
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return { ...files };
}

// Human-written reference compositions (kept out of candidate prompts).
// Each searches abehavioral keyword, reads the candidates, and returns the
// definition line that exactly declares the target symbol outside test dirs.
const REFERENCES = [
  `import { api } from '@c/repo';
   export async function main() {
     const found = await api.searchText({ pattern: "formatUser" });
     const defs = [];
     for (const m of found.matches) {
       if (m.path.startsWith("test/")) continue;
       const src = (await api.readText({ path: m.path, fromLine: m.line, maxLines: 1 })).content;
       if (new RegExp("export function " + "formatUser" + "\\\\(").test(src)) defs.push({ path: m.path, line: m.line, text: src });
     }
     const pick = defs.find((d) => d.text.includes("(user: User)")) ?? defs[0];
     if (!pick) throw new Error("no definition found");
     return { path: pick.path, name: "formatUser", line: pick.line, definition: pick.text };
   }`,
  `import { api } from '@c/repo';
   export async function main() {
     const found = await api.searchText({ pattern: "withRetry" });
     const defs = [];
     for (const m of found.matches) {
       if (m.path.startsWith("test/")) continue;
       if (!m.text.startsWith("export async function withRetry<")) continue;
       defs.push({ path: m.path, line: m.line, text: m.text });
     }
     if (defs.length !== 1) throw new Error("ambiguous: " + defs.length);
     const pick = defs[0]!;
     return { path: pick.path, name: "withRetry", line: pick.line, definition: pick.text };
   }`,
];

async function runReference(dir: string, engine: ExecutorKind, instance: 0 | 1) {
  const { manifest, connector } = await connectRepo({ root: dir });
  const session = await createSession(
    manifest,
    connector,
    new Set(["readText", "searchText", "listFiles"]),
    { executor: engine },
  );
  try {
    const out = await session.run(REFERENCES[instance]!);
    if (out.error) throw new Error(`instance ${instance}@${engine}: ${out.error}`);
    return out.result;
  } finally {
    await session.close();
  }
}

if (import.meta.main) {
  const dir = await mkdtemp(join(tmpdir(), "strata-rloc-"));
  try {
    for (let i = 0; i < RLOC_TASKS.length; i++) {
      const task = RLOC_TASKS[i]!;
      await buildRlocFixture(dir, i as 0 | 1);
      const quick = await runReference(dir, "quickjs", i as 0 | 1);
      const bun = await runReference(dir, "bun", i as 0 | 1);
      if (!isDeepStrictEqual(quick, bun))
        throw new Error(`${task.id}: engines disagree:\n${JSON.stringify({ quick, bun }, null, 2)}`);
      if (!isDeepStrictEqual(quick, task.expected))
        throw new Error(`${task.id}: unexpected answer:\n${JSON.stringify(quick, null, 2)}`);
      console.log(`ok ${task.id} (engines agree, oracle matched)`);
      const { rm: rmDir } = await import("node:fs/promises");
      for (const name of Object.keys(FIXTURES[i]!)) await rmDir(join(dir, name), { force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
