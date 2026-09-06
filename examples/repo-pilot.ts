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
import { PROFILES, planCells, repoPolicy, snoopedCanary, trialTasks, buildTrialFixture, cellCharge, normalizedCorrect, type RepoProfile } from "./repo-protocol.ts";
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
  if (!["--run", "--profiles", "--tasks", "--model", "--max-cost-usd", "--repeats", "--timeout-ms", "--out", "--max-requests", "--max-output-tokens", "--max-cell-tokens"].includes(token))
    throw new Error(`Unknown option ${token} (old A/B/C/H letters were retired; use --profiles stock-pi,typed-quickjs,typed-bun)`);
}
type Profile = RepoProfile;
const KNOWN_TASKS = trialTasks.map((t) => t.id);
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
const MAX_REQUESTS = Number(opt("--max-requests", "8") ?? "8");
const MAX_OUTPUT_TOKENS = Number(opt("--max-output-tokens", "4096") ?? "4096");
const MAX_CELL_TOKENS = Number(opt("--max-cell-tokens", "10000000") ?? "10000000");
const ISOLATION = "cooperative diagnostics: no sandbox; oracle in controller, canary-monitored tool args";

for (const p of profiles)
  if (!(PROFILES as readonly string[]).includes(p))
    throw new Error(`Unknown profile ${p}; use --profiles ${PROFILES.join(",")} (old A/B/C/H letters were retired: A=stock-pi, C=typed-quickjs, B=typed-bun)`);
for (const t of tasks)
  if (!KNOWN_TASKS.includes(t)) throw new Error(`Unknown task ${t}; use --tasks ${KNOWN_TASKS.join(",")}`);
if (!Number.isSafeInteger(REPEATS) || REPEATS < 1 || REPEATS > 100) throw new Error("--repeats must be an integer in 1..100");
if (!Number.isSafeInteger(TIMEOUT_MS) || TIMEOUT_MS <= 0 || TIMEOUT_MS > 600000) throw new Error("--timeout-ms must be in 1..600000");
if (!Number.isSafeInteger(MAX_REQUESTS) || MAX_REQUESTS < 1 || MAX_REQUESTS > 100) throw new Error("--max-requests must be an integer in 1..100");
if (!Number.isSafeInteger(MAX_OUTPUT_TOKENS) || MAX_OUTPUT_TOKENS < 1 || MAX_OUTPUT_TOKENS > 32768) throw new Error("--max-output-tokens must be an integer in 1..32768");
if (!Number.isSafeInteger(MAX_CELL_TOKENS) || MAX_CELL_TOKENS < 1 || MAX_CELL_TOKENS > 100_000_000) throw new Error("--max-cell-tokens must be an integer in 1..100000000");
if (!/^[\w./:-]+$/.test(MODEL)) throw new Error("Invalid model ID");
const maxCostUsd = MAX_COST === undefined ? null : Number(MAX_COST);
if (LIVE && (maxCostUsd === null || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1000))
  throw new Error("Live runs require explicit --max-cost-usd in (0, 1000]");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = OUT ?? `${root}.work/repo-pilot/${stamp}`;
const key = process.env.OPENROUTER_API_KEY;


const tooling: Record<Profile, string> = {
  "stock-pi": "Use the available file and shell tools (read, bash with cat/grep, git).",
  "typed-quickjs":
    "Use ONLY typed_program with `import { api } from '@c/repo'`. Direct file and shell tools are disabled; do not attempt them. program_details may inspect past runs.",
  "typed-bun":
    "Use ONLY typed_program with `import { api } from '@c/repo'`. Direct file and shell tools are disabled; do not attempt them. program_details may inspect past runs. Programs run on the direct-Bun executor: capability calls pass the same validation and policy, but ambient host APIs are reachable, so only use the @c/repo api and pure computation.",
};
const engineOf = (profile: Profile) =>
  profile === "typed-bun" ? "bun" : profile === "typed-quickjs" ? "quickjs" : "n/a-stock";

// Counterbalanced profile order within each task block across repeats.
const cells = planCells(tasks, profiles as Profile[], REPEATS);

