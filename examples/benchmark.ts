// Protocol v2 CLI. Default is an offline dry run. See docs/benchmark.md.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { options, matrix, reserve, type Budget } from "./benchmark/config.ts";
import { artifactVersion, assessTrace, definitions, promptFor, protocol, record } from "./benchmark/protocol.ts";
import { capture } from "./benchmark/process.ts";
import type { GuardConfig } from "./benchmark/guard.ts";
import { cliTwinSession } from "./cli-twin.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = options(process.argv.slice(2));
const cells = matrix(config);
const plan = { protocol, artifactVersion, config, cells, sessionMode: "cold", retries: 0, fallbacks: false };
if (!config.run) {
  console.log(JSON.stringify({ ...plan, note: "Offline dry run: no files, network or model calls. Live mode requires --run and --max-cost-usd. Pricing/reservations resolve from the provider catalog only in live mode." }, null, 2));
} else {
  await run();
}

async function run() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Set OPENROUTER_API_KEY for --run");
  if (process.platform === "win32") throw new Error("Benchmark process supervision currently requires POSIX");
  // Never overwrite a pilot or merge a second run into an existing artifact directory.
  await mkdir(join(config.out, ".."), { recursive: true });
  await mkdir(config.out);
  const save = (name: string, data: unknown) => writeFile(join(config.out, name), JSON.stringify(data, null, 2) + "\n");
  await save("plan.json", plan);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Model catalog: HTTP ${response.status}`);
    const catalog: unknown = await response.json();
    if (!record(catalog) || !Array.isArray(catalog.data)) throw new Error("Invalid model catalog");
    const model = catalog.data.find((m: unknown) => record(m) && m.id === config.model);
    if (!record(model) || !record(model.pricing)) throw new Error(`Requested model not available: ${config.model}`);
    const price = (name: string, fallback?: number) => {
      const raw = model.pricing as Record<string, unknown>;
      if (raw[name] === undefined && fallback !== undefined) return fallback;
      if (typeof raw[name] !== "string" || !raw[name].trim()) throw new Error(`Missing price: ${name}`);
      const n = Number(raw[name]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid price: ${name}`);
      return n;
    };
    const rates = { input: price("prompt"), output: price("completion"), cacheRead: price("input_cache_read", 0), cacheWrite: price("input_cache_write", 0), request: price("request", 0) };
    const contextWindow = model.context_length;
    if (typeof contextWindow !== "number" || !Number.isSafeInteger(contextWindow) || contextWindow <= 0) throw new Error("Invalid model context limit");
    // Deliberately over-reserve: full context at the highest input tariff plus capped output.
    const requestTokens = contextWindow + config.maxOutputTokens;
    const requestCostUsd = contextWindow * Math.max(rates.input, rates.cacheRead, rates.cacheWrite) + config.maxOutputTokens * rates.output + rates.request;
    if (!Number.isFinite(requestCostUsd)) throw new Error("Unrepresentable request reservation");
    await save("pricing.json", { fetchedAt: new Date().toISOString(), source: "https://openrouter.ai/api/v1/models", model, rates, requestTokens, requestCostUsd });
    const git = async (args: string[]) => {
      const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if (code !== 0) throw new Error(`git metadata failed: ${stderr}`);
      return stdout.trim();
    };
    // Snapshot runnable sources, fixtures and dependency pins; no private profiles or environment.
    const hashes: Record<string, string> = {};
    for (const pattern of ["src/**/*.ts", "examples/**/*.ts", "catalog/**/*.ts", "test/fixture-*/**/*.ts", "package.json", "bun.lock", "tsconfig.json"]) {
      for await (const path of new Bun.Glob(pattern).scan({ cwd: root })) {
        const bytes = await readFile(join(root, path));
        hashes[path] = createHash("sha256").update(bytes).digest("hex");
        const destination = join(config.out, "sources", path);
        await mkdir(join(destination, ".."), { recursive: true });
        await writeFile(destination, bytes);
      }
    }
    await save("manifest.json", { ...plan, gitCommit: await git(["rev-parse", "HEAD"]), gitStatus: await git(["status", "--porcelain"]), bunVersion: Bun.version, platform: process.platform, arch: process.arch, sourceHashes: hashes, tasks: definitions });
    const twin = await cliTwinSession();
    const declarations = twin.session.declarations;
    await twin.session.close();
    await writeFile(join(config.out, "declarations.d.ts"), declarations);
    const profile = join(config.out, "profile");
    await mkdir(profile);
    await writeFile(join(profile, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: config.timeoutMs } } }));
    await writeFile(join(profile, "models.json"), JSON.stringify({ providers: { openrouter: {
      baseUrl: "https://openrouter.ai/api/v1", api: "openai-completions", apiKey: "OPENROUTER_API_KEY",
      models: [{ id: config.model, contextWindow, maxTokens: config.maxOutputTokens, reasoning: true, input: ["text"], cost: {
        input: rates.input * 1e6, output: rates.output * 1e6, cacheRead: rates.cacheRead * 1e6, cacheWrite: rates.cacheWrite * 1e6,
      } }],
    } } }));
    const twinConfig = join(config.out, "twin.json");
    await writeFile(twinConfig, JSON.stringify({ transport: "cli-twin", allow: ["customers", "invoices", "records"] }));
    let reservedCostUsd = 0;
    const results: Record<string, unknown>[] = [];
    const persist = async () => save("results.json", { protocol, artifactVersion, model: config.model, reservedCostUsd, cells: results });
    for (const cell of cells) {
      const budget: Budget = { maxRequests: config.maxRequests, maxTokens: config.maxCellTokens, maxCostUsd: config.maxCostUsd! - reservedCostUsd, requestTokens, requestCostUsd };
      const reason = reserve(budget, 0);
      if (reason) {
        results.push({ ...cell, status: "not_run", reason });
        await persist();
        continue;
      }
      const cwd = join(config.out, cell.id);
      await mkdir(cwd);
      const guard: GuardConfig = { budget, model: config.model, maxOutputTokens: config.maxOutputTokens,
        requestsPath: `${cwd}.requests.jsonl`, stopPath: `${cwd}.stop.json`, promptPath: `${cwd}.effective-prompt.json` };
      const guardPath = `${cwd}.guard.json`;
      await writeFile(guardPath, JSON.stringify(guard));
      const prompt = promptFor(cell.task, cell.condition, join(root, "test/fixture-cli/cli.ts"));
      await writeFile(`${cwd}.prompt.txt`, prompt);
      const args = [process.execPath, join(root, "node_modules/@mariozechner/pi-coding-agent/dist/cli.js"),
        "--provider", "openrouter", "--model", config.model, "--thinking", config.thinking,
        "--no-session", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files", "--mode", "json",
        ...(cell.condition === "A" ? [] : ["-e", join(root, "src/pi/extension.ts")]),
        "-e", join(root, "examples/benchmark/guard.ts"), "-p", prompt];
      const { STRATA_CONFIG: _strata, STRATA_BENCHMARK_GUARD: _guard, ...env } = process.env;
      const processResult = await capture(args, { cwd, env: { ...env, PI_CODING_AGENT_DIR: profile,
        STRATA_BENCHMARK_GUARD: guardPath, ...(cell.condition === "A" ? {} : { STRATA_CONFIG: twinConfig }) },
        timeoutMs: config.timeoutMs, stdoutPath: `${cwd}.jsonl`, stderrPath: `${cwd}.stderr` });
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
      const assessment = assessTrace({ ...cell, model: config.model, stdout: processResult.stdout,
        exitCode: processResult.exitCode, termination });
      const unreserved = assessment.modelResponses > requests;
      if (unreserved) {
        assessment.harness.healthy = false;
        assessment.harness.errors.push("Assistant response without a request reservation");
        assessment.success = false;
      }
      const result = { ...cell, status: "attempted", model: config.model, attempt: 1, ...assessment,
        execution: { exitCode: processResult.exitCode, termination, guardStop, ms: processResult.ms },
        estimatedCostUsd: assessment.usage.cost === null ? null : assessment.usage.cost + requests * rates.request,
        reservation: { requests, tokens: requests * requestTokens, costUsd: requests * requestCostUsd },
        promptBytes: Buffer.byteLength(prompt), declarationBytes: cell.condition === "A" ? 0 : Buffer.byteLength(declarations) };
      results.push(result);
      await save(`${cell.id}.json`, result);
      await persist();
      console.log(`${cell.id}: success=${assessment.success} healthy=${assessment.harness.healthy} usageComplete=${assessment.accounting.complete}`);
      if (unreserved) throw new Error("Stopping run: guard request accounting failed");
    }
    // Incorrect answers are data; incomplete execution/accounting/adherence invalidates a comparison run.
    if (results.some((r) => r.status !== "attempted" || !record(r.harness) || !r.harness.healthy || !record(r.accounting) || !r.accounting.complete || !record(r.policy) || !r.policy.compliant)) process.exitCode = 1;
    console.log(`Results: ${join(config.out, "results.json")}`);
  } catch (error) {
    await save("failure.json", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
