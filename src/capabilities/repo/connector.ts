import type {
  CapabilityConnector,
  CapabilityModule,
  CapabilityResult,
  JsonSchema,
} from "../manifest.ts";
import { lstat } from "node:fs/promises";
import { bytes } from "../manifest.ts";
import type { RepoPolicy } from "./policy.ts";
import { resolvePolicy, resolveInRoot, checkScopePath, DeniedError } from "./policy.ts";
import { readText, searchText, gitStatus, listFiles, gitLog, gitDiff, gitShow } from "./operations.ts";

const readTextInput: JsonSchema = {
  type: "object",
  description: "Read a UTF-8 text file inside the repository root.",
  properties: {
    path: {
      type: "string",
      description: "Root-relative file path, e.g. package.json (slash-separated, no leading ./).",
      minLength: 1,
      maxLength: 1024,
    },
    maxBytes: {
      type: "integer",
      description: "Max bytes to return; larger files report truncated.",
      minimum: 1,
      maximum: 1_048_576,
    },
    fromLine: {
      type: "integer",
      description: "1-based first line to return; default 1.",
      minimum: 1,
    },
    maxLines: {
      type: "integer",
      description: "Max lines to return; larger ranges report nextLine.",
      minimum: 1,
      maximum: 5000,
    },
  },
  required: ["path"],
  additionalProperties: false,
};
const readTextOutput: JsonSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    content: { type: "string" },
    truncated: { type: "boolean" },
    totalBytes: { type: "integer" },
    startLine: { type: "integer" },
    endLine: { type: "integer" },
    nextLine: { type: "integer" },
  },
  required: ["path", "content", "truncated", "totalBytes", "startLine", "endLine"],
  additionalProperties: false,
};
const searchTextInput: JsonSchema = {
  type: "object",
  description:
    "Literal substring search over text files inside the root. Narrow with paths/include/exclude when truncated; empty untruncated results are definitive.",
  properties: {
    pattern: {
      type: "string",
      description: "Literal substring to find (not a regex).",
      minLength: 1,
      maxLength: 500,
    },
    paths: {
      type: "array",
      description: "Root-relative directories to search; default is the root (slash-separated, no leading ./).",
      items: { type: "string", minLength: 1, maxLength: 1024 },
      maxItems: 32,
    },
    include: {
      type: "array",
      description:
        "Glob patterns selecting file paths to search (Bun.Glob against root-relative paths; `*` stays in one directory, `**` crosses).",
      items: { type: "string", minLength: 1, maxLength: 256 },
      maxItems: 16,
    },
    exclude: {
      type: "array",
      description: "Glob patterns removing file paths from the search.",
      items: { type: "string", minLength: 1, maxLength: 256 },
      maxItems: 16,
    },
    maxMatches: {
      type: "integer",
      description: "Max matches to return.",
      minimum: 1,
      maximum: 1000,
    },
  },
  required: ["pattern"],
  additionalProperties: false,
};
const textMatch: JsonSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    line: { type: "integer" },
    column: { type: "integer" },
    text: { type: "string" },
  },
  required: ["path", "line", "column", "text"],
  additionalProperties: false,
};
const searchTextOutput: JsonSchema = {
  type: "object",
  properties: {
    matches: { type: "array", items: textMatch },
    truncated: { type: "boolean" },
    filesScanned: { type: "integer" },
    filesSkipped: { type: "integer" },
    hint: { type: "string" },
  },
  required: ["matches", "truncated", "filesScanned", "filesSkipped"],
  additionalProperties: false,
};
const listFilesInput: JsonSchema = {
  type: "object",
  description: "List directory entries inside the repository root.",
  properties: {
    dir: {
      type: "string",
      description: "Root-relative directory; default is the root (slash-separated, no leading ./).",
      minLength: 1,
      maxLength: 1024,
    },
    depth: {
      type: "integer",
      description: "Levels below dir to descend; default 1 lists children only.",
      minimum: 1,
      maximum: 10,
    },
    limit: {
      type: "integer",
      description: "Max entries to return.",
      minimum: 1,
      maximum: 2000,
    },
  },
  additionalProperties: false,
};
const listEntry: JsonSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    kind: { type: "string", enum: ["file", "dir"] },
  },
  required: ["path", "kind"],
  additionalProperties: false,
};
const listFilesOutput: JsonSchema = {
  type: "object",
  properties: {
    entries: { type: "array", items: listEntry },
    truncated: { type: "boolean" },
    scanned: { type: "integer" },
    skipped: { type: "integer" },
    hint: { type: "string" },
  },
  required: ["entries", "truncated", "scanned", "skipped"],
  additionalProperties: false,
};
const gitLogInput: JsonSchema = {
  type: "object",
  description: "Recent commit history of the repository.",
  properties: {
    limit: {
      type: "integer",
      description: "Max commits to return, newest first.",
      minimum: 1,
      maximum: 100,
    },
    paths: {
      type: "array",
      description: "Optional root-relative paths to restrict history to (slash-separated, no leading ./).",
      items: { type: "string", minLength: 1, maxLength: 1024 },
      maxItems: 32,
    },
    withFiles: {
      type: "boolean",
      description: "Include per-commit file records (path, status, rename oldPath).",
    },
  },
  additionalProperties: false,
};
const logCommit: JsonSchema = {
  type: "object",
  properties: {
    hash: { type: "string" },
    author: { type: "string" },
    date: { type: "string" },
    message: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          oldPath: { type: "string" },
          status: { type: "string" },
        },
        required: ["path", "status"],
        additionalProperties: false,
      },
    },
    filesTruncated: { type: "boolean" },
  },
  required: ["hash", "author", "date", "message"],
  additionalProperties: false,
};
const gitLogOutput: JsonSchema = {
  type: "object",
  properties: {
    commits: { type: "array", items: logCommit },
    truncated: { type: "boolean" },
    hint: { type: "string" },
  },
  required: ["commits", "truncated"],
  additionalProperties: false,
};
const gitDiffInput: JsonSchema = {
  type: "object",
  description: "Worktree changes as unified diff: unstaged by default, staged with the flag.",
  properties: {
    staged: {
      type: "boolean",
      description: "Diff the index instead of the worktree.",
    },
    paths: {
      type: "array",
      description: "Optional root-relative paths to restrict the diff to (slash-separated, no leading ./).",
      items: { type: "string", minLength: 1, maxLength: 1024 },
      maxItems: 32,
    },
    maxBytes: {
      type: "integer",
      description: "Max diff bytes; longer diffs are cut at a line boundary and report truncated.",
      minimum: 1,
      maximum: 1_048_576,
    },
  },
  additionalProperties: false,
};
const gitDiffOutput: JsonSchema = {
  type: "object",
  properties: {
    diff: { type: "string" },
    truncated: { type: "boolean" },
    totalBytes: { type: "integer" },
    staged: { type: "boolean" },
  },
  required: ["diff", "truncated", "totalBytes", "staged"],
  additionalProperties: false,
};
const gitShowInput: JsonSchema = {
  type: "object",
  description: "File content at a Git revision.",
  properties: {
    revision: {
      type: "string",
      description: "HEAD, HEAD~N / HEAD^N ancestry, or a full 40-hex commit SHA.",
      pattern: "^(HEAD([~^][0-9]+)?|[0-9a-f]{40})$",
      maxLength: 100,
    },
    path: {
      type: "string",
      description: "Root-relative file path at that revision (slash-separated, no leading ./).",
      minLength: 1,
      maxLength: 1024,
    },
    maxBytes: {
      type: "integer",
      description: "Max bytes to return; larger blobs report truncated.",
      minimum: 1,
      maximum: 1_048_576,
    },
  },
  required: ["revision", "path"],
  additionalProperties: false,
};
const gitShowOutput: JsonSchema = {
  type: "object",
  properties: {
    path: { type: "string" },
    revision: { type: "string" },
    content: { type: "string" },
    truncated: { type: "boolean" },
    totalBytes: { type: "integer" },
  },
  required: ["path", "revision", "content", "truncated", "totalBytes"],
  additionalProperties: false,
};
const gitStatusInput: JsonSchema = {
  type: "object",
  description: "Staged/unstaged/untracked status of the repository.",
  properties: {},
  additionalProperties: false,
};
const gitStatusOutput: JsonSchema = {
  type: "object",
  properties: {
    branch: { type: "string" },
    staged: { type: "array", items: { type: "string" } },
    unstaged: { type: "array", items: { type: "string" } },
    untracked: { type: "array", items: { type: "string" } },
  },
  required: ["branch", "staged", "unstaged", "untracked"],
  additionalProperties: false,
};

