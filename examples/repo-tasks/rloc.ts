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
  /** Index into FIXTURES below. */
  fixture: number;
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
    fixture: 0,
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
    fixture: 1,
    expected: {
      path: "lib/retry.ts",
      name: "withRetry",
      line: 6,
      definition: "export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {",
    },
  },
  {
    id: "R-LOC-3",
    ask: "Checks whether a string looks like an email address, returning true only when it has exactly one @ with text on both sides and a dot in the domain part. Report exactly {\"path\" (defining file repo-relative), \"name\" (function name), \"line\" (1-based definition line), \"definition\" (the full definition line, trimmed)}.",
    fixture: 2,
    expected: {
      path: "src/validate.ts",
      name: "isEmail",
      line: 4,
      definition: "export function isEmail(addr: string): boolean {",
    },
  },
  {
    id: "R-LOC-4",
    ask: "Computes the final price of a shopping cart by adding tax to the subtotal. Report exactly {\"path\" (defining file repo-relative), \"name\" (function name), \"line\" (1-based definition line), \"definition\" (the full definition line, trimmed)}.",
    fixture: 3,
    expected: {
      path: "shop/cart.ts",
      name: "cartTotal",
      line: 4,
      definition: "export function cartTotal(items: CartItem[], taxRate: number): number {",
    },
  },
];

// Instance 3: email check. Target isEmail; traps are isEmailLike (name
// trap), a test-local isEmail (scope trap) and a comment repeating the
// description.
const LOC_3: Record<string, string> = {
  "src/validate.ts":
    'import type { Contact } from "./models.js";\n' +
    "\n" +
    "// Validation helpers shared by forms.\n" +
    "export function isEmail(addr: string): boolean {\n" +
    "  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(addr);\n" +
    "}\n",
  "src/validateLike.ts":
    "export function isEmailLike(addr: string): boolean {\n  return addr.includes(\"@\");\n}\n",
  "src/models.ts": "export interface Contact {\n  email: string;\n}\n",
  "test/validate.test.ts":
    "// Checks the address looks like an email.\n" +
    'import { isEmail } from "../src/validate.js";\n' +
    "\n" +
    "function isEmail(addr: string): boolean {\n  return true;\n}\n",
};

// Instance 4: cart total. Target cartTotal; traps are cartSubtotal (name
// trap), a usage import (use trap), a test-local cartTotal (scope trap) and
// a comment repeating the description.
const LOC_4: Record<string, string> = {
  "shop/cart.ts":
    'import type { CartItem } from "./item.js";\n' +
    'import { subtotal } from "./money.js";\n' +
    "\n" +
    "export function cartTotal(items: CartItem[], taxRate: number): number {\n" +
    "  return subtotal(items) * (1 + taxRate);\n" +
    "}\n",
  "shop/money.ts":
    'import type { CartItem } from "./item.js";\n' +
    "\n" +
    "export function subtotal(items: CartItem[]): number {\n  return 0;\n}\n" +
    "export function cartSubtotal(items: CartItem[]): number {\n  return subtotal(items);\n}\n",
  "shop/item.ts": "export interface CartItem {\n  price: number;\n}\n",
  "shop/checkout.ts":
    'import { cartTotal } from "./cart.js";\n' +
    "\n" +
    "export function checkoutTotal(items: never[]): number {\n  return cartTotal(items, 0.2);\n}\n",
  "test/cart.test.ts":
    "// Adds tax to the cart subtotal for snapshots.\n" +
    'import { cartTotal } from "../shop/cart.js";\n' +
    "\n" +
    "function cartTotal(items: unknown): number {\n  return 0;\n}\n",
};

const FIXTURES = [LOC_1, LOC_2, LOC_3, LOC_4];

/** Write one instance fixture into an existing directory. */
export async function buildRlocFixture(dir: string, instance: number): Promise<Record<string, string>> {
  const files = FIXTURES[instance]!;
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return { ...files };
}

// Human-written reference compositions (kept out of candidate prompts).
// Each searches a behavioral keyword, reads the candidates, and returns the
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
  `import { api } from '@c/repo';
   export async function main() {
     const found = await api.searchText({ pattern: "isEmail" });
     const defs = [];
     for (const m of found.matches) {
       if (m.path.startsWith("test/")) continue;
       const src = (await api.readText({ path: m.path, fromLine: m.line, maxLines: 1 })).content;
       if (new RegExp("export function " + "isEmail" + "\\\\(").test(src)) defs.push({ path: m.path, line: m.line, text: src });
     }
     const pick = defs.find((d) => d.text.includes("(addr: string)")) ?? defs[0];
     if (!pick) throw new Error("no definition found");
     return { path: pick.path, name: "isEmail", line: pick.line, definition: pick.text };
   }`,
  `import { api } from '@c/repo';
   export async function main() {
     const found = await api.searchText({ pattern: "cartTotal" });
     const defs = [];
     for (const m of found.matches) {
       if (m.path.startsWith("test/")) continue;
       if (!m.text.startsWith("export function cartTotal(")) continue;
       defs.push({ path: m.path, line: m.line, text: m.text });
     }
     if (defs.length !== 1) throw new Error("ambiguous: " + defs.length);
     const pick = defs[0]!;
     return { path: pick.path, name: "cartTotal", line: pick.line, definition: pick.text };
   }`,
];

async function runReference(dir: string, engine: ExecutorKind, instance: number) {
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
    for (const task of RLOC_TASKS) {
      await buildRlocFixture(dir, task.fixture);
      const quick = await runReference(dir, "quickjs", task.fixture);
      const bun = await runReference(dir, "bun", task.fixture);
      if (!isDeepStrictEqual(quick, bun))
        throw new Error(`${task.id}: engines disagree:\n${JSON.stringify({ quick, bun }, null, 2)}`);
      if (!isDeepStrictEqual(quick, task.expected))
        throw new Error(`${task.id}: unexpected answer:\n${JSON.stringify(quick, null, 2)}`);
      console.log(`ok ${task.id} (engines agree, oracle matched)`);
      const { rm: rmDir } = await import("node:fs/promises");
      for (const name of Object.keys(FIXTURES[task.fixture]!)) await rmDir(join(dir, name), { force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
