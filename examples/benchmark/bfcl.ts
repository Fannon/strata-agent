// BFCL invocation-diagnostic runner (issue 037).
//
// Per case: serve the case's tools through a recording MCP server, run one
// guarded typed-only Pi session against them, and grade the RECORDED CALLS
// (not the final text) with BFCL-style tolerance. Incorrect answers are
// data; incomplete runs exit nonzero. All artifacts go to --out (caller
// picks an ignored .work path). Paid model calls only in live mode.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reserve, priceModel, type Budget } from "./config.ts";
import { record } from "./protocol.ts";
import { cellCharge } from "../repo-protocol.ts";
import type { Usage } from "./protocol.ts";
import { capture } from "./process.ts";
import type { GuardConfig } from "./guard.ts";
import { BFCL_PIN, SUBSET, loadCases, loadGroundTruth, normalizeFunction, type BfclCase, type BfclGroundTruth } from "../bfcl/cases.ts";
import { gradeCase, type RecordedCall } from "../bfcl/grade.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const opt = (name: string, fallback: string | undefined) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};
const args = new Set(process.argv.slice(2));
const LIVE = args.has("--run");
for (const token of process.argv.slice(2)) {
  if (!token.startsWith("--")) continue;
  if (!["--run", "--dry-run", "--out", "--model", "--thinking", "--max-cost-usd", "--repeats", "--timeout-ms", "--max-requests", "--max-output-tokens", "--max-cell-tokens", "--data"].includes(token))
    throw new Error(`Unknown option ${token}`);
}
const MODEL = opt("--model", "meta/muse-spark-1.3-contributor")!;
const OUT = opt("--out", undefined);
const REPEATS = Number(opt("--repeats", "1") ?? "1");
const TIMEOUT_MS = Number(opt("--timeout-ms", "120000") ?? "120000");
const MAX_REQUESTS = Number(opt("--max-requests", "4") ?? "4");
const MAX_OUTPUT_TOKENS = Number(opt("--max-output-tokens", "2048") ?? "2048");
const MAX_CELL_TOKENS = Number(opt("--max-cell-tokens", "2000000") ?? "2000000");
const DATA = opt("--data", join(root, ".work/bfcl/upstream/berkeley-function-call-leaderboard/bfcl_eval/data"))!;
const MAX_COST = opt("--max-cost-usd", undefined);
if (!/^[\w./:-]+$/.test(MODEL)) throw new Error("Invalid model ID");
const maxCostUsd = MAX_COST === undefined ? null : Number(MAX_COST);
if (LIVE && (maxCostUsd === null || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1000))
  throw new Error("Live runs require explicit --max-cost-usd in (0, 1000]");
if (!Number.isSafeInteger(REPEATS) || REPEATS < 1 || REPEATS > 10) throw new Error("--repeats must be an integer in 1..10");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = OUT ?? join(root, `.work/bfcl/runs/${stamp}`);

const fileHash = async (path: string) =>
  createHash("sha256").update(await readFile(path)).digest("hex");

