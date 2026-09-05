import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "../../src/session.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";

let dir = "";
let session: Awaited<ReturnType<typeof createSession>>;

const git = (args: string[], env?: Record<string, string>) => {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
      ...(env ?? {}),
    },
  });
  if (proc.exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString().slice(0, 300)}`);
};

const program = (body: string) =>
  `import { api } from '@c/repo';\nexport async function main() { ${body} }`;
const run = (body: string, opts?: { signal?: AbortSignal }) =>
  session.run(program(body), opts ?? {});

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-repo-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo", version: "1.2.3", scripts: { test: "bun test" } }, null, 2) + "\n",
  );
  await mkdir(join(dir, "src"), { recursive: true });
  await writeFile(join(dir, "src", "main.ts"), "export function greet(name: string) {\n  return `hi ${name}`;\n}\n");
  await writeFile(join(dir, "README.md"), "# demo\n");
  const outside = await mkdtemp(join(tmpdir(), "strata-outside-"));
  await writeFile(join(outside, "secret.txt"), "outside\n");
  await symlink(join("src", "main.ts"), join(dir, "link-inside.ts"));
  await symlink(join(outside, "secret.txt"), join(dir, "link-escape.txt"));
  await writeFile(join(dir, "blob.bin"), Buffer.from([0x89, 0x50, 0x00, 0xff]));
  await writeFile(join(dir, "big.txt"), "x".repeat(5000));
  await writeFile(join(dir, "we\nird.txt"), "newline name\n");
  git(["init", "-b", "main"]);
  git(["add", "package.json", "src/main.ts", "README.md"]);
  git(["commit", "-m", "initial"]);
  // Staged, unstaged, untracked after the commit:
  await writeFile(join(dir, "staged.txt"), "staged\n");
  git(["add", "staged.txt"]);
  await writeFile(join(dir, "src", "main.ts"), "export function greet(name: string) {\n  return `hello ${name}`;\n}\n");
  await writeFile(join(dir, "untracked.txt"), "new\n");
  const { manifest, connector } = await connectRepo({
    root: dir,
    maxReadBytes: 1024,
    maxMatches: 50,
    maxFilesScanned: 500,
    maxScanFileBytes: 4096,
  });
  session = await createSession(
    manifest,
    connector,
    new Set(["readText", "searchText", "gitStatus"]),
  );
  await rm(outside, { recursive: true, force: true }).catch(() => {});
  // Keep the escape target readable to prove denial precedes dispatch:
  await writeFile(join(tmpdir(), "strata-escape-proof.txt"), "outside\n");
  await rm(join(dir, "link-escape.txt")).catch(() => {});
  await symlink(join(tmpdir(), "strata-escape-proof.txt"), join(dir, "link-escape.txt"));
});

afterAll(async () => {
  await session?.close();
  await rm(join(tmpdir(), "strata-escape-proof.txt"), { force: true }).catch(() => {});
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("readText returns exact package.json content", async () => {
  const r = await run(`return await api.readText({ path: "package.json" });`);
  expect(r.error).toBeUndefined();
  const v = r.result as { path: string; content: string; truncated: boolean; totalBytes: number };
  expect(v.path).toBe("package.json");
  expect(JSON.parse(v.content).version).toBe("1.2.3");
  expect(v.truncated).toBe(false);
});

test("readText truncates a large file and reports totals", async () => {
  const r = await run(`return await api.readText({ path: "big.txt" });`);
  expect(r.error).toBeUndefined();
  const v = r.result as { content: string; truncated: boolean; totalBytes: number };
  expect(v.truncated).toBe(true);
  expect(v.totalBytes).toBe(5000);
  expect(v.content.length).toBe(1024);
});

test("readText follows an in-root symlink", async () => {
  const r = await run(`return (await api.readText({ path: "link-inside.ts" })).content;`);
  expect(r.error).toBeUndefined();
  expect(r.result as string).toContain("hello");
});

test("outside-root, absolute, .git and escape-symlink reads are denied", async () => {
  for (const path of ["../x", "/etc/hostname", ".git/HEAD", "link-escape.txt"]) {
    const r = await run(`return await api.readText({ path: ${JSON.stringify(path)} });`);
    expect(r.error ?? "").toContain("denied");
  }
  const empty = await run(`return await api.readText({ path: "" });`);
  expect(empty.error ?? "").toContain("input");
  // The escape target exists and is readable directly: denial precedes dispatch.
  expect(await Bun.file(join(tmpdir(), "strata-escape-proof.txt")).text()).toBe("outside\n");
});

test("binary, directory and missing inputs fail without content", async () => {
  for (const path of ["blob.bin", "src", "nope.txt"]) {
    const r = await run(`return await api.readText({ path: ${JSON.stringify(path)} });`);
    expect(r.error).toBeDefined();
  }
});

test("as any cannot bypass input validation", async () => {
  const r = await run(`return await api.readText({ path: 42 as any });`);
  expect(r.error ?? "").toContain("input");
  expect(r.metrics.validationFailures).toBe(1);
  expect(r.metrics.capabilityCalls).toBe(0);
});

test("searchText locates the named symbol with sorted exact matches", async () => {
  const r = await run(`return await api.searchText({ pattern: "greet" });`);
  expect(r.error).toBeUndefined();
  const v = r.result as {
    matches: { path: string; line: number; column: number; text: string }[];
    truncated: boolean;
  };
  expect(v.truncated).toBe(false);
  expect(v.matches).toEqual([
    { path: "src/main.ts", line: 1, column: 17, text: "export function greet(name: string) {" },
  ]);
});

test("searchText caps matches and reports truncation", async () => {
  const r = await run(`return await api.searchText({ pattern: "e", maxMatches: 3 });`);
  expect(r.error).toBeUndefined();
  const v = r.result as { matches: unknown[]; truncated: boolean };
  expect(v.matches.length).toBe(3);
  expect(v.truncated).toBe(true);
});

test("searchText skips binary and oversized files", async () => {
  const r = await run(`return await api.searchText({ pattern: "x" });`);
  expect(r.error).toBeUndefined();
  const v = r.result as { filesSkipped: number };
  expect(v.filesSkipped).toBeGreaterThanOrEqual(2);
});

test("gitStatus reports branch and staged/unstaged/untracked sets", async () => {
  const r = await run(`return await api.gitStatus({});`);
  expect(r.error).toBeUndefined();
  expect(r.result).toEqual({
    branch: "main",
    staged: ["staged.txt"],
    unstaged: ["src/main.ts"],
    untracked: ["big.txt", "blob.bin", "link-escape.txt", "link-inside.ts", "untracked.txt", "we\nird.txt"],
  });
});

test("pre-aborted repo run performs no capability calls", async () => {
  const r = await run(`return await api.readText({ path: "package.json" });`, {
    signal: AbortSignal.abort(),
  });
  expect(r.error).toBeDefined();
  expect(r.metrics.capabilityCalls).toBe(0);
});
