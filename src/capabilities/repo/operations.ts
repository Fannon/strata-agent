import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedRepoPolicy } from "./policy.ts";
import { DeniedError, ResourceError } from "./policy.ts";

export interface ReadTextResult {
  path: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
  /** Effective first line returned (1-based; echoes fromLine). */
  startLine: number;
  /** Last line returned (1-based; startLine - 1 when nothing returned). */
  endLine: number;
  /** First line not returned; absent when the range reached EOF. */
  nextLine?: number;
}

export async function readText(
  policy: ResolvedRepoPolicy,
  absolute: string,
  rel: string,
  maxBytes: number | undefined,
  signal: AbortSignal,
  range?: { fromLine?: number; maxLines?: number },
): Promise<ReadTextResult> {
  signal.throwIfAborted();
  const cap = Math.min(maxBytes ?? policy.maxReadBytes, policy.maxReadBytes);
  let handle;
  try {
    handle = await open(absolute, "r");
  } catch {
    throw new ResourceError(`cannot open: ${rel}`);
  }
  try {
    const stat = await handle.stat();
    if (stat.isDirectory()) throw new ResourceError(`is a directory: ${rel}`);
    if (!stat.isFile()) throw new ResourceError(`not a regular file: ${rel}`);
    const totalBytes = stat.size;
    const take = Math.min(totalBytes, cap);
    const buffer = Buffer.alloc(take + (totalBytes > cap ? 1 : 0));
    await handle.read(buffer, 0, buffer.length, 0);
    signal.throwIfAborted();
    if (buffer.includes(0)) throw new ResourceError(`binary file: ${rel}`);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, take),
      );
    } catch {
      throw new ResourceError(`not valid UTF-8: ${rel}`);
    }
    // Line numbering is 1-based, matching searchText matches. A trailing
    // newline terminates the last line rather than starting a phantom one
    // (wc -l semantics). A byte cap landing mid-character still reports
    // invalid UTF-8; narrow with maxBytes or line ranges instead.
    // Unranged reads return the decoded prefix byte-identical (previous
    // contract); line caps apply to ranged reads only.
    const raw = text === "" ? [] : text.split("\n");
    const lines =
      raw.length && raw[raw.length - 1] === "" && text.endsWith("\n")
        ? raw.slice(0, -1).map((l) => l.replace(/\r$/, ""))
        : raw.map((l) => l.replace(/\r$/, ""));
    const ranged = range?.fromLine !== undefined || range?.maxLines !== undefined;
    const fromLine = Math.max(1, Math.floor(range?.fromLine ?? 1));
    const lineCap = ranged
      ? Math.min(range?.maxLines ?? lines.length, policy.maxReadLines)
      : lines.length;
    const slice = lines.slice(fromLine - 1, fromLine - 1 + lineCap);
    const endLine = slice.length ? fromLine + slice.length - 1 : fromLine - 1;
    // Continuation: a line cap with more decoded lines ahead resumes at the
    // next line; a byte cap mid-line resumes at the partial line itself
    // (re-read it), otherwise at the following line.
    const lineCapped = slice.length === lineCap && fromLine - 1 + lineCap < lines.length;
    const byteCapped = totalBytes > cap;
    const nextLine = lineCapped
      ? fromLine + lineCap
      : byteCapped
        ? text.endsWith("\n")
          ? endLine + 1
          : endLine
        : undefined;
    return {
      path: rel,
      // Ranged reads return joined lines (no added final newline); full
      // reads preserve the exact decoded prefix.
      content: ranged ? slice.join("\n") : text,
      truncated: nextLine !== undefined,
      totalBytes,
      startLine: fromLine,
      endLine,
      ...(nextLine !== undefined ? { nextLine } : {}),
    };
  } finally {
    await handle.close();
  }
}

export interface TextMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}
export interface SearchTextResult {
  matches: TextMatch[];
  truncated: boolean;
  filesScanned: number;
  filesSkipped: number;
  /** Present when truncated: how to narrow (paths/include/exclude/pattern). */
  hint?: string;
}

/**
 * Glob scope check shared by discovery operations. Patterns match
 * root-relative posix paths via Bun.Glob: `*` spans within a directory
 * (including dotfiles), `**` crosses directories. Directories are always
 * traversed; only file candidates are filtered, so a pattern can never
 * widen access beyond the walked tree (`../` patterns match nothing).
 * Invalid patterns match nothing. Filtered-out files touch no I/O and are
 * invisible to scanned/skipped counts, which describe host reads only.
 */
