// Repository trial runner (protocol repo-1): stock-pi vs typed-quickjs vs
// typed-bun on seeded repository tasks. Default is dry-run (no model calls).
// Live: --run --max-cost-usd <cap> (requires OPENROUTER_API_KEY).
//
// Section-0 repairs (issue 028) over the original feasibility pilot:
// - Pre-request reservations via the shared benchmark guard (loaded in every
//   profile) instead of a between-cells spend check; missing usage stays null.
// - Bounded process-group supervision via shared capture() instead of a bare
//   child kill; stdout/stderr capped, not fully materialized in memory.
// - Final-answer-only grading: only the last completed assistant message is
//   graded (pure JSON, else its last ```json block). Exit code, termination,
//   malformed events and incomplete lifecycles invalidate success.
// - The oracle lives in the controller: no expected.json beside the repo.
//   A per-cell canary file detects evaluator-material access through tool
//   args; hits are policy violations. This is cooperative diagnostics, not a
//   sandbox: stock shell and direct Bun can read anything on disk.
// - Pinned run manifest (git commit, model/pricing, tasks, prompts,
//   declarations, limits) outside candidate-visible directories.
// - Descriptive profile ids (stock-pi/typed-quickjs/typed-bun) and
//   counterbalanced profile order within task blocks.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reserve, priceModel, type Budget } from "./benchmark/config.ts";
import { assess, record } from "./benchmark/protocol.ts";
import { PROFILES, planCells, repoPolicy, snoopedCanary, type RepoProfile } from "./repo-protocol.ts";
import { REXPORT_TASKS, buildRexportFixture } from "./repo-tasks/rexport.ts";
import { RLOG_TASKS, buildRlogFixture } from "./repo-tasks/rlog.ts";
import { RLOC_TASKS, buildRlocFixture } from "./repo-tasks/rloc.ts";
import { capture } from "./benchmark/process.ts";
import type { GuardConfig } from "./benchmark/guard.ts";
import { connectRepo } from "../src/capabilities/repo/connector.ts";
import { createSession } from "../src/session.ts";

const protocol = "repo-2";
const artifactVersion = 2;
const root = new URL("../", import.meta.url).pathname;
const args = new Set(process.argv.slice(2));
const opt = (name: string, fallback: string | undefined) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};
const LIVE = args.has("--run");
for (const token of process.argv.slice(2)) {
  if (!token.startsWith("--")) continue;
  if (!["--run", "--profiles", "--tasks", "--model", "--max-cost-usd", "--repeats", "--timeout-ms", "--out"].includes(token))
    throw new Error(`Unknown option ${token} (old A/B/C/H letters were retired; use --profiles stock-pi,typed-quickjs,typed-bun)`);
}
type Profile = RepoProfile;
const KNOWN_TASKS = ["T1", "T2", "T3",
  ...REXPORT_TASKS.map((t) => t.id), ...RLOG_TASKS.map((t) => t.id), ...RLOC_TASKS.map((t) => t.id)];
// Default matrix is the six development instances (028 §3); T1–T3 stay as
// opt-in diagnostics, held-out instances run only by explicit selection.
const DEV_TASKS = ["R-EXPORT-1", "R-EXPORT-2", "R-LOG-1", "R-LOG-2", "R-LOC-1", "R-LOC-2"];
const FULL_READ_ALLOW = ["readText", "searchText", "gitStatus", "listFiles", "gitLog", "gitDiff", "gitShow"];
const profiles = (opt("--profiles", PROFILES.join(",")) ?? "").split(",").filter(Boolean);
const tasks = (opt("--tasks", DEV_TASKS.join(",")) ?? "").split(",").filter(Boolean);
const MODEL = opt("--model", "meta/muse-spark-1.3-contributor")!;
const MAX_COST = opt("--max-cost-usd", undefined);
const REPEATS = Number(opt("--repeats", "1") ?? "1");
const TIMEOUT_MS = Number(opt("--timeout-ms", "150000") ?? "150000");
const OUT = opt("--out", undefined);
const MAX_REQUESTS = 8;
const MAX_OUTPUT_TOKENS = 4096;
const MAX_CELL_TOKENS = 2_000_000;
const ISOLATION = "cooperative diagnostics: no sandbox; oracle in controller, canary-monitored tool args";