// Budget model: dual ledger. Admission control stays worst-case (the guard
// reserves full-context catalog prices per request, so no single request can
// exceed what remains). Cap accounting deducts REPORTED actuals per
// completed cell (summed message usage costs + fixed request fees) and falls
// back to the reservation only when usage is missing — hidden usage can
// never silently cost zero. Rationale: OpenRouter returns per-request token
// usage, not billed cost; Pi multiplies by catalog rates into usage.cost, so
// actuals are estimates, while per-request ground truth would need generation
// IDs Pi does not surface. Key-level reconciliation (cumulative credits,
// account-global) is recorded start/end for reporting, never enforcement.
async function keyUsage(): Promise<number | null> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key",
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    const body: unknown = await response.json();
    const used = record(body) && record(body.data) ? (body.data as Record<string, unknown>).usage : undefined;
    return typeof used === "number" ? used : null;
  } catch {
    return null;
  }
}

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
    models: [{ id: MODEL, contextWindow, maxTokens: MAX_OUTPUT_TOKENS, reasoning: false, input: ["text"], cost: {
      input: rates.input * 1e6, output: rates.output * 1e6, cacheRead: rates.cacheRead * 1e6, cacheWrite: rates.cacheWrite * 1e6,
    } }],
  } } }));
  await save("run-manifest.json", { protocol, artifactVersion, gitCommit: await gitMeta(["rev-parse", "HEAD"]),
    gitStatus: await gitMeta(["status", "--porcelain"]), bunVersion: Bun.version, platform: process.platform,
    model: MODEL, thinking: "off", tasks: trialTasks.map(({ build: _b, ...rest }) => rest), profiles, allow: FULL_READ_ALLOW, limits: { timeoutMs: TIMEOUT_MS, maxRequests: MAX_REQUESTS,
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxCellTokens: MAX_CELL_TOKENS, maxCostUsd },
    isolation: ISOLATION, externalRestrictions: "none (same for all profiles); typed profiles additionally run under STRATA_STRICT=1" });
  await writeFile(join(outDir, "declarations.d.ts"), declarations);
  // Dual ledger: admission stays worst-case (guard reservations), while the
  // cap deducts reported actuals per completed cell and falls back to the
  // reservation only when usage is missing. Key-level reconciliation below
  // is report-only (account-global) and never enforcement.
  const keyUsageStart = await keyUsage();
  let spentLedger = 0;
  let reservedTotal = 0;
  const persist = async () => save("results.json", { protocol, artifactVersion, model: MODEL, spentLedger, reservedTotal, keyUsageStart, cells: results });
  for (const cell of cells) {
    const task = trialTasks.find((t) => t.id === cell.task)!;
    const budget: Budget = { maxRequests: MAX_REQUESTS, maxTokens: MAX_CELL_TOKENS, maxCostUsd: maxCostUsd! - spentLedger, requestTokens, requestCostUsd };
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
      `Working directory is this repository. ${task.ask}\n${tooling[cell.profile]}\nReport paths exactly as the API returns them: root-relative, no leading ./. Reply with ONLY the \`\`\`json block, no explanation.`;
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
    const charge = cellCharge(assessment.usage, requests, requestCostUsd, rates.request);
    spentLedger += charge.charged;
    reservedTotal += charge.reserved;
    const result = { ...cell, status: "attempted", engine: engineOf(cell.profile),
      strict: cell.profile !== "stock-pi", containment: "none — cooperative diagnostics",
      attempt: 1, ...assessment,
      execution: { exitCode: processResult.exitCode, termination, guardStop, ms: processResult.ms },
      estimatedCostUsd: assessment.usage.cost === null ? null : assessment.usage.cost + requests * rates.request,
      reservation: { requests, tokens: requests * requestTokens, costUsd: requests * requestCostUsd },
      charge,
      snoopedCanary: snooped,
      normalizedCorrect: normalizedCorrect(assessment.finalText, task.expected),
      promptBytes: Buffer.byteLength(prompt),
      declarationBytes: cell.profile === "stock-pi" ? 0 : Buffer.byteLength(declarations) };
    results.push(result);
    await save(`${cell.id}.json`, result);
    await persist();
    console.log(`${cell.id}: success=${assessment.success} healthy=${assessment.harness.healthy} usageComplete=${assessment.accounting.complete} snooped=${snooped} charged=$${charge.charged.toFixed(4)}${charge.actual === null ? " (reservation fallback)" : ""}`);
    if (unreserved) throw new Error("Stopping run: guard request accounting failed");
  }
  // Incorrect answers are data; incomplete execution/accounting/adherence invalidates a comparison run.
  if (results.some((r) => (r as Record<string, unknown>).status !== "attempted" || !record((r as Record<string, unknown>).harness) || !((r as Record<string, unknown>).harness as Record<string, unknown>).healthy || !record((r as Record<string, unknown>).accounting) || !((r as Record<string, unknown>).accounting as Record<string, unknown>).complete || !record((r as Record<string, unknown>).policy) || !((r as Record<string, unknown>).policy as Record<string, unknown>).compliant)) process.exitCode = 1;
  console.log(`Results: ${join(outDir, "results.json")}`);
  const keyUsageEnd = await keyUsage();
  await save("results.json", { protocol, artifactVersion, model: MODEL, spentLedger, reservedTotal, keyUsageStart, keyUsageEnd,
    keyDeltaNote: "key usage is account-global (includes any concurrent usage outside this run), for reconciliation only", cells: results });
  console.log(`Ledger: $${spentLedger.toFixed(4)} actual-or-fallback of $${maxCostUsd} cap; key credits ${keyUsageStart ?? "?"} → ${keyUsageEnd ?? "?"}`);
} catch (error) {
  await save("failure.json", { error: error instanceof Error ? error.message : String(error) });
  throw error;
}
