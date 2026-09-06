// Repository-trial protocol helpers (repo-1): cell planning, task grading
// policy and the evaluator-canary detector. Pure and side-effect free so the
// offline suite can pin them; examples/repo-pilot.ts owns execution.
import { isDeepStrictEqual } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { REXPORT_TASKS, buildRexportFixture } from "./repo-tasks/rexport.ts";
import { RLOG_TASKS, buildRlogFixture } from "./repo-tasks/rlog.ts";
import { RLOC_TASKS, buildRlocFixture } from "./repo-tasks/rloc.ts";
import type { Usage } from "./benchmark/protocol.ts";
import { record, type AssessPolicy } from "./benchmark/protocol.ts";
import { auditToolArgs } from "./benchmark/audit.ts";

export const PROFILES = ["stock-pi", "typed-quickjs", "typed-bun"] as const;
export type RepoProfile = (typeof PROFILES)[number];
export const STOCK_TOOLS = ["bash", "read", "write", "edit", "find", "grep", "ls"];
export const TYPED_TOOLS = ["typed_program", "program_details"];

export interface RepoCell {
  id: string; task: string; profile: RepoProfile; repeat: number;
}

/** Counterbalanced profile order within each task block across repeats. */
export function planCells(tasks: string[], profiles: RepoProfile[], repeats: number): RepoCell[] {
  const cells: RepoCell[] = [];
  for (let rep = 0; rep < repeats; rep++)
    for (const [taskIndex, taskId] of tasks.entries())
      for (let i = 0; i < profiles.length; i++) {
        const profile = profiles[(i + taskIndex + rep) % profiles.length]!;
        cells.push({ id: `cell-${taskId}-${profile}-r${rep}`, task: taskId, profile, repeat: rep });
      }
  return cells;
}

/** Final-answer-only grading against the controller-held oracle. The full
 * final text parses as JSON, else its last ```json block; anything else is
 * incorrect. Earlier messages never count. */
export function gradeFinal(expected: unknown): AssessPolicy["grade"] {
  return (finalText) => {
    const text = finalText.trim();
    const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
    const candidates = blocks.length ? [text, blocks[blocks.length - 1]!] : [text];
    for (const candidate of candidates) {
      try {
        if (isDeepStrictEqual(JSON.parse(candidate), expected))
          return { correct: true, reason: null };
      } catch {
        /* not JSON; try the next candidate */
      }
    }
    return { correct: false, reason: "Final answer does not equal the independent expected value" };
  };
}

/** Secondary diagnostic: strip a leading ./ from every string in a parsed
 * answer, then compare. A miss here is a real error; a hit here after an
 * exact-grading miss is classified formatting variance (path-prefix class).
 * Never replaces the exact verdict; frozen oracles stand. */
export function stripDotSlash(value: unknown): unknown {
  if (typeof value === "string") return value.startsWith("./") ? value.slice(2) : value;
  if (Array.isArray(value)) return value.map(stripDotSlash);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripDotSlash(v)]));
  return value;
}
export function normalizedCorrect(finalText: string, expected: unknown): boolean {
  const text = finalText.trim();
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = blocks.length ? [text, blocks[blocks.length - 1]!] : [text];
  for (const candidate of candidates) {
    try {
      if (isDeepStrictEqual(stripDotSlash(JSON.parse(candidate)), expected)) return true;
    } catch {
      /* not JSON; try the next candidate */
    }
  }
  return false;
}

export function repoPolicy(profile: RepoProfile, expected: unknown): AssessPolicy {
  return {
    grade: gradeFinal(expected),
    toolViolation: (name) =>
      profile === "stock-pi"
        ? (!STOCK_TOOLS.includes(name) ? `Non-stock tool: ${name}` : null)
        : (!TYPED_TOOLS.includes(name) ? `Non-typed tool: ${name}` : null),
    collectTypedMetrics: profile !== "stock-pi",
    observeRecovery: false,
    recoveryRequired: false,
    noToolsViolation: "No tool use observed",
  };
}

/** Dual-ledger cell charge (see header note in repo-pilot.ts).
 * OpenRouter reports per-request tokens, not billed cost; Pi multiplies by
 * catalog rates into usage.cost. When the trace accounting is complete we
 * deduct the reported actuals; when usage is missing we fall back to the
 * worst-case reservation so hidden usage can never silently cost zero. */
