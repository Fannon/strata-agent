// Reproducibility fingerprints for repository trials (issue 009).
// Pure helpers over a built fixture directory plus installed-version
// collection. No model calls, no secrets, no oracle values.
//
// Contract (FINGERPRINT_VERSION 2): the top-level sha256 is a stable
// task-material digest over sorted POSIX-relative paths with exact bytes
// plus digests of the Git material components (HEAD tree, index, status,
// unstaged/staged diffs). Git outputs are stored as SHA256 digests, never
// raw patches. A separate `exact` block records HEAD SHA plus refs/history
// digests for audit; it is deliberately EXCLUDED from the top-level digest
// so fresh builds of the same task fingerprint identically. History-only
// changes (new commits over an unchanged tree) are visible via `exact`,
// not via sha256. Excludes: `.git/` contents, the root-level `.canary`
// file only (a task file named `.canary` in a subdirectory is material),
// modes/mtimes/ownership. Regular files and symlinks hash under distinct
// kind tags. Errors: any I/O or unexpected Git failure throws; only ENOENT
// on `.git` means "no git". A fixture WITH `.git` whose Git fails is an
// error, never silently null.
//
// Environment: installed package versions from the package.json files on
// disk under <repoRoot>/node_modules. Missing/unreadable packages record
// `{ version: null, error }`. No env vars, keys or model output collected.
import { createHash } from "node:crypto";
import { lstat, readdir, readFile, readlink, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const FINGERPRINT_VERSION = 2;

export interface PackageVersion {
  version: string | null;
  error: string | null;
}

export interface EnvironmentSnapshot {
  version: number;
  bun: string;
  node: string;
  platform: string;
  arch: string;
  git: { version: string | null; error: string | null };
  packages: { pi: PackageVersion; typescript: PackageVersion; quickjs: PackageVersion; mcp: PackageVersion };
}

const PACKAGE_PATHS = {
  pi: "node_modules/@mariozechner/pi-coding-agent/package.json",
  typescript: "node_modules/typescript/package.json",
  quickjs: "node_modules/quickjs-emscripten/package.json",
  mcp: "node_modules/@modelcontextprotocol/sdk/package.json",
} as const;

async function readPackageVersion(repoRoot: string, rel: string): Promise<PackageVersion> {
  try {
    const raw = await readFile(join(repoRoot, rel), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const version =
      typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).version === "string"
        ? ((parsed as Record<string, unknown>).version as string)
        : null;
    if (version === null) return { version: null, error: `${rel}: no string version field` };
    return { version, error: null };
  } catch (error) {
    return { version: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function gitVersion(): { version: string | null; error: string | null } {
  try {
    const proc = Bun.spawnSync(["git", "--version"], { stdout: "pipe", stderr: "pipe" });
    const stderr = proc.stderr ? proc.stderr.toString().trim() : "";
    if (proc.exitCode !== 0) return { version: null, error: `git --version exited ${proc.exitCode}: ${stderr}` };
    const out = (proc.stdout ? proc.stdout.toString() : "").trim();
    const match = /^git version (\S+)/.exec(out);
    return { version: match ? match[1]! : out, error: null };
  } catch (error) {
    return { version: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Installed backend versions plus Bun/git/platform. Never throws for a
 * missing package; records the error beside a null version. */
export async function collectEnvironment(repoRoot: string): Promise<EnvironmentSnapshot> {
  const [pi, typescript, quickjs, mcp] = await Promise.all(
    [PACKAGE_PATHS.pi, PACKAGE_PATHS.typescript, PACKAGE_PATHS.quickjs, PACKAGE_PATHS.mcp].map((rel) =>
      readPackageVersion(repoRoot, rel),
    ),
  );
  return {
    version: 1,
    bun: Bun.version,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    git: gitVersion(),
    packages: { pi: pi!, typescript: typescript!, quickjs: quickjs!, mcp: mcp! },
  };
}

export interface FingerprintedFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface FixtureGitMaterial {
  headTree: string;
  indexDigest: string;
  statusDigest: string;
  diffUnstagedDigest: string;
  diffStagedDigest: string;
}

export interface FixtureGitExact {
  head: string;
  refsDigest: string;
  historyDigest: string;
}

export interface FixtureGitState {
  material: FixtureGitMaterial;
  exact: FixtureGitExact;
}

export interface FixtureFingerprint {
  version: number;
  sha256: string;
  files: FingerprintedFile[];
  totalBytes: number;
  git: FixtureGitState | null;
  gitAbsentReason: string | null;
  exclusions: string[];
}

const sha256hex = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

function runGit(repo: string, args: string[]): string {
  let proc: ReturnType<typeof Bun.spawnSync>;
  try {
    const { GIT_EXTERNAL_DIFF: _ignored, ...env } = process.env;
    proc = Bun.spawnSync(["git", "-c", "core.quotepath=false", "-c", "color.ui=false", "-c", "core.pager=cat", ...args], {
      cwd: repo,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...env, GIT_PAGER: "cat", GIT_CONFIG_NOSYSTEM: "1" },
    });
  } catch (error) {
    throw new Error(`fixture fingerprint: git ${args.join(" ")} failed to spawn: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (proc.exitCode !== 0)
    throw new Error(
      `fixture fingerprint: git ${args.join(" ")} exited ${proc.exitCode}: ${(proc.stderr ? proc.stderr.toString() : "").trim().slice(0, 500)}`,
    );
  return proc.stdout ? proc.stdout.toString() : "";
}

/** Only ENOENT means "no git"; every other I/O error fails visibly. */
export async function hasGitDir(repo: string): Promise<boolean> {
  try {
    const st = await stat(join(repo, ".git"));
    return st.isDirectory() || st.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new Error(
      `fixture fingerprint: cannot stat ${join(repo, ".git")}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Root-canary pathspec: excluded from index/status/diff inputs, while a
// task file named `.canary` in a subdirectory stays material. Diff flags
// disable external diff programs, textconv and color for determinism.
const NO_CANARY = [".", ":!:.canary"] as const;
const NO_PAGER_DIFF = ["--no-color", "--no-ext-diff", "--no-textconv"] as const;

/** Git material digests (hashed into sha256) plus exact history identity
 * (recorded for audit, excluded from sha256). Throws on any Git failure. */
function collectGitState(repo: string): FixtureGitState {
  const head = runGit(repo, ["rev-parse", "HEAD"]).trim();
  const headTree = runGit(repo, ["rev-parse", "HEAD^{tree}"]).trim();
  const material: FixtureGitMaterial = {
    headTree,
    indexDigest: sha256hex(runGit(repo, ["ls-files", "-s", "--", ...NO_CANARY])),
    statusDigest: sha256hex(runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all", "--", ...NO_CANARY])),
    diffUnstagedDigest: sha256hex(runGit(repo, ["diff", "HEAD", ...NO_PAGER_DIFF, "--", ...NO_CANARY])),
    diffStagedDigest: sha256hex(runGit(repo, ["diff", "--cached", ...NO_PAGER_DIFF, "--", ...NO_CANARY])),
  };
  const exact: FixtureGitExact = {
    head,
    refsDigest: sha256hex(runGit(repo, ["show-ref"])),
    historyDigest: sha256hex(runGit(repo, ["rev-list", "--all"])),
  };
  return { material, exact };
}

async function walkFiles(repo: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new Error(
        `fixture fingerprint: cannot list ${relative(repo, dir) || "."}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (relative(repo, full).split(sep).join("/") === ".canary") continue;
      if (entry.isDirectory()) await visit(full);
      else out.push(relative(repo, full).split(sep).join("/"));
    }
  };
  await visit(repo);
  out.sort();
  return out;
}

type EntryKind = "file" | "symlink";

async function fileDigest(repo: string, rel: string): Promise<{ kind: EntryKind; bytes: Buffer; sha256: string }> {
  const full = join(repo, ...rel.split("/"));
  let st;
  try {
    st = await lstat(full);
  } catch (error) {
    throw new Error(
      `fixture fingerprint: cannot stat ${rel}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let kind: EntryKind;
  let bytes: Buffer;
  if (st.isSymbolicLink()) {
    let target: string;
    try {
      target = await readlink(full);
    } catch (error) {
      throw new Error(
        `fixture fingerprint: cannot readlink ${rel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    kind = "symlink";
    bytes = Buffer.from(target, "utf8");
  } else if (st.isFile()) {
    kind = "file";
    try {
      bytes = Buffer.from(await readFile(full));
    } catch (error) {
      throw new Error(
        `fixture fingerprint: cannot read ${rel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    throw new Error(`fixture fingerprint: unsupported entry ${rel} (not a file, directory or symlink)`);
  }
  const sha256 = createHash("sha256").update(`${kind}\0`).update(bytes).digest("hex");
  return { kind, bytes, sha256 };
}

/** Stable task-material digest over files plus Git material digests.
 * Call BEFORE writing the randomized root `.canary` (excluded either way).
 * Throws visibly on any collection error; never fabricates. */
export async function fingerprintFixture(repo: string): Promise<FixtureFingerprint> {
  let rootStat;
  try {
    rootStat = await stat(repo);
  } catch (error) {
    throw new Error(
      `fixture fingerprint: cannot access fixture root ${repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!rootStat.isDirectory()) throw new Error(`fixture fingerprint: not a directory: ${repo}`);
  const rels = await walkFiles(repo);
  const hash = createHash("sha256");
  const files: FingerprintedFile[] = [];
  let totalBytes = 0;
  for (const rel of rels) {
    const { kind, bytes, sha256 } = await fileDigest(repo, rel);
    files.push({ path: rel, bytes: bytes.byteLength, sha256 });
    totalBytes += bytes.byteLength;
    hash.update(`${kind}\0`);
    hash.update(rel);
    hash.update("\0");
    hash.update(String(bytes.byteLength));
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  let git: FixtureGitState | null = null;
  let gitAbsentReason: string | null = null;
  if (await hasGitDir(repo)) {
    git = collectGitState(repo);
    hash.update("git-material\0");
    hash.update(git.material.headTree);
    hash.update("\0");
    hash.update(git.material.indexDigest);
    hash.update("\0");
    hash.update(git.material.statusDigest);
    hash.update("\0");
    hash.update(git.material.diffUnstagedDigest);
    hash.update("\0");
    hash.update(git.material.diffStagedDigest);
    hash.update("\0");
  } else {
    gitAbsentReason = "no-git-repository";
    hash.update("git\0absent:no-git-repository\0");
  }
  return {
    version: FINGERPRINT_VERSION,
    sha256: hash.digest("hex"),
    files,
    totalBytes,
    git,
    gitAbsentReason,
    exclusions: [".git/", "/.canary"],
  };
}
