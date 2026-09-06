/**
 * Deterministic reference workflows proving repository compositions are
 * expressible through the typed API on both engines (no model involved).
 *
 * W1: search → read surrounding lines (needs readText line ranges).
 * W2: status → inspect staged/unstaged diffs (needs gitDiff).
 * W3: history → read old file content (needs gitLog + gitShow).
 *
 * Usage: bun examples/repo-workflows.ts
 * Seeds a fixed fixture repo, runs each workflow on QuickJS and Bun, and
 * requires byte-identical results plus the expected answer. Exits non-zero
 * on any mismatch, so this file is an executable contract, not a demo.
 */
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { connectRepo } from "../src/capabilities/repo/connector.ts";
import { createSession } from "../src/session.ts";
import type { ExecutorKind } from "../src/runtime/executor.ts";

const dir = await mkdtemp(join(tmpdir(), "strata-workflows-"));
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "w",
  GIT_AUTHOR_EMAIL: "w@w",
  GIT_COMMITTER_NAME: "w",
  GIT_COMMITTER_EMAIL: "w@w",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};
const git = async (args: string[]) => {
  const proc = Bun.spawnSync(["git", ...args], { cwd: dir, env: gitEnv });
  if (proc.exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString().slice(0, 200)}`);
};

const mainTs = [
  "import { helper } from \"./util\";",
  "",
  "export function greet(name: string) {",
  "  return `hello ${helper(name)}`;",
  "}",
  "",
  "export function farewell(name: string) {",
  "  return `bye ${name}`;",
  "}",
  "",
].join("\n");
await mkdir(join(dir, "src"), { recursive: true });
await mkdir(join(dir, "docs"), { recursive: true });
await writeFile(join(dir, "package.json"), JSON.stringify({ name: "wf", version: "1.0.0" }) + "\n");
await writeFile(join(dir, "src", "main.ts"), mainTs);
await writeFile(join(dir, "src", "util.ts"), "export function helper(n: string) {\n  return n.trim();\n}\n");
const guideLines = Array.from({ length: 60 }, (_, i) => `guide line ${i + 1}`);
await writeFile(join(dir, "docs", "guide.md"), guideLines.join("\n") + "\n");
await git(["init", "-b", "main"]);
await git(["add", "."]);
await git(["commit", "-m", "first"]);
await writeFile(join(dir, "src", "extra.ts"), "export const c = 3;\n");
await git(["add", "src/extra.ts"]);
await git(["commit", "-m", "second"]);
await writeFile(join(dir, "notes.txt"), "todo: refactor greet\n");
await writeFile(join(dir, "src", "main.ts"), mainTs.replace("hello", "hi"));
await writeFile(
  join(dir, "src", "util.ts"),
  "export function helper(n: string) {\n  return n.trimStart();\n}\n",
);
await git(["add", "src/util.ts"]);

const OPS = ["readText", "searchText", "gitStatus", "listFiles", "gitLog", "gitDiff", "gitShow", "gitCommitFiles"];
const results: Record<string, Record<ExecutorKind, unknown>> = {};

async function runWorkflow(name: string, source: string, expected: unknown) {
  const perEngine = {} as Record<ExecutorKind, unknown>;
  for (const engine of ["quickjs", "bun"] as const) {
    const { manifest, connector } = await connectRepo({ root: dir });
    const session = await createSession(manifest, connector, new Set(OPS), { executor: engine });
    try {
      const out = await session.run(source);
      if (out.error) throw new Error(`${name}@${engine}: ${out.error}`);
      perEngine[engine] = out.result;
    } finally {
      await session.close();
    }
  }
  if (!isDeepStrictEqual(perEngine.quickjs, perEngine.bun))
    throw new Error(`${name}: engines disagree:\n${JSON.stringify(perEngine, null, 2)}`);
  if (!isDeepStrictEqual(perEngine.quickjs, expected))
    throw new Error(`${name}: unexpected answer:\n${JSON.stringify(perEngine.quickjs, null, 2)}`);
  results[name] = perEngine;
  console.log(`ok ${name} (engines agree, answer as expected)`);
}

// W1: locate a symbol, then read exactly the lines around it.
await runWorkflow(
  "W1 search→read-lines",
  `import { api } from '@c/repo';
   export async function main() {
     const found = await api.searchText({ pattern: "farewell" });
     const first = found.matches[0];
     const start = Math.max(1, first.line - 1);
     const window = await api.readText({ path: first.path, fromLine: start, maxLines: 4 });
     return { match: first, window };
   }`,
  {
    match: {
      path: "src/main.ts",
      line: 7,
      column: 17,
      text: "export function farewell(name: string) {",
    },
    window: {
      path: "src/main.ts",
      content: "\nexport function farewell(name: string) {\n  return `bye ${name}`;\n}",
      truncated: false,
      totalBytes: Buffer.byteLength(mainTs.replace("hello", "hi")),
      startLine: 6,
      endLine: 9,
    },
  },
);

// W1n: broad search truncates with a hint, then a glob-narrowed re-search
// completes. Proves the narrowing strategy end to end.
await runWorkflow(
  "W1n broad→narrow search",
  `import { api } from '@c/repo';
   export async function main() {
     const broad = await api.searchText({ pattern: "export", maxMatches: 2 });
     const narrowed = await api.searchText({ pattern: "export", include: ["src/main.ts"] });
     return { broad, narrowed };
   }`,
  {
    broad: {
      matches: [
        { path: "src/extra.ts", line: 1, column: 1, text: "export const c = 3;" },
        { path: "src/main.ts", line: 3, column: 1, text: "export function greet(name: string) {" },
      ],
      truncated: true,
      filesScanned: 5,
      filesSkipped: 0,
      hint: "results truncated after 2 matches across 5 files; narrow with paths/include/exclude globs or a more specific pattern (truncated samples are deterministic, not global prefixes)",
    },
    narrowed: {
      matches: [
        { path: "src/main.ts", line: 3, column: 1, text: "export function greet(name: string) {" },
        { path: "src/main.ts", line: 7, column: 1, text: "export function farewell(name: string) {" },
      ],
      truncated: false,
      filesScanned: 1,
      filesSkipped: 0,
    },
  },
);

// W2: status tells what changed; diffs show how. The program strips `index`
// lines (blob hashes vary by Git version) with plain string ops — no broker
// call for pure transformations.
await runWorkflow(
  "W2 status→diffs",
  `import { api } from '@c/repo';
   export async function main() {
     const status = await api.gitStatus({});
     const unstaged = await api.gitDiff({});
     const staged = await api.gitDiff({ staged: true });
     const strip = (d: string) => d.split("\\n").filter((l) => !l.startsWith("index ")).join("\\n");
     return { status, unstaged: strip(unstaged.diff), staged: strip(staged.diff) };
   }`,
  {
    status: {
      branch: "main",
      staged: ["src/util.ts"],
      unstaged: ["src/main.ts"],
      untracked: ["notes.txt"],
    },
    unstaged:
      "diff --git a/src/main.ts b/src/main.ts\n" +
      "--- a/src/main.ts\n" +
      "+++ b/src/main.ts\n" +
      "@@ -1,7 +1,7 @@\n" +
      " import { helper } from \"./util\";\n" +
      " \n" +
      " export function greet(name: string) {\n" +
      "-  return `hello ${helper(name)}`;\n" +
      "+  return `hi ${helper(name)}`;\n" +
      " }\n" +
      " \n" +
      " export function farewell(name: string) {\n",
    staged:
      "diff --git a/src/util.ts b/src/util.ts\n" +
      "--- a/src/util.ts\n" +
      "+++ b/src/util.ts\n" +
      "@@ -1,3 +1,3 @@\n" +
      " export function helper(n: string) {\n" +
      "-  return n.trim();\n" +
      "+  return n.trimStart();\n" +
      " }\n",
  },
);

// W3: history tells what changed per commit; show recovers old content.
await runWorkflow(
  "W3 log→show",
  `import { api } from '@c/repo';
   export async function main() {
     const log = await api.gitLog({ withFiles: true, limit: 5 });
     const first = log.commits[log.commits.length - 1];
     const oldMain = await api.gitShow({ revision: first.hash, path: "src/main.ts" });
     return {
       messages: log.commits.map((c) => c.message),
       files: log.commits.map((c) => c.files),
       oldContent: oldMain.content,
     };
   }`,
  {
    messages: ["second", "first"],
    files: [
      [{ path: "src/extra.ts", status: "A" }],
      [
        { path: "docs/guide.md", status: "A" },
        { path: "package.json", status: "A" },
        { path: "src/main.ts", status: "A" },
        { path: "src/util.ts", status: "A" },
      ],
    ],
    oldContent: mainTs,
  },
);

await rm(dir, { recursive: true, force: true });
console.log(`done: ${Object.keys(results).length} workflow(s) agree on both engines`);
