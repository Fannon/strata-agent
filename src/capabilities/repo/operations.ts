import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedRepoPolicy } from "./policy.ts";
import { DeniedError, ResourceError } from "./policy.ts";

export interface ReadTextResult {
  path: string;
  content: string;
  truncated: boolean;
  totalBytes: number;
}

export async function readText(
  policy: ResolvedRepoPolicy,
  absolute: string,
  rel: string,
  maxBytes: number | undefined,
  signal: AbortSignal,
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
    return { path: rel, content: text, truncated: totalBytes > cap, totalBytes };
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
}

interface WalkEntry {
  absolute: string;
  rel: string;
}

/** Sorted recursive walk. Skips .git, all symlinks, and unreadable entries. */
async function walk(
  policy: ResolvedRepoPolicy,
  dirs: WalkEntry[],
  signal: AbortSignal,
  state: { filesScanned: number; filesSkipped: number; truncated: boolean },
  onFile: (entry: WalkEntry) => Promise<boolean>,
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
  maxMatches: number | undefined,
  signal: AbortSignal,
): Promise<SearchTextResult> {
  const limit = Math.min(maxMatches ?? policy.maxMatches, policy.maxMatches);
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
  });
  matches.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || a.column - b.column,
  );
  return {
    matches,
    truncated: state.truncated,
    filesScanned: state.filesScanned,
    filesSkipped: state.filesSkipped,
  };
}

export interface GitStatusResult {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

/**
 * Fixed-argv Git backend (no shell, no user-controlled flags).
 * Porcelain v1 with -z handles unusual filenames; renames report the new path.
 */
export async function gitStatus(
  root: string,
  signal: AbortSignal,
): Promise<GitStatusResult> {
  if (signal.aborted) throw new Error("cancelled");
  const proc = Bun.spawn(
    [
      "git",
      "-c",
      "core.quotePath=false",
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--branch",
    ],
    {
      cwd: root,
      env: { ...process.env, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
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
        `git status failed: ${Buffer.from(err).toString("utf-8", 0, 300).trim() || `exit ${code}`}`,
      );
    return parsePorcelain(Buffer.from(out).toString("utf-8"));
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", kill);
  }
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
