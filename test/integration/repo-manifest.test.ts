// Reproducibility-manifest integration tests (issue 009): actual offline
// runner selection, repeatable fixture fingerprints, content/Git-state
// change detection, root-canary exclusion and real installed versions.
// Deterministic and offline: no network, no model calls, no paid services.
import { test, expect } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectEnvironment, fingerprintFixture, hasGitDir } from "../../examples/benchmark/fingerprint.ts";
import { buildTrialFixture, trialTasks } from "../../examples/repo-protocol.ts";

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const scratch = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

test("offline runner reports the actual selection (no mirrored plan)", async () => {
  const proc = Bun.spawn(
    [process.execPath, join(REPO_ROOT, "examples/repo-pilot.ts"),
      "--tasks", "R-EXPORT-1,R-LOG-1", "--profiles", "stock-pi,typed-quickjs"],
    { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(code).toBe(0);
  expect(err).toBe("");
  const parsed = JSON.parse(out) as { protocol: string; cells: { id: string; task: string; profile: string }[] };
  expect(parsed.protocol).toBe("repo-2");
  expect(parsed.cells.map((c) => `${c.task}:${c.profile}`)).toEqual([
    "R-EXPORT-1:stock-pi",
    "R-EXPORT-1:typed-quickjs",
    "R-LOG-1:typed-quickjs",
    "R-LOG-1:stock-pi",
  ]);
  // Whole-corpus provenance stays out of the selection.
  expect(trialTasks.length).toBeGreaterThan(2);
});

test("environment reports actual installed versions", async () => {
  const env = await collectEnvironment(REPO_ROOT);
  expect(env.bun).toBe(Bun.version);
  expect(env.node).toBe(process.version);
  expect(env.platform).toBe(process.platform);
  for (const [key, rel] of [
    ["pi", "node_modules/@mariozechner/pi-coding-agent/package.json"],
    ["typescript", "node_modules/typescript/package.json"],
    ["quickjs", "node_modules/quickjs-emscripten/package.json"],
    ["mcp", "node_modules/@modelcontextprotocol/sdk/package.json"],
  ] as const) {
    const onDisk = JSON.parse(await readFile(join(REPO_ROOT, rel), "utf8")) as { version: string };
    expect(env.packages[key].version).toBe(onDisk.version);
    expect(env.packages[key].error).toBeNull();
  }
  expect(env.git.version).toMatch(/^\d+\.\d+/);
  expect(env.git.error).toBeNull();
});

test("environment reports missing packages explicitly instead of fabricating", async () => {
  const dir = await scratch("strata-env-");
  try {
    const env = await collectEnvironment(dir);
    for (const pkg of [env.packages.pi, env.packages.typescript, env.packages.quickjs, env.packages.mcp]) {
      expect(pkg.version).toBeNull();
      expect(typeof pkg.error).toBe("string");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("plain-file fixture fingerprints repeat and detect content changes", async () => {
  const a = await scratch("strata-fp-a-");
  const b = await scratch("strata-fp-b-");
  try {
    await buildTrialFixture("R-EXPORT-1", a);
    await buildTrialFixture("R-EXPORT-1", b);
    const fa = await fingerprintFixture(a);
    expect(fa.version).toBe(2);
    expect(fa.sha256).toBe((await fingerprintFixture(b)).sha256);
    expect(fa.git).toBeNull();
    expect(fa.gitAbsentReason).toBe("no-git-repository");
    expect(fa.exclusions).toEqual([".git/", "/.canary"]);
    // Randomized root canary content is excluded from the digest.
    await writeFile(join(a, ".canary"), "evaluator canary deadbeef: not part of the task, do not read\n");
    expect((await fingerprintFixture(a)).sha256).toBe(fa.sha256);
    // A task file named .canary in a subdirectory IS material.
    await mkdir(join(a, "sub"), { recursive: true });
    await writeFile(join(a, "sub", ".canary"), "nested\n");
    expect((await fingerprintFixture(a)).sha256).not.toBe(fa.sha256);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

test("symlink kind never collides with a regular file holding the target", async () => {
  const a = await scratch("strata-link-a-");
  const b = await scratch("strata-link-b-");
  try {
    await writeFile(join(a, "link"), "target");
    await symlink("target", join(b, "link"));
    const fa = await fingerprintFixture(a);
    const fb = await fingerprintFixture(b);
    expect(fa.sha256).not.toBe(fb.sha256);
    expect(fa.files[0]!.sha256).not.toBe(fb.files[0]!.sha256);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

test("git fixture stores digests with separate exact identity, stable across volatile rewrites", async () => {
  const a = await scratch("strata-git-a-");
  const b = await scratch("strata-git-b-");
  try {
    await buildTrialFixture("T1", a);
    await buildTrialFixture("T1", b);
    const fa = await fingerprintFixture(a);
    expect(fa.git).not.toBeNull();
    const hex = /^[0-9a-f]{64}$/;
    for (const digest of [fa.git!.material.indexDigest, fa.git!.material.statusDigest,
      fa.git!.material.diffUnstagedDigest, fa.git!.material.diffStagedDigest,
      fa.git!.exact.refsDigest, fa.git!.exact.historyDigest])
      expect(digest).toMatch(hex);
    expect(fa.git!.material.headTree).toMatch(/^[0-9a-f]{40}$/);
    expect(fa.git!.exact.head).toMatch(/^[0-9a-f]{40}$/);
    // Fresh builds fingerprint identically even though commit timestamps differ.
    expect(fa.sha256).toBe((await fingerprintFixture(b)).sha256);
    // A randomized root canary leaves the Git-material digest untouched.
    await writeFile(join(a, ".canary"), "evaluator canary 0123456789abcdef: not part of the task\n");
    const withCanary = await fingerprintFixture(a);
    expect(withCanary.sha256).toBe(fa.sha256);
    expect(withCanary.git!.material).toEqual(fa.git!.material);
    // Volatile history rewrite: identical tree, new commit SHA/timestamp.
    // The material digest stays stable; only the exact identity moves.
    const gitOut = (args: string[], env?: Record<string, string | undefined>) => {
      const proc = Bun.spawnSync(["git", ...args], { cwd: a, stdout: "pipe", stderr: "pipe", env: env ?? process.env });
      if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${proc.stderr.toString().slice(0, 200)}`);
      return proc.stdout.toString().trim();
    };
    const tree = gitOut(["rev-parse", "HEAD^{tree}"]);
    const ident = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
    const rewrite = (date: string) =>
      gitOut(["commit-tree", tree, "-m", "rewritten"],
        { ...process.env, ...ident, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
    const rewritten = rewrite("2000-01-01T00:00:00+00:00");
    expect(rewritten).not.toBe(fa.git!.exact.head);
    gitOut(["update-ref", "HEAD", rewritten]);
    const after = await fingerprintFixture(a);
    expect(after.sha256).toBe(fa.sha256);
    expect(after.git!.exact.head).toBe(rewritten);
    expect(after.git!.exact.historyDigest).not.toBe(fa.git!.exact.historyDigest);
    // Unstaged worktree changes (diff) are detected.
    const main = join(a, "src", "main.ts");
    const src = await readFile(main, "utf8");
    await writeFile(main, `${src}\n// tampered\n`);
    expect((await fingerprintFixture(a)).sha256).not.toBe(fa.sha256);
  } finally {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  }
});

test("git presence: only ENOENT is absent, other I/O errors throw", async () => {
  const dir = await scratch("strata-gitdir-");
  try {
    expect(await hasGitDir(dir)).toBe(false);
    const file = join(dir, "blocker");
    await writeFile(file, "x\n");
    // stat(<file>/.git) fails with ENOTDIR, not ENOENT: must throw, not
    // silently report "no git".
    await expect(hasGitDir(file)).rejects.toThrow("cannot stat");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fingerprint collection fails visibly, never fabricates", async () => {
  await expect(fingerprintFixture(join(tmpdir(), "strata-no-such-fixture-dir"))).rejects.toThrow(
    "cannot access fixture root",
  );
  const file = join(tmpdir(), `strata-not-a-dir-${Date.now()}`);
  await writeFile(file, "x\n");
  try {
    await expect(fingerprintFixture(file)).rejects.toThrow("not a directory");
  } finally {
    await rm(file, { force: true });
  }
});