export interface CellCharge { actual: number | null; reserved: number; charged: number }
export function cellCharge(usage: Usage, requests: number, requestCostUsd: number, requestFee: number): CellCharge {
  const reserved = requests * requestCostUsd;
  const actual = usage.cost === null ? null : usage.cost + requests * requestFee;
  return { actual, reserved, charged: actual ?? reserved };
}

/** Detect evaluator-material access: any tool-call argument referencing the
 * per-cell canary token, or any parent-tilde traversal (which no task needs).
 * Reading the canary is never needed for the task. Shares the mechanism with
 * the benchmark auditor; malformed lines are skipped, never counted. */
export function snoopedCanary(stdout: string, token: string): boolean {
  const calls: { toolCallId: string; toolName: string; args: unknown }[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      record(event) &&
      event.type === "tool_execution_start" &&
      typeof event.toolCallId === "string" &&
      typeof event.toolName === "string"
    )
      calls.push({ toolCallId: event.toolCallId, toolName: event.toolName, args: event.args });
  }
  return !auditToolArgs(calls, { substrings: [token], forbidParentTraversal: true }).clean;
}

// T1-T3 atlas fixture and the 028 task corpus registry.
interface AtlasTask {
  id: string;
  ask: string;
  expected: unknown;
}
const seedTasks: AtlasTask[] = [
  {
    id: "T1",
    ask: 'Read package.json and report exactly {"name","version","testScript"} (scripts.test).',
    expected: { name: "atlas", version: "2.4.1", testScript: "bun test" },
  },
  {
    id: "T2",
    ask: "Find the definition of the function named `greet`. Report exactly {\"path\" (repo-relative), \"line\" (1-based), \"signature\" (the full definition line, trimmed)}.",
    expected: {
      path: "src/main.ts",
      line: 1,
      signature: "export function greet(name: string) {",
    },
  },
  {
    id: "T3",
    ask: "Report working-tree status exactly {\"branch\",\"staged\",\"unstaged\",\"untracked\"} with sorted arrays.",
    expected: {
      branch: "main",
      staged: ["staged.txt"],
      unstaged: ["src/main.ts"],
      untracked: ["notes.txt"],
    },
  },
];
async function seedAtlas(repo: string): Promise<void> {
  await mkdir(`${repo}/src`, { recursive: true });
  await writeFile(
    `${repo}/package.json`,
    JSON.stringify(
      { name: "atlas", version: "2.4.1", scripts: { test: "bun test" } },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${repo}/src/main.ts`,
    "export function greet(name: string) {\n  return `hello ${name}`;\n}\n",
  );
  await writeFile(`${repo}/README.md`, "# atlas\n");
  const git = (a: string[]) => {
    const proc = Bun.spawnSync(["git", ...a], {
      cwd: repo,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
    if (proc.exitCode !== 0)
      throw new Error(`git ${a.join(" ")}: ${proc.stderr.toString().slice(0, 200)}`);
  };
  git(["init", "-b", "main"]);
  git(["add", "package.json", "src/main.ts", "README.md"]);
  git(["commit", "-m", "initial"]);
  await writeFile(`${repo}/staged.txt`, "staged\n");
  git(["add", "staged.txt"]);
  await writeFile(
    `${repo}/src/main.ts`,
    "export function greet(name: string) {\n  return `hello ${name}!`;\n}\n",
  );
  await writeFile(`${repo}/notes.txt`, "todo\n");
}

export const trialTasks: TrialTask[] = [
  ...seedTasks.map((t) => ({ ...t, build: async (repo: string) => { await seedAtlas(repo); } })),
  ...REXPORT_TASKS.map((t) => ({
    id: t.id, ask: t.ask, expected: t.expected,
    build: async (repo: string) => void (await buildRexportFixture(repo, t.fixture)),
  })),
  ...RLOG_TASKS.map((t) => ({
    id: t.id, ask: t.ask, expected: t.expected,
    build: async (repo: string) => void (await buildRlogFixture(repo, t.fixture)),
  })),
  ...RLOC_TASKS.map((t) => ({
    id: t.id, ask: t.ask, expected: t.expected,
    build: async (repo: string) => void (await buildRlocFixture(repo, t.fixture)),
  })),
];

export interface TrialTask {
  id: string;
  ask: string;
  expected: unknown;
  build: (repo: string) => Promise<void>;
}

export async function buildTrialFixture(taskId: string, repo: string): Promise<TrialTask> {
  const task = trialTasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Unknown trial task ${taskId}`);
  await task.build(repo);
  return task;
}
