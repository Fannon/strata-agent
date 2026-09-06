import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "../../src/session.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import type { ExecutorKind } from "../../src/runtime/executor.ts";

let dir = "";

const git = (args: string[]) => {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd: dir,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "tester",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "tester",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  });
  if (proc.exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString().slice(0, 300)}`);
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-reads-"));
  await mkdir(join(dir, "src"), { recursive: true });
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(join(dir, "package.json"), '{"name":"demo"}\n');
  await writeFile(join(dir, "src", "main.ts"), "export const a = 1;\n");
  await writeFile(join(dir, "src", "util.ts"), "export const b = 2;\n");
  await writeFile(join(dir, "docs", "guide.md"), "# guide\n");
  await writeFile(join(dir, "blob.bin"), Buffer.from([0x89, 0x50, 0x00, 0xff]));
  git(["init", "-b", "main"]);
  git(["add", "."]);
  git(["commit", "-m", "first"]);
  await writeFile(join(dir, "src", "extra.ts"), "export const c = 3;\n");
  git(["add", "src/extra.ts"]);
  git(["commit", "-m", "second"]);
  await writeFile(join(dir, "untracked.txt"), "new\n");
  await writeFile(join(dir, "src", "main.ts"), "export const a = 10;\n");
  git(["commit", "-am", "third"]);
  await symlink(join("src", "main.ts"), join(dir, "link-inside.ts"));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const sessionFor = async (engine: ExecutorKind) => {
  const { manifest, connector } = await connectRepo({ root: dir });
  return createSession(
    manifest,
    connector,
    new Set(["readText", "searchText", "gitStatus", "listFiles", "gitLog"]),
    { executor: engine },
  );
};
const program = (body: string) =>
  `import { api } from '@c/repo';\nexport async function main() { ${body} }`;

for (const engine of ["quickjs", "bun"] as const) {
  test(`listFiles depth 1 returns exact sorted children on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(program(`return await api.listFiles({});`));
      expect(r.error).toBeUndefined();
      expect(r.metrics.engine).toBe(engine);
      expect(r.result).toEqual({
        entries: [
          { path: "blob.bin", kind: "file" },
          { path: "docs", kind: "dir" },
          { path: "package.json", kind: "file" },
          { path: "src", kind: "dir" },
          { path: "untracked.txt", kind: "file" },
        ],
        truncated: false,
        scanned: 5,
        skipped: 2, // .git directory + link-inside.ts symlink
      });
    } finally {
      await session.close();
    }
  });

  test(`listFiles recurses with depth and reports truncation on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const deep = await session.run(
        program(`return (await api.listFiles({ depth: 5 })).entries;`),
      );
      expect(deep.error).toBeUndefined();
      expect(deep.result).toEqual([
        { path: "blob.bin", kind: "file" },
        { path: "docs", kind: "dir" },
        { path: "docs/guide.md", kind: "file" },
        { path: "package.json", kind: "file" },
        { path: "src", kind: "dir" },
        { path: "src/extra.ts", kind: "file" },
        { path: "src/main.ts", kind: "file" },
        { path: "src/util.ts", kind: "file" },
        { path: "untracked.txt", kind: "file" },
      ]);
      const capped = await session.run(
        program(`return await api.listFiles({ limit: 2 });`),
      );
      expect(capped.error).toBeUndefined();
      const v = capped.result as { entries: unknown[]; truncated: boolean };
      expect(v.entries.length).toBe(2);
      expect(v.truncated).toBe(true);
      const sub = await session.run(
        program(`return (await api.listFiles({ dir: "src", depth: 1 })).entries;`),
      );
      expect(sub.error).toBeUndefined();
      expect(sub.result).toEqual([
        { path: "src/extra.ts", kind: "file" },
        { path: "src/main.ts", kind: "file" },
        { path: "src/util.ts", kind: "file" },
      ]);
    } finally {
      await session.close();
    }
  });

  test(`listFiles denies escapes and non-directories on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      for (const d of ["../x", "/etc", ".git", "package.json"]) {
        const r = await session.run(
          program(`return await api.listFiles({ dir: ${JSON.stringify(d)} });`),
        );
        expect(r.error ?? "").toContain("denied");
        expect(r.metrics.calls[0]?.failure).toBe("denied");
      }
      const empty = await session.run(program(`return await api.listFiles({ dir: \"\" });`));
      expect(empty.error ?? "").toContain("input");
    } finally {
      await session.close();
    }
  });

  test(`gitLog returns newest-first history with hashes on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(program(`return await api.gitLog({});`));
      expect(r.error).toBeUndefined();
      const v = r.result as {
        commits: { hash: string; author: string; date: string; message: string }[];
        truncated: boolean;
      };
      expect(v.truncated).toBe(false);
      expect(v.commits.map((c) => c.message)).toEqual(["third", "second", "first"]);
      expect(v.commits[0].author).toBe("tester");
      for (const c of v.commits) {
        expect(c.hash).toMatch(/^[0-9a-f]{40}$/);
        expect(c.date.length).toBeGreaterThan(0);
      }
      const limited = await session.run(program(`return await api.gitLog({ limit: 2 });`));
      expect(limited.error).toBeUndefined();
      const lv = limited.result as typeof v;
      expect(lv.commits.map((c) => c.message)).toEqual(["third", "second"]);
      expect(lv.truncated).toBe(true);
      const filtered = await session.run(
        program(`return (await api.gitLog({ paths: [\"src/extra.ts\"] })).commits.map(c => c.message);`),
      );
      expect(filtered.error).toBeUndefined();
      expect(filtered.result).toEqual(["second"]);
    } finally {
      await session.close();
    }
  });

  test(`gitLog rejects option-like and escaping paths on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      for (const p of ["--help", "../x", ".git"]) {
        const r = await session.run(
          program(`return await api.gitLog({ paths: [${JSON.stringify(p)}] });`),
        );
        expect(r.error ?? "").toContain("denied");
        expect(r.metrics.calls[0]?.failure).toBe("denied");
      }
    } finally {
      await session.close();
    }
  });
}

test("declarations advertise the new operations", async () => {
  const session = await sessionFor("quickjs");
  try {
    expect(session.declarations).toContain("listFiles");
    expect(session.declarations).toContain("gitLog");
  } finally {
    await session.close();
  }
});