export function matchGlobs(
  rel: string,
  include: readonly string[] | undefined,
  exclude: readonly string[] | undefined,
): boolean {
  if (exclude?.some((pattern) => new Bun.Glob(pattern).match(rel))) return false;
  if (!include?.length) return true;
  return include.some((pattern) => new Bun.Glob(pattern).match(rel));
}

interface WalkEntry {
  absolute: string;
  rel: string;
}

/** Sorted recursive walk. Skips .git, all symlinks, and unreadable entries.
 * An optional accept filter scopes file candidates before counting or I/O:
 * rejected files are invisible to scanned/skipped tallies. */
async function walk(
  policy: ResolvedRepoPolicy,
  dirs: WalkEntry[],
  signal: AbortSignal,
  state: { filesScanned: number; filesSkipped: number; truncated: boolean },
  onFile: (entry: WalkEntry) => Promise<boolean>,
  accept?: (rel: string) => boolean,
): Promise<void> {
  const stack: WalkEntry[][] = [dirs];
  while (stack.length) {
    const level = stack.pop()!;
    for (const dir of level) {
      signal.throwIfAborted();
      let names;
      try {
        names = await readdir(dir.absolute, { withFileTypes: true });
      } catch {
        state.filesSkipped++;
        continue;
      }
      names.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const subdirs: WalkEntry[] = [];
      for (const entry of names) {
        if (entry.name === ".git") continue;
        if (entry.isSymbolicLink()) {
          state.filesSkipped++;
          continue;
        }
        const rel = dir.rel ? `${dir.rel}/${entry.name}` : entry.name;
        const absolute = join(dir.absolute, entry.name);
        if (entry.isDirectory()) {
          subdirs.push({ absolute, rel });
        } else if (entry.isFile()) {
          if (accept && !accept(rel)) continue;
          if (state.filesScanned >= policy.maxFilesScanned) {
            state.truncated = true;
            return;
          }
          state.filesScanned++;
          const done = await onFile({ absolute, rel });
          if (done) return;
        }
      }
      if (subdirs.length) stack.push(subdirs);
    }
  }
}

export async function searchText(
  policy: ResolvedRepoPolicy,
  roots: WalkEntry[],
  pattern: string,
  options:
    | {
        maxMatches?: number;
        include?: string[];
        exclude?: string[];
      }
    | undefined,
  signal: AbortSignal,
): Promise<SearchTextResult> {
  const limit = Math.min(options?.maxMatches ?? policy.maxMatches, policy.maxMatches);
  const include = options?.include;
  const exclude = options?.exclude;
  const matches: TextMatch[] = [];
  const state = { filesScanned: 0, filesSkipped: 0, truncated: false };
  let stop = false;
  await walk(policy, roots, signal, state, async (entry) => {
    if (stop) return true;
    signal.throwIfAborted();
    let handle;
    try {
      handle = await open(entry.absolute, "r");
    } catch {
      state.filesSkipped++;
      return false;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > policy.maxScanFileBytes) {
        state.filesSkipped++;
        return false;
      }
      const buffer = Buffer.alloc(stat.size);
      await handle.read(buffer, 0, buffer.length, 0);
      if (buffer.includes(0)) {
        state.filesSkipped++;
        return false;
      }
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        state.filesSkipped++;
        return false;
      }
      let line = 1;
      let lineStart = 0;
      for (let i = 0; i <= text.length && !stop; i++) {
        if (i === text.length || text[i] === "\n") {
          const lineText = text.slice(lineStart, i).replace(/\r$/, "");
          let from = 0;
          for (;;) {
            const at = lineText.indexOf(pattern, from);
            if (at === -1) break;
            matches.push({
              path: entry.rel,
              line,
              column: at + 1,
              text: lineText.slice(0, 500),
            });
            if (matches.length >= limit) {
              state.truncated = true;
              stop = true;
              break;
            }
            from = at + Math.max(1, pattern.length);
          }
          line++;
          lineStart = i + 1;
        }
      }
    } finally {
      await handle.close();
    }
    return stop;
  }, (rel) => matchGlobs(rel, include, exclude));
  matches.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || a.column - b.column,
  );
  return {
    matches,
    truncated: state.truncated,
    filesScanned: state.filesScanned,
    filesSkipped: state.filesSkipped,
    ...(state.truncated
      ? {
          hint: `results truncated after ${matches.length} matches across ${state.filesScanned} files; narrow with paths/include/exclude globs or a more specific pattern (truncated samples are deterministic, not global prefixes)`,
        }
      : {}),
  };
}