for (const p of profiles)
  if (!(PROFILES as readonly string[]).includes(p))
    throw new Error(`Unknown profile ${p}; use --profiles ${PROFILES.join(",")} (old A/B/C/H letters were retired: A=stock-pi, C=typed-quickjs, B=typed-bun)`);
for (const t of tasks)
  if (!KNOWN_TASKS.includes(t)) throw new Error(`Unknown task ${t}; use --tasks ${KNOWN_TASKS.join(",")}`);
if (!Number.isSafeInteger(REPEATS) || REPEATS < 1 || REPEATS > 100) throw new Error("--repeats must be an integer in 1..100");
if (!Number.isSafeInteger(TIMEOUT_MS) || TIMEOUT_MS <= 0 || TIMEOUT_MS > 600000) throw new Error("--timeout-ms must be in 1..600000");
if (!/^[\w./:-]+$/.test(MODEL)) throw new Error("Invalid model ID");
const maxCostUsd = MAX_COST === undefined ? null : Number(MAX_COST);
if (LIVE && (maxCostUsd === null || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1000))
  throw new Error("Live runs require explicit --max-cost-usd in (0, 1000]");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = OUT ?? `${root}.work/repo-pilot/${stamp}`;
const key = process.env.OPENROUTER_API_KEY;

interface Task {
  id: string;
  ask: string;
  expected: unknown;
}
// Counterbalanced profile order within each task block across repeats.
const cells = planCells(tasks, profiles as Profile[], REPEATS);