async function main(): Promise<void> {
  const cases = await loadCases(DATA);
  const groundTruth = new Map<string, Map<string, BfclGroundTruth>>();
  for (const file of ["BFCL_v4_simple_python.json", "BFCL_v4_multiple.json"]) {
    groundTruth.set(file, await loadGroundTruth(DATA, file.replace(/\.json$/, "")));
  }
  const cells: { id: string; case: BfclCase; repeat: number }[] = [];
  for (let rep = 0; rep < REPEATS; rep++)
    for (const c of cases) cells.push({ id: `cell-${c.id}-r${rep}`, case: c, repeat: rep });

  const plan = {
    protocol: "bfcl-diagnostic",
    artifactVersion: 1,
    pin: BFCL_PIN,
    subset: SUBSET,
    files: {
      "BFCL_v4_simple_python.json": await fileHash(join(DATA, "BFCL_v4_simple_python.json")),
      "BFCL_v4_multiple.json": await fileHash(join(DATA, "BFCL_v4_multiple.json")),
      "BFCL_v4_irrelevance.json": await fileHash(join(DATA, "BFCL_v4_irrelevance.json")),
    },
    model: MODEL,
    cells: cells.map(({ id, case: c, repeat }) => ({ id, case: c.id, file: c.file, repeat })),
  };
  if (!LIVE) {
    console.log(JSON.stringify({ ...plan, note: "Offline dry run: no files, network or model calls." }, null, 2));
    return;
  }

  if (!process.env.OPENROUTER_API_KEY) throw new Error("Set OPENROUTER_API_KEY for --run");
  await mkdir(join(outDir, ".."), { recursive: true });
  await mkdir(outDir);
  const save = (name: string, data: unknown) =>
    writeFile(join(outDir, name), JSON.stringify(data, null, 2) + "\n");
  await save("plan.json", plan);

  const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Model catalog: HTTP ${response.status}`);
  const { rates, contextWindow, requestTokens, requestCostUsd } =
    priceModel(await response.json(), MODEL, MAX_OUTPUT_TOKENS);
  await save("pricing.json", { model: MODEL, rates, contextWindow, requestTokens, requestCostUsd });

  const profileDir = join(outDir, "profile");
  await mkdir(profileDir);
  await writeFile(join(profileDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: TIMEOUT_MS } } }));
  await writeFile(join(profileDir, "models.json"), JSON.stringify({ providers: { openrouter: {
    baseUrl: "https://openrouter.ai/api/v1", api: "openai-completions", apiKey: "OPENROUTER_API_KEY",
    models: [{ id: MODEL, contextWindow, maxTokens: MAX_OUTPUT_TOKENS, reasoning: true, input: ["text"], cost: {
      input: rates.input * 1e6, output: rates.output * 1e6, cacheRead: rates.cacheRead * 1e6, cacheWrite: rates.cacheWrite * 1e6,
    } }],
  } } }));

  const results: Record<string, unknown>[] = [];
  const persist = async () => save("results.json", { protocol: plan.protocol, model: MODEL, spentLedger, cells: results });
  let spentLedger = 0;
  for (const cell of cells) {
    const budget: Budget = { maxRequests: MAX_REQUESTS, maxTokens: MAX_CELL_TOKENS, maxCostUsd: maxCostUsd! - spentLedger, requestTokens, requestCostUsd };
    const skip = reserve(budget, 0);
    if (skip) {
      results.push({ ...cell, case: cell.case.id, status: "not_run", reason: skip });
      await persist();
      continue;
    }
    const cwd = join(outDir, cell.id);
    await mkdir(cwd, { recursive: true });
    const tools = cell.case.functions.map(normalizeFunction);
    await writeFile(join(cwd, "tools.json"), JSON.stringify(tools, null, 2));
    await writeFile(join(cwd, "calls.jsonl"), "");
    await writeFile(join(cwd, "strata.json"), JSON.stringify({
      id: "bfcl",
      command: process.execPath,
      args: [join(root, "examples/bfcl/server.ts"), "--tools", join(cwd, "tools.json"), "--record", join(cwd, "calls.jsonl")],
      allow: tools.map((t) => t.name),
    }));
    const guard: GuardConfig = { budget, model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS,
      requestsPath: join(cwd, "requests.jsonl"), stopPath: join(cwd, "stop.json"), promptPath: join(cwd, "effective-prompt.json") };
    await writeFile(join(cwd, "guard.json"), JSON.stringify(guard));
    const prompt =
      `Answer by calling tools. Use ONLY typed_program with \`import { api } from '@cap/bfcl'\`. ` +
      `Direct file and shell tools are disabled; do not attempt them.\n\nQuestion: ${cell.case.question}\n\n` +
      `Call exactly the functions needed to answer (usually one call). If none of the available functions fits the question, ` +
      `call nothing and say so briefly. Then reply with one short sentence describing what you did.`;
    await writeFile(join(cwd, "prompt.txt"), prompt);
    const cliArgs = [
      process.execPath,
      join(root, "node_modules/@mariozechner/pi-coding-agent/dist/cli.js"),
      "--provider", "openrouter", "--model", MODEL, "--thinking", "medium",
      "--no-session", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files",
      "--mode", "json",
      "-e", join(root, "src/pi/extension.ts"),
      "-e", join(root, "examples/benchmark/guard.ts"),
      "-p", prompt,
    ];
    const { STRATA_CONFIG: _strata, STRATA_BENCHMARK_GUARD: _guard, ...env } = process.env;
    const processResult = await capture(cliArgs, { cwd,
      env: { ...env, PI_CODING_AGENT_DIR: profileDir, STRATA_CONFIG: join(cwd, "strata.json"),
        STRATA_STRICT: "1", STRATA_BENCHMARK_GUARD: join(cwd, "guard.json") },
      timeoutMs: TIMEOUT_MS, stdoutPath: join(cwd, "stdout.jsonl"), stderrPath: join(cwd, "stderr.txt") });
    let requests = 0;
    try {
      const receipts = (await readFile(join(cwd, "requests.jsonl"), "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
      requests = receipts.length;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    // Dual ledger (same discipline as repo-pilot): deduct reported actuals,
    // fall back to the worst-case reservation only when usage is missing.
    let usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
    try {
      const stdout = (await readFile(join(cwd, "stdout.jsonl"), "utf8")).split("\n").filter(Boolean);
      let inTok = 0;
      let outTok = 0;
      let cacheR = 0;
      let cacheW = 0;
      let totalTok = 0;
      let costSum = 0;
      let complete = stdout.length > 0;
      for (const line of stdout) {
        let event: unknown;
        try { event = JSON.parse(line); } catch { continue; }
        if (!record(event) || event.type !== "message_end") continue;
        const message = record(event.message) ? event.message as Record<string, unknown> : null;
        const u = message && record(message.usage) ? message.usage as Record<string, unknown> : null;
        if (!u || typeof u.input !== "number" || typeof u.output !== "number") { complete = false; continue; }
        inTok += u.input as number;
        outTok += u.output as number;
        cacheR += typeof u.cacheRead === "number" ? u.cacheRead as number : 0;
        cacheW += typeof u.cacheWrite === "number" ? u.cacheWrite as number : 0;
        totalTok += typeof u.totalTokens === "number" ? u.totalTokens as number : 0;
        const costTotal = record(u.cost) ? (u.cost as Record<string, unknown>).total : null;
        if (typeof costTotal !== "number") { complete = false; continue; }
        costSum += costTotal;
      }
      usage = complete
        ? { input: inTok, output: outTok, cacheRead: cacheR, cacheWrite: cacheW, totalTokens: totalTok, cost: costSum }
        : { input: inTok, output: outTok, cacheRead: cacheR, cacheWrite: cacheW, totalTokens: totalTok, cost: null };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: null };
    }
    const charge = cellCharge(usage, requests, requestCostUsd, rates.request);
    spentLedger += charge.charged;

    const recorded: RecordedCall[] = (await readFile(join(cwd, "calls.jsonl"), "utf8"))
      .split("\n").filter(Boolean).map((line) => JSON.parse(line) as RecordedCall);
    const truth = cell.case.file === "BFCL_v4_irrelevance.json"
      ? null
      : groundTruth.get(cell.case.file)!.get(cell.case.id) ?? null;
    if (truth === null && cell.case.file !== "BFCL_v4_irrelevance.json")
      throw new Error(`Missing ground truth for ${cell.case.id}`);
    const verdict = gradeCase(recorded, truth);
    const termination = processResult.exitCode === 78 ? "guard" as const : processResult.termination;
    const healthy = processResult.exitCode === 0 && termination !== "timeout";
    results.push({ ...cell, case: cell.case.id, status: "attempted",
      termination, guardStop: termination === "guard", healthy,
      requests, usage, charge, recordedCalls: recorded.length, ...verdict });
    await save(`${cell.id}.json`, results[results.length - 1]);
    await persist();
    console.log(`${cell.id}: pass=${verdict.pass} calls=${recorded.length} (${verdict.reason.slice(0, 100)})`);
  }
  const bad = results.filter((r) => (r as Record<string, unknown>).status !== "attempted" || !(r as Record<string, unknown>).healthy);
  if (bad.length > 0) process.exitCode = 1;
  const passed = results.filter((r) => (r as Record<string, unknown>).pass).length;
  console.log(`Verdict: ${passed}/${results.length} graded pass (incorrect answers are data; see results.json)`);
}

await main();
