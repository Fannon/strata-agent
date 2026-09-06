import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
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
  dir = await mkdtemp(join(tmpdir(), "strata-globs-"));
  await mkdir(join(dir, "src", "nested"), { recursive: true });
  await mkdir(join(dir, "docs"), { recursive: true });
  await mkdir(join(dir, ".hidden"), { recursive: true });
  await writeFile(join(dir, "src", "main.ts"), "export const a = 1;\n");
  await writeFile(join(dir, "src", "util.ts"), "export const b = 2;\n");
  await writeFile(join(dir, "src", "nested", "deep.ts"), "export const c = 3;\n");
  await writeFile(join(dir, "docs", "guide.md"), "export control\n");
  await writeFile(join(dir, ".hidden", "secret.ts"), "export const h = 0;\n");
  await writeFile(join(dir, "notes.txt"), "no keyword here\n");
  await writeFile(join(dir, "blob.bin"), Buffer.concat([Buffer.from("export "), Buffer.from([0x00])]));
  git(["init", "-b", "main"]);
  git(["add", "."]);
  git(["commit", "-m", "first"]);
  await writeFile(join(dir, "second.txt"), "more\n");
  git(["add", "second.txt"]);
  git(["commit", "-m", "second"]);
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const sessionFor = async (engine: ExecutorKind) => {
  const { manifest, connector } = await connectRepo({ root: dir });
  return createSession(
    manifest,
    connector,
    new Set(["searchText", "listFiles", "gitLog"]),
    { executor: engine },
  );
};
const program = (body: string) =>
  `import { api } from '@c/repo';\nexport async function main() { ${body} }`;
const pathsOf = (result: unknown) =>
  (result as { matches: { path: string }[] }).matches.map((m) => m.path);

for (const engine of ["quickjs", "bun"] as const) {
  test(`globs: include selects, exclude removes on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const shallow = await session.run(
        program(`return await api.searchText({ pattern: "export", include: ["src/*.ts"] });`),
      );
      expect(shallow.error).toBeUndefined();
      expect(pathsOf(shallow.result)).toEqual(["src/main.ts", "src/util.ts"]);
      const deep = await session.run(
        program(`return await api.searchText({ pattern: "export", include: ["src/**/*.ts"] });`),
      );
      expect(deep.error).toBeUndefined();
      expect(pathsOf(deep.result)).toEqual(["src/main.ts", "src/nested/deep.ts", "src/util.ts"]);
      const excluded = await session.run(
        program(`return await api.searchText({ pattern: "export", exclude: ["src/**", "docs/**"] });`),
      );
      expect(excluded.error).toBeUndefined();
      // Dotfiles stay searchable (explicit hidden-file semantics); blob.bin
      // is skipped as binary even when glob-selected.
      expect(pathsOf(excluded.result)).toEqual([".hidden/secret.ts"]);
    } finally {
      await session.close();
    }
  });

  test(`globs: patterns never widen access on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const cases: Array<{ include: string[]; expected: string[] }> = [
        { include: ["../*"], expected: [] },
        { include: ["["], expected: [] },
        { include: ["docs/*.md"], expected: ["docs/guide.md"] },
      ];
      for (const { include, expected } of cases) {
        const r = await session.run(
          program(`return await api.searchText({ pattern: "export", include: ${JSON.stringify(include)} });`),
        );
        expect(r.error).toBeUndefined();
        const v = r.result as { matches: unknown[]; truncated: boolean };
        expect(v.truncated).toBe(false);
        expect(pathsOf(r.result)).toEqual(expected);
      }
    } finally {
      await session.close();
    }
  });

  test(`globs: truncation carries a narrowing hint on ${engine}`, async () => {
    const session = await sessionFor(engine);
    try {
      const broad = await session.run(
        program(`return await api.searchText({ pattern: "export", maxMatches: 2 });`),
      );
      expect(broad.error).toBeUndefined();
      const bv = broad.result as { matches: unknown[]; truncated: boolean; hint?: string };
      expect(bv.matches.length).toBe(2);
      expect(bv.truncated).toBe(true);
      expect(bv.hint ?? "").toContain("narrow");
      const narrowed = await session.run(
        program(`return await api.searchText({ pattern: "export", include: ["src/main.ts"] });`),
      );
      expect(narrowed.error).toBeUndefined();
      const nv = narrowed.result as {
        matches: unknown[];
        truncated: boolean;
        filesScanned: number;
        hint?: string;
      };
      expect(nv.matches.length).toBe(1);
      expect(nv.truncated).toBe(false);
      expect(nv.hint).toBeUndefined();
      // Glob-filtered files touch no I/O: only the selected file was read.
      expect(nv.filesScanned).toBe(1);
    } finally {
      await session.close();
    }
  });
}

test("hints: listFiles and gitLog truncation explain narrowing", async () => {
  const session = await sessionFor("quickjs");
  try {
    const listed = await session.run(program(`return await api.listFiles({ limit: 1 });`));
    expect(listed.error).toBeUndefined();
    const lv = listed.result as { truncated: boolean; hint?: string };
    expect(lv.truncated).toBe(true);
    expect(lv.hint ?? "").toContain("narrow");
    const logged = await session.run(program(`return await api.gitLog({ limit: 1 });`));
    expect(logged.error).toBeUndefined();
    const gv = logged.result as { commits: unknown[]; truncated: boolean; hint?: string };
    expect(gv.commits.length).toBe(1);
    expect(gv.truncated).toBe(true);
    expect(gv.hint ?? "").toContain("paths");
  } finally {
    await session.close();
  }
});