function manifest(): CapabilityModule {
  return {
    id: "repo",
    description:
      "Scoped read-only repository inspection: text reading, file listing, literal search, Git status/history, worktree diffs and historical content. Path convention: every path in inputs and outputs is root-relative, slash-separated, with no leading ./ .",
    operations: [
      {
        name: "readText",
        description:
          "Read a UTF-8 text file inside the repository root, optionally by 1-based line range (fromLine/maxLines, nextLine continues). Binary files, directories and paths outside the root are rejected.",
        inputSchema: readTextInput,
        outputSchema: readTextOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "searchText",
        description:
          "Literal substring search over repository text files. Results are path-sorted with 1-based line/column. Skips .git, symlinks, binary and oversized files.",
        inputSchema: searchTextInput,
        outputSchema: searchTextOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "gitStatus",
        description:
          "Staged, unstaged and untracked files plus the current branch, from fixed-argv git status. No shell, no caller-controlled flags.",
        inputSchema: gitStatusInput,
        outputSchema: gitStatusOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "listFiles",
        description:
          "Sorted bounded listing of a directory inside the root. Skips .git, symlinks and unreadable entries. Files and subdirectories are reported; contents are not read.",
        inputSchema: listFilesInput,
        outputSchema: listFilesOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "gitLog",
        description:
          "Newest-first commit history (hash, author, date, subject) from fixed-argv git log, optionally restricted to paths. withFiles adds per-commit file records with rename-aware old paths.",
        inputSchema: gitLogInput,
        outputSchema: gitLogOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "gitDiff",
        description:
          "Worktree changes as bounded unified diff text (unstaged unless staged is true), optionally restricted to paths. Binary changes appear as Git's own notice.",
        inputSchema: gitDiffInput,
        outputSchema: gitDiffOutput,
        metadata: { readOnly: true, idempotent: true },
      },
      {
        name: "gitShow",
        description:
          "File content at HEAD ancestry or a full commit SHA, with the same UTF-8/binary rules as readText.",
        inputSchema: gitShowInput,
        outputSchema: gitShowOutput,
        metadata: { readOnly: true, idempotent: true },
      },
    ],
  };
}

