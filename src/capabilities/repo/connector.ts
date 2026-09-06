import type {
  CapabilityConnector,
  CapabilityModule,
  CapabilityResult,
  JsonSchema,
} from "../manifest.ts";
import { lstat } from "node:fs/promises";
import { bytes } from "../manifest.ts";
import type { RepoPolicy } from "./policy.ts";
import { resolvePolicy, resolveInRoot, DeniedError } from "./policy.ts";
import { readText, searchText, gitStatus } from "./operations.ts";

const readTextInput: JsonSchema = {
  type: "object",
  description: "Read a UTF-8 text file inside the repository root.",
  properties: {
    path: {
      type: "string",
      description: "Root-relative file path, e.g. package.json.",
      minLength: 1,
      maxLength: 1024,
    },
    maxBytes: {
      type: "integer",
      description: "Max bytes to return; larger files report truncated.",
      minimum: 1,
      maximum: 1_048_576,
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
  },
  required: ["path", "content", "truncated", "totalBytes"],
  additionalProperties: false,
};
const searchTextInput: JsonSchema = {
  type: "object",
  description: "Literal substring search over text files inside the root.",
  properties: {
    pattern: {
      type: "string",
      description: "Literal substring to find (not a regex).",
      minLength: 1,
      maxLength: 500,
    },
    paths: {
      type: "array",
      description: "Root-relative directories to search; default is the root.",
      items: { type: "string", minLength: 1, maxLength: 1024 },
      maxItems: 32,
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
  },
  required: ["matches", "truncated", "filesScanned", "filesSkipped"],
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
      "Scoped read-only repository inspection: text reading, literal search, Git status.",
    operations: [
      {
        name: "readText",
        description:
          "Read a UTF-8 text file inside the repository root. Binary files, directories and paths outside the root are rejected.",
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
        const { path, maxBytes } = input as { path: string; maxBytes?: number };
        const resolved = await resolveInRoot(this.policy, path);
        const structured = await readText(
          this.policy,
          resolved.absolute,
          resolved.rel,
          maxBytes,
          signal,
        );
        return { structured, untyped: structured, rawBytes: bytes(structured) };
      }
      case "searchText": {
        const { pattern, paths, maxMatches } = input as {
          pattern: string;
          paths?: string[];
          maxMatches?: number;
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
          maxMatches,
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