export interface ListEntry {
  path: string;
  kind: "file" | "dir";
}
export interface ListFilesResult {
  entries: ListEntry[];
  truncated: boolean;
  scanned: number;
  skipped: number;
  /** Present when truncated: how to narrow (dir/depth/limit). */
  hint?: string;
}

/**
 * Sorted bounded directory listing. Skips .git, all symlinks and unreadable
 * entries (counted as skipped). Depth 1 lists direct children only.
 */
export async function listFiles(
  policy: ResolvedRepoPolicy,
  absolute: string,
  rel: string,
  depth: number | undefined,
  limit: number | undefined,
  signal: AbortSignal,
): Promise<ListFilesResult> {
  const maxDepth = Math.min(depth ?? 1, 10);
  const maxEntries = Math.min(limit ?? policy.maxListEntries, policy.maxListEntries);
  const entries: ListEntry[] = [];
  let scanned = 0;
  let skipped = 0;
  let truncated = false;
  const stack: Array<{ absolute: string; rel: string; depth: number }> = [
    { absolute, rel: rel === "." ? "" : rel, depth: 1 },
  ];
  const push = (entry: ListEntry): boolean => {
    scanned++;
    if (entries.length >= maxEntries) {
      truncated = true;
      return true;
    }
    entries.push(entry);
    return false;
  };
  while (stack.length && !truncated) {
    const dir = stack.pop()!;
    signal.throwIfAborted();
    let names;
    try {
      names = await readdir(dir.absolute, { withFileTypes: true });
    } catch {
      skipped++;
      continue;
    }
    names.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const subdirs: Array<{ absolute: string; rel: string; depth: number }> = [];
    for (const entry of names) {
      if (truncated) break;
      if (entry.name === ".git") {
        skipped++;
        continue;
      }
      if (entry.isSymbolicLink()) {
        skipped++;
        continue;
      }
      const childRel = dir.rel ? `${dir.rel}/${entry.name}` : entry.name;
      const childAbs = join(dir.absolute, entry.name);
      if (entry.isDirectory()) {
        if (push({ path: childRel, kind: "dir" })) break;
        if (dir.depth < maxDepth) subdirs.push({ absolute: childAbs, rel: childRel, depth: dir.depth + 1 });
      } else if (entry.isFile()) {
        if (push({ path: childRel, kind: "file" })) break;
      } else {
        skipped++;
      }
    }
    // Push in reverse so the next pop visits alphabetically first; final
    // sort below makes output order independent of traversal anyway.
    for (let i = subdirs.length - 1; i >= 0; i--) stack.push(subdirs[i]);
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    entries,
    truncated,
    scanned,
    skipped,
    ...(truncated
      ? {
          hint: `listing truncated after ${entries.length} of at least ${scanned} entries; narrow with dir/depth or raise limit (truncated samples are deterministic, not global prefixes)`,
        }
      : {}),
  };
}