const seedTasks: Task[] = [
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
const seed = async (repo: string) => {
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
  return repo;
};

interface TrialTask {
  id: string;
  ask: string;
  expected: unknown;
  build: (repo: string) => Promise<void>;
}
const trialTasks: TrialTask[] = [
  ...seedTasks.map((t) => ({ ...t, build: async (repo: string) => { await seed(repo); } })),
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

const tooling: Record<Profile, string> = {
  "stock-pi": "Use the available file and shell tools (read, bash with cat/grep, git).",
  "typed-quickjs":
    "Use ONLY typed_program with `import { api } from '@c/repo'`. Direct file and shell tools are disabled; do not attempt them. program_details may inspect past runs.",
  "typed-bun":
    "Use ONLY typed_program with `import { api } from '@c/repo'`. Direct file and shell tools are disabled; do not attempt them. program_details may inspect past runs. Programs run on the direct-Bun executor: capability calls pass the same validation and policy, but ambient host APIs are reachable, so only use the @c/repo api and pure computation.",
};
const engineOf = (profile: Profile) =>
  profile === "typed-bun" ? "bun" : profile === "typed-quickjs" ? "quickjs" : "n/a-stock";

if (!LIVE) {
  console.log(
    JSON.stringify({ protocol, artifactVersion, note: "Offline dry run: no files, network or model calls. Live mode requires --run and --max-cost-usd.", cells }, null, 2),
  );
  process.exit(0);
}
if (!key) throw new Error("Set OPENROUTER_API_KEY for --run");
if (process.platform === "win32") throw new Error("Benchmark process supervision currently requires POSIX");

const results: Record<string, unknown>[] = [];
await mkdir(join(outDir, ".."), { recursive: true });
await mkdir(outDir);
const save = (name: string, data: unknown) => writeFile(join(outDir, name), JSON.stringify(data, null, 2) + "\n");
try {
  const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Model catalog: HTTP ${response.status}`);
  const priced = priceModel(await response.json(), MODEL, MAX_OUTPUT_TOKENS);
  const { rates, contextWindow, requestTokens, requestCostUsd } = priced;
  console.log(`model ${MODEL} @ $${rates.input}/tok in, $${rates.output}/tok out; cap $${maxCostUsd}`);
  await save("pricing.json", { fetchedAt: new Date().toISOString(), source: "https://openrouter.ai/api/v1/models", model: priced.model, rates, requestTokens, requestCostUsd });
  const gitMeta = async (a: string[]) => {
    const child = Bun.spawn(["git", ...a], { cwd: root, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`git metadata failed: ${stderr}`);
    return stdout.trim();
  };
  // Declarations snapshot: what typed profiles actually see in their prompts.
  const { manifest, connector } = await connectRepo({ root: tmpdir() });
  const declSession = await createSession(manifest, connector, new Set(FULL_READ_ALLOW));
  const declarations = declSession.declarations;
  await declSession.close();
  const profileDir = join(outDir, "profile");
  await mkdir(profileDir);
  await writeFile(join(profileDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: TIMEOUT_MS } } }));
  await writeFile(join(profileDir, "models.json"), JSON.stringify({ providers: { openrouter: {
    baseUrl: "https://openrouter.ai/api/v1", api: "openai-completions", apiKey: "OPENROUTER_API_KEY",
    models: [{ id: MODEL, contextWindow, maxTokens: MAX_OUTPUT_TOKENS, reasoning: false, input: ["text"] }],
  } } }));
  await save("run-manifest.json", { protocol, artifactVersion, gitCommit: await gitMeta(["rev-parse", "HEAD"]),
    gitStatus: await gitMeta(["status", "--porcelain"]), bunVersion: Bun.version, platform: process.platform,
    model: MODEL, thinking: "off", tasks: trialTasks.map(({ build: _b, ...rest }) => rest), profiles, allow: FULL_READ_ALLOW, limits: { timeoutMs: TIMEOUT_MS, maxRequests: MAX_REQUESTS,
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxCellTokens: MAX_CELL_TOKENS, maxCostUsd },
    isolation: ISOLATION, externalRestrictions: "none (same for all profiles); typed profiles additionally run under STRATA_STRICT=1" });
  await writeFile(join(outDir, "declarations.d.ts"), declarations);
  let reservedCostUsd = 0;
  const persist = async () => save("results.json", { protocol, artifactVersion, model: MODEL, reservedCostUsd, cells: results });
  for (const cell of cells) {
    const task = trialTasks.find((t) => t.id === cell.task)!;
    const budget: Budget = { maxRequests: MAX_REQUESTS, maxTokens: MAX_CELL_TOKENS, maxCostUsd: maxCostUsd! - reservedCostUsd, requestTokens, requestCostUsd };
    const skip = reserve(budget, 0);
    if (skip) {
      results.push({ ...cell, status: "not_run", reason: skip });
      await persist();
      continue;
    }
    const cwd = join(outDir, cell.id);
    await mkdir(cwd, { recursive: true });
    const repo = join(cwd, "repo");
    await mkdir(repo, { recursive: true });
    await task.build(repo);
    const canary = randomBytes(8).toString("hex");
    await writeFile(join(repo, ".canary"), `evaluator canary ${canary}: not part of the task, do not read\n`);
    const guard: GuardConfig = { budget, model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS,
      requestsPath: join(cwd, "requests.jsonl"), stopPath: join(cwd, "stop.json"), promptPath: join(cwd, "effective-prompt.json") };
    const guardPath = join(cwd, "guard.json");
    await writeFile(guardPath, JSON.stringify(guard));
    const prompt =
      `Working directory is this repository. ${task.ask}\n${tooling[cell.profile]}\nReply with ONLY the \`\`\`json block, no explanation.`;
    await writeFile(join(cwd, "prompt.txt"), prompt);
    const configPath = join(cwd, "strata.json");
    if (cell.profile !== "stock-pi")
      await writeFile(configPath, JSON.stringify({ transport: "repo", root: repo, allow: FULL_READ_ALLOW }));
    const { STRATA_CONFIG: _strata, STRATA_BENCHMARK_GUARD: _guard, ...env } = process.env;
    const cliArgs = [
      process.execPath,
      join(root, "node_modules/@mariozechner/pi-coding-agent/dist/cli.js"),
      "--provider", "openrouter",
      "--model", MODEL,
      "--thinking", "off",
      "--no-session", "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--no-context-files",
      "--mode", "json",
      ...(cell.profile === "stock-pi" ? [] : ["-e", join(root, "src/pi/extension.ts")]),
      "-e", join(root, "examples/benchmark/guard.ts"),
      "-p", prompt,
    ];
    const processResult = await capture(cliArgs, { cwd: repo, env: { ...env, PI_CODING_AGENT_DIR: profileDir,
      STRATA_BENCHMARK_GUARD: guardPath,
      ...(cell.profile === "stock-pi" ? {} : { STRATA_CONFIG: configPath }),
      ...(cell.profile === "stock-pi" ? {} : { STRATA_STRICT: "1" }),
      ...(cell.profile === "typed-bun" ? { STRATA_EXECUTOR: "bun" } : {}) },
      timeoutMs: TIMEOUT_MS, stdoutPath: join(cwd, "stdout.jsonl"), stderrPath: join(cwd, "stderr.txt") });
    let requests = 0;
    try {
      const receipts = (await readFile(guard.requestsPath, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
      for (const [i, receipt] of receipts.entries()) {
        if (!record(receipt) || receipt.request !== i + 1 || receipt.reservedTokens !== requestTokens || receipt.reservedCostUsd !== requestCostUsd) throw new Error("Invalid request reservation receipt");
      }
      requests = receipts.length;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    reservedCostUsd += requests * requestCostUsd;
    const termination = processResult.exitCode === 78 ? "guard" as const : processResult.termination;
    let guardStop: unknown = null;
    if (termination === "guard") {
      try { guardStop = JSON.parse(await readFile(guard.stopPath, "utf8")); }
      catch { guardStop = { reason: "Guard exited without a stop receipt" }; }
    }
    const assessment = assess({ task: cell.task, profile: cell.profile, model: MODEL, stdout: processResult.stdout,
      exitCode: processResult.exitCode, termination, policy: repoPolicy(cell.profile, task.expected) });
    const unreserved = assessment.modelResponses > requests;
    if (unreserved) {
      assessment.harness.healthy = false;
      assessment.harness.errors.push("Assistant response without a request reservation");
      assessment.success = false;
    }
    const snooped = snoopedCanary(processResult.stdout, canary);
    if (snooped) {
      assessment.policy.compliant = false;
      assessment.policy.violations.push("Evaluator canary accessed through tool args");
      assessment.success = false;
    }
    const result = { ...cell, status: "attempted", engine: engineOf(cell.profile),
      strict: cell.profile !== "stock-pi", containment: "none — cooperative diagnostics",
      attempt: 1, ...assessment,
      execution: { exitCode: processResult.exitCode, termination, guardStop, ms: processResult.ms },
      estimatedCostUsd: assessment.usage.cost === null ? null : assessment.usage.cost + requests * rates.request,
      reservation: { requests, tokens: requests * requestTokens, costUsd: requests * requestCostUsd },
      snoopedCanary: snooped,
      promptBytes: Buffer.byteLength(prompt),
      declarationBytes: cell.profile === "stock-pi" ? 0 : Buffer.byteLength(declarations) };
    results.push(result);
    await save(`${cell.id}.json`, result);
    await persist();
    console.log(`${cell.id}: success=${assessment.success} healthy=${assessment.harness.healthy} usageComplete=${assessment.accounting.complete} snooped=${snooped}`);
    if (unreserved) throw new Error("Stopping run: guard request accounting failed");
  }
  // Incorrect answers are data; incomplete execution/accounting/adherence invalidates a comparison run.
  if (results.some((r) => (r as Record<string, unknown>).status !== "attempted" || !record((r as Record<string, unknown>).harness) || !((r as Record<string, unknown>).harness as Record<string, unknown>).healthy || !record((r as Record<string, unknown>).accounting) || !((r as Record<string, unknown>).accounting as Record<string, unknown>).complete || !record((r as Record<string, unknown>).policy) || !((r as Record<string, unknown>).policy as Record<string, unknown>).compliant)) process.exitCode = 1;
  console.log(`Results: ${join(outDir, "results.json")}`);
} catch (error) {
  await save("failure.json", { error: error instanceof Error ? error.message : String(error) });
  throw error;
}