class RepoConnector implements CapabilityConnector {
  readonly backend = "bun-native";
  constructor(
    private readonly policy: Awaited<ReturnType<typeof resolvePolicy>>,
  ) {}
  async invoke(
    operation: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<CapabilityResult> {
    signal.throwIfAborted();
    switch (operation) {
      case "readText": {
        const { path, maxBytes, fromLine, maxLines } = input as {
          path: string;
          maxBytes?: number;
          fromLine?: number;
          maxLines?: number;
        };
        const resolved = await resolveInRoot(this.policy, path);
        const structured = await readText(
          this.policy,
          resolved.absolute,
          resolved.rel,
          maxBytes,
          signal,
          { fromLine, maxLines },
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "searchText": {
        const { pattern, paths, maxMatches, include, exclude } = input as {
          pattern: string;
          paths?: string[];
          maxMatches?: number;
          include?: string[];
          exclude?: string[];
        };
        const roots = [];
        for (const sub of paths ?? ["."]) {
          const resolved = await resolveInRoot(this.policy, sub);
          const st = await lstat(resolved.absolute);
          if (!st.isDirectory())
            throw new DeniedError(`not a searchable directory: ${sub}`);
          roots.push({ absolute: resolved.absolute, rel: resolved.rel });
        }
        const structured = await searchText(
          this.policy,
          roots,
          pattern,
          { maxMatches, include, exclude },
          signal,
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "gitLog": {
        const { limit, paths, withFiles } = input as {
          limit?: number;
          paths?: string[];
          withFiles?: boolean;
        };
        const relPaths: string[] = [];
        for (const sub of paths ?? []) {
          // Option-injection guard precedes resolution: no path may become
          // a Git flag, even a nonexistent one.
          if (sub.startsWith("-") || sub.startsWith("/"))
            throw new DeniedError(`not a loggable path: ${sub}`);
          const resolved = await resolveInRoot(this.policy, sub);
          relPaths.push(resolved.rel || ".");
        }
        const structured = await gitLog(this.policy.root, relPaths, limit, this.policy, signal, withFiles);
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "listFiles": {
        const { dir, depth, limit } = input as {
          dir?: string;
          depth?: number;
          limit?: number;
        };
        const resolved = await resolveInRoot(this.policy, dir ?? ".");
        const st = await lstat(resolved.absolute);
        if (!st.isDirectory())
          throw new DeniedError(`not a listable directory: ${dir ?? "."}`);
        const structured = await listFiles(
          this.policy,
          resolved.absolute,
          resolved.rel,
          depth,
          limit,
          signal,
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "gitDiff": {
        const { staged, paths, maxBytes } = input as {
          staged?: boolean;
          paths?: string[];
          maxBytes?: number;
        };
        // Containment-only check: diff filters need no current existence
        // and Git resolves its own tree; symlinks are meaningless here.
        const relPaths = (paths ?? []).map((sub) => checkScopePath(this.policy, sub));
        const structured = await gitDiff(
          this.policy.root,
          staged ?? false,
          relPaths,
          maxBytes,
          this.policy,
          signal,
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "gitShow": {
        const { revision, path, maxBytes } = input as {
          revision: string;
          path: string;
          maxBytes?: number;
        };
        const rel = checkScopePath(this.policy, path);
        const structured = await gitShow(
          this.policy.root,
          revision,
          rel,
          maxBytes,
          this.policy,
          signal,
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "gitStatus": {
        const structured = await gitStatus(this.policy.root, signal);
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
  async close(): Promise<void> {}
}

export async function connectRepo(policy: RepoPolicy): Promise<{
  manifest: CapabilityModule;
  connector: CapabilityConnector;
}> {
  const resolved = await resolvePolicy(policy);
  return { manifest: manifest(), connector: new RepoConnector(resolved) };
}