export interface GitStatusResult {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

/**
 * Controlled Git invocation shared by all Git-backed operations: fixed argv
 * assembled by the caller (no caller-controlled flags), LC_ALL=C,
 * pager forced to cat, no optional locks, 30s deadline, abort kills the
 * child. Non-zero exit becomes a bounded ResourceError.
 */
async function spawnGit(
  root: string,
  label: string,
  args: string[],
  signal: AbortSignal,
): Promise<Buffer> {
  if (signal.aborted) throw new Error("cancelled");
  const proc = Bun.spawn(["git", ...args], {
    cwd: root,
    env: {
      ...process.env,
      LC_ALL: "C",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_PAGER: "cat",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const kill = () => {
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  };
  signal.addEventListener("abort", kill, { once: true });
  const timeout = setTimeout(kill, 30_000);
  try {
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
      proc.exited,
    ]);
    if (signal.aborted) throw new Error("cancelled");
    if (code !== 0)
      throw new ResourceError(
        `${label} failed: ${Buffer.from(err).toString("utf-8", 0, 300).trim() || `exit ${code}`}`,
      );
    return Buffer.from(out);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", kill);
  }
}

/**
 * Fixed-argv Git backend (no shell, no user-controlled flags).
 * Porcelain v1 with -z handles unusual filenames; renames report the new path.
 */
export async function gitStatus(
  root: string,
  signal: AbortSignal,
): Promise<GitStatusResult> {
  const out = await spawnGit(
    root,
    "git status",
    ["-c", "core.quotePath=false", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--branch"],
    signal,
  );
  return parsePorcelain(out.toString("utf-8"));
}

export interface LogCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  /** Per-commit file records; present only when withFiles was requested. */
  files?: FileChange[];
  /** Present when the commit touched more files than maxCommitFiles. */
  filesTruncated?: boolean;
}
export interface GitLogResult {
  commits: LogCommit[];
  truncated: boolean;
  /** Present when truncated: how to narrow (paths/limit). */
  hint?: string;
}

export interface FileChange {
  path: string;
  oldPath?: string;
  /** Name-status letter: A/M/D/R/C/T. */
  status: string;
}

/**
 * Fixed-argv Git history (no shell, no caller-controlled flags). Requests
 * one more commit than asked: a surplus means the history was truncated.
 * Caller paths are root-relative, validated before dispatch; leading dashes
 * are rejected so no path can become a Git option.
 */
export async function gitLog(
  root: string,
  relPaths: string[],
  limit: number | undefined,
  policy: ResolvedRepoPolicy,
  signal: AbortSignal,
  withFiles?: boolean,
): Promise<GitLogResult> {
  const count = Math.min(limit ?? 20, policy.maxLogCommits);
  for (const p of relPaths) {
    if (p.startsWith("-") || p.startsWith("/"))
      throw new DeniedError(`not a loggable path: ${p}`);
  }
  const out = await spawnGit(
    root,
    "git log",
    [
      "-c",
      "core.quotePath=false",
      "log",
      "--pretty=format:%H%x00%an%x00%aI%x00%s%x1e",
      "--no-decorate",
      "--no-color",
      `--max-count=${count + 1}`,
      "--",
      ...relPaths,
    ],
    signal,
  );
  const all = parseLog(out.toString("utf-8"));
  const commits = all.slice(0, count);
  const truncated = all.length > count;
  if (withFiles) {
    for (const commit of commits) {
      const files = await commitFiles(root, commit.hash, policy, signal);
      commit.files = files.changes;
      if (files.truncated) commit.filesTruncated = true;
    }
  }
  return {
    commits,
    truncated,
    ...(truncated
      ? { hint: `history truncated after ${count} commits; restrict with paths or raise limit` }
      : {}),
  };
}

/**
 * Per-commit file records via fixed-argv diff-tree. Rename detection is
 * pinned (`--find-renames=50%`); `--root` covers the root commit. Merge
 * commits report no file records with this argv, so tasks use linear
 * histories. Records sort by path for git-version-stable output.
 */
async function commitFiles(
  root: string,
  hash: string,
  policy: ResolvedRepoPolicy,
  signal: AbortSignal,
): Promise<{ changes: FileChange[]; truncated: boolean }> {
  const out = await spawnGit(
    root,
    "git diff-tree",
    [
      "-c",
      "core.quotePath=false",
      "diff-tree",
      "--no-commit-id",
      "--name-status",
      "-z",
      "-r",
      "--find-renames=50%",
      "--root",
      "--no-color",
      hash,
      "--",
    ],
    signal,
  );
  const changes = parseNameStatus(out.toString("utf-8"));
  changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const truncated = changes.length > policy.maxCommitFiles;
  return { changes: changes.slice(0, policy.maxCommitFiles), truncated };
}

function parseNameStatus(text: string): FileChange[] {
  const fields = text.split("\0").filter((f) => f.length > 0);
  const changes: FileChange[] = [];
  for (let i = 0; i < fields.length; i++) {
    const status = fields[i];
    if (!/^[ACDMRTU][0-9]*$/.test(status)) continue;
    const kind = status[0];
    if (kind === "R" || kind === "C") {
      const oldPath = fields[i + 1];
      const path = fields[i + 2];
      if (oldPath === undefined || path === undefined) break;
      changes.push({ path: path.slice(0, 1024), oldPath: oldPath.slice(0, 1024), status: kind });
      i += 2;
    } else {
      const path = fields[i + 1];
      if (path === undefined) break;
      changes.push({ path: path.slice(0, 1024), status: kind });
      i += 1;
    }
  }
  return changes;
}

export interface GitDiffResult {
  diff: string;
  truncated: boolean;
  totalBytes: number;
  staged: boolean;
}

/**
 * Worktree diff (unstaged by default, staged with the flag) via fixed argv.
 * Raw unified text, cut at the last newline within the byte cap so lines
 * stay whole; binary changes appear as Git's own "differ" notice.
 */
export async function gitDiff(
  root: string,
  staged: boolean,
  relPaths: string[],
  maxBytes: number | undefined,
  policy: ResolvedRepoPolicy,
  signal: AbortSignal,
): Promise<GitDiffResult> {
  const cap = Math.min(maxBytes ?? policy.maxDiffBytes, policy.maxDiffBytes);
  const out = await spawnGit(
    root,
    "git diff",
    [
      "-c",
      "core.quotePath=false",
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--unified=3",
      ...(staged ? ["--cached"] : []),
      "--",
      ...relPaths,
    ],
    signal,
  );
  const totalBytes = out.length;
  const cut = totalBytes > cap ? out.subarray(0, cap) : out;
  // Cut at a line boundary so callers never see a partial line; the kept
  // newline is included.
  const nl = totalBytes > cap ? cut.lastIndexOf(0x0a) : -1;
  const diff = (nl === -1 ? cut : cut.subarray(0, nl + 1)).toString("utf-8");
  return { diff, truncated: totalBytes > cap, totalBytes, staged };
}

export interface GitShowResult {
  path: string;
  revision: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
}

/**
 * Historical file content via `git show rev:path`. Same UTF-8/binary rules
 * as readText; the revision allowlist lives in the input schema.
 */
export async function gitShow(
  root: string,
  revision: string,
  rel: string,
  maxBytes: number | undefined,
  policy: ResolvedRepoPolicy,
  signal: AbortSignal,
): Promise<GitShowResult> {
  const cap = Math.min(maxBytes ?? policy.maxReadBytes, policy.maxReadBytes);
  // Defense in depth: the input schema restricts revisions to HEAD ancestry
  // and full SHAs; reject anything else before it reaches argv.
  if (!/^(HEAD([~^][0-9]+)?|[0-9a-f]{40})$/.test(revision))
    throw new DeniedError(`not an allowed revision: ${revision.slice(0, 100)}`);
  const out = await spawnGit(root, "git show", ["show", "--no-color", "--no-textconv", `${revision}:${rel}`], signal);
  const totalBytes = out.length;
  const take = Math.min(totalBytes, cap);
  if (out.subarray(0, take).includes(0))
    throw new ResourceError(`binary file at ${revision}: ${rel}`);
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(out.subarray(0, take));
  } catch {
    throw new ResourceError(`not valid UTF-8 at ${revision}: ${rel}`);
  }
  return { path: rel, revision, content, truncated: totalBytes > cap, totalBytes };
}

function parseLog(text: string): LogCommit[] {
  const commits: LogCommit[] = [];
  for (const record of text.split("\x1e")) {
    if (!record.trim()) continue;
    const [hash = "", author = "", date = "", message = ""] = record.replace(/^\n/, "").split("\x00");
    if (!/^[0-9a-f]{40}$/.test(hash)) continue;
    commits.push({
      hash,
      author: author.slice(0, 200),
      date: date.slice(0, 100),
      message: message.slice(0, 500),
    });
  }
  return commits;
}

function parsePorcelain(text: string): GitStatusResult {
  const fields = text.split("\0").filter((f) => f.length > 0);
  let branch = "";
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  let renamePending = false;
  for (const field of fields) {
    if (field.startsWith("## ")) {
      branch = field.slice(3).split("...")[0].trim();
      if (branch.startsWith("No commits yet on ")) branch = branch.slice(17);
      continue;
    }
    if (renamePending) {
      renamePending = false; // old path of a rename; new path already recorded
      continue;
    }
    const x = field[0];
    const y = field[1];
    const path = field.slice(3);
    if (x === "?" && y === "?") {
      untracked.push(path);
      continue;
    }
    if (x === "R" || y === "R" || x === "C") renamePending = true;
    if (x !== " " && x !== "?" && x !== "!") staged.push(path);
    if (y !== " " && y !== "?" && y !== "!") unstaged.push(path);
  }
  return { branch, staged, unstaged, untracked };
}
