import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises";
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
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  });
  if (proc.exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString().slice(0, 300)}`);
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-gitops-"));
  await writeFile(join(dir, "a.txt"), "v1\n");
  await writeFile(join(dir, "old.txt"), "renamed content\n");
  await writeFile(join(dir, "blob.bin"), Buffer.from([0x89, 0x50, 0x00, 0x01]));
  git(["init", "-b", "main"]);
  git(["add", "."]);
  git(["commit", "-m", "first"]);
  await writeFile(join(dir, "a.txt"), "v2\n");
  git(["mv", "old.txt", "new.txt"]);
  git(["add", "-A"]);
  git(["commit", "-m", "second"]);
  await appendFile(join(dir, "blob.bin"), Buffer.from([0xff]));
  git(["add", "-A"]);
  git(["commit", "-m", "third"]);
  // Worktree: staged edit of new.txt, unstaged edit of a.txt and blob.bin.
  await writeFile(join(dir, "new.txt"), "renamed content\nstaged line\n");
  git(["add", "new.txt"]);
  await writeFile(join(dir, "a.txt"), "v4-unstaged\n");
  await appendFile(join(dir, "blob.bin"), Buffer.from([0xfe]));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const sessionFor = async (engine: ExecutorKind, policy = {}) => {
  const { manifest, connector } = await connectRepo({ root: dir, ...policy });
  return createSession(
    manifest,
    connector,
    new Set(["gitDiff", "gitShow", "gitLog", "gitStatus"]),
    { executor: engine },
  );
};
const program = (body: string) =>
  `import { api } from '@c/repo';\nexport async function main() { ${body} }`;

for (const engine of ["quickjs", "bun"] as const) {
  test(`gitDiff separates staged and unstaged on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const unstaged = await session.run(program(`return await api.gitDiff({});`));
      expect(unstaged.error).toBeUndefined();
      const uv = unstaged.result as { diff: string; truncated: boolean; staged: boolean };
      expect(uv.staged).toBe(false);
      expect(uv.truncated).toBe(false);
      expect(uv.diff).toContain("diff --git a/a.txt b/a.txt");
      expect(uv.diff).toContain("-v2");
      expect(uv.diff).toContain("+v4-unstaged");
      expect(uv.diff).toContain("Binary files a/blob.bin and b/blob.bin differ");
      expect(uv.diff).not.toContain("staged line");
      const staged = await session.run(program(`return await api.gitDiff({ staged: true });`));
      expect(staged.error).toBeUndefined();
      const sv = staged.result as typeof uv;
      expect(sv.staged).toBe(true);
      expect(sv.diff).toContain("+staged line");
      expect(sv.diff).not.toContain("v4-unstaged");
      const filtered = await session.run(
        program(`return (await api.gitDiff({ paths: ["a.txt"] })).diff;`),
      );
      expect(filtered.error).toBeUndefined();
      expect(filtered.result as string).toContain("a/a.txt");
      expect(filtered.result as string).not.toContain("blob.bin");
    } finally {
      await session.close();
    }
  });

  test(`gitShow reads revisions with readText rules on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const head = await session.run(
        program(`return await api.gitShow({ revision: "HEAD", path: "a.txt" });`),
      );
      expect(head.error).toBeUndefined();
      expect(head.result).toMatchObject({
        path: "a.txt",
        revision: "HEAD",
        content: "v2\n",
        truncated: false,
      });
      const ancestor = await session.run(
        program(`return (await api.gitShow({ revision: "HEAD~2", path: "a.txt" })).content;`),
      );
      expect(ancestor.error).toBeUndefined();
      expect(ancestor.result).toBe("v1\n");
      const renamed = await session.run(
        program(`return (await api.gitShow({ revision: "HEAD~2", path: "old.txt" })).content;`),
      );
      expect(renamed.error).toBeUndefined();
      expect(renamed.result).toBe("renamed content\n");
      const bin = await session.run(
        program(`return await api.gitShow({ revision: "HEAD", path: "blob.bin" });`),
      );
      expect(bin.error ?? "").toContain("binary");
      const missing = await session.run(
        program(`return await api.gitShow({ revision: "HEAD", path: "nope.txt" });`),
      );
      expect(missing.error).toBeDefined();
    } finally {
      await session.close();
    }
  });

  test(`gitShow rejects bad revisions and scoped paths on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      for (const revision of ["main", "HEAD@{1}", "--help", "abc", ""]) {
        const r = await session.run(
          program(`return await api.gitShow({ revision: ${JSON.stringify(revision)}, path: "a.txt" });`),
        );
        expect(r.error ?? "").toContain("input");
        expect(r.metrics.calls[0]?.failure).toBe("input");
      }
      const ghost = await session.run(
        program(`return await api.gitShow({ revision: "${"0".repeat(40)}", path: "a.txt" });`),
      );
      expect(ghost.error).toBeDefined();
      for (const path of ["../x", ".git/HEAD"]) {
        const r = await session.run(
          program(`return await api.gitShow({ revision: "HEAD", path: ${JSON.stringify(path)} });`),
        );
        expect(r.error ?? "").toContain("denied");
        expect(r.metrics.calls[0]?.failure).toBe("denied");
      }
    } finally {
      await session.close();
    }
  });

  test(`gitLog withFiles reports renames and root files on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const r = await session.run(
        program(`return await api.gitLog({ withFiles: true, limit: 10 });`),
      );
      expect(r.error).toBeUndefined();
      const v = r.result as {
        commits: { message: string; files?: { path: string; oldPath?: string; status: string }[] }[];
      };
      expect(v.commits.map((c) => c.message)).toEqual(["third", "second", "first"]);
      expect(v.commits[1].files).toEqual([
        { path: "a.txt", status: "M" },
        { path: "new.txt", oldPath: "old.txt", status: "R" },
      ]);
      expect(v.commits[2].files).toEqual([
        { path: "a.txt", status: "A" },
        { path: "blob.bin", status: "A" },
        { path: "old.txt", status: "A" },
      ]);
      expect(v.commits[0].files).toEqual([{ path: "blob.bin", status: "M" }]);
    } finally {
      await session.close();
    }
  });
}

test("gitDiff truncates at a line boundary under a tiny cap", async () => {
  const session = await sessionFor("quickjs", { maxDiffBytes: 60 });
  try {
    const r = await session.run(program(`return await api.gitDiff({});`));
    expect(r.error).toBeUndefined();
    const v = r.result as { diff: string; truncated: boolean; totalBytes: number };
    expect(v.truncated).toBe(true);
    expect(v.totalBytes).toBeGreaterThan(60);
    expect(v.diff.endsWith("\n")).toBe(true);
  } finally {
    await session.close();
  }
});

test("gitLog filesTruncated under a tiny per-commit cap", async () => {
  const session = await sessionFor("quickjs", { maxCommitFiles: 1 });
  try {
    const r = await session.run(program(`return await api.gitLog({ withFiles: true, limit: 3 });`));
    expect(r.error).toBeUndefined();
    const v = r.result as { commits: { files?: unknown[]; filesTruncated?: boolean }[] };
    // The second commit touched two files; the cap keeps one and says so.
    expect(v.commits[1].files?.length).toBe(1);
    expect(v.commits[1].filesTruncated).toBe(true);
    expect(v.commits[0].filesTruncated).toBeUndefined();
  } finally {
    await session.close();
  }
});

test("pre-aborted gitDiff performs no work", async () => {
  const session = await sessionFor("quickjs");
  try {
    const r = await session.run(program(`return await api.gitDiff({});`), {
      signal: AbortSignal.abort(),
    });
    expect(r.error).toBeDefined();
    expect(r.metrics.capabilityCalls).toBe(0);
  } finally {
    await session.close();
  }
});
