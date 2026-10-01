/** Model-free publication of sanitized per-cell metrics from completed pilots. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const folders = process.argv.slice(2);
if (!folders.length) throw new Error("Pass completed pilot artifact directories; no model calls are made");
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position), upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
};
const campaigns = [];
for (const folder of folders) {
  const out = resolve(folder);
  const matrix = JSON.parse(await readFile(join(out, "matrix.json"), "utf8"));
  const cells = JSON.parse(await readFile(join(out, "summary.json"), "utf8"));
  const safeCells = [];
  for (const c of cells) {
    // Only usage/health/grade fields are published. No programs, answers or state.
    const events = (await readFile(join(out, c.id, "events.jsonl"), "utf8"))
      .split("\n").filter(Boolean).map(line => JSON.parse(line));
    const usage = events.filter(e => e.type === "message_end" && e.message?.role === "assistant")
      .map(e => e.message.usage);
    const total = (field: string) => usage.every(u => Number.isFinite(u?.[field]))
      ? usage.reduce((sum, u) => sum + u[field], 0) : null;
    const input = total("input"), output = total("output");
    const cacheRead = total("cacheRead"), cacheWrite = total("cacheWrite");
    safeCells.push({ id: c.id, task: c.task, profile: c.profile, repeat: c.repeat,
      strictSuccess: c.success, answerCorrect: c.answerCorrect, effectsCorrect: c.effectsCorrect,
      healthy: c.healthy, requests: c.requests, inputTokens: input, outputTokens: output,
      cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, reasoningTokens: total("reasoning"),
      reportedTokens: [input, output, cacheRead, cacheWrite].every(v => v !== null)
        ? input! + output! + cacheRead! + cacheWrite! : null,
      costUsd: c.costUsd, wallSeconds: c.ms / 1000,
      sourceProcessingMs: c.compileMs, capabilityCalls: c.capabilityCalls });
  }
  const groups = [];
  for (const family of ["natural", "repair-partial", "repair-silent"]) {
    for (const profile of ["native", "always", "never", "after-failure"]) {
      const selected = safeCells.filter(c => c.profile === profile && (family === "natural"
        ? ["aggregate", "reconcile"].includes(c.task) : c.task === family));
      if (!selected.length) continue;
      const sum = (field: keyof typeof selected[number]) => selected.every(c => typeof c[field] === "number")
        ? selected.reduce((n, c) => n + (c[field] as number), 0) : null;
      const mean = (field: keyof typeof selected[number]) => { const n = sum(field); return n === null ? null : n / selected.length; };
      const successes = selected.filter(c => c.strictSuccess).length;
      const cost = sum("costUsd");
      groups.push({ family, profile, attempts: selected.length,
        uniqueTaskDefinitions: new Set(selected.map(c => c.task)).size,
        strictSuccesses: successes, correctAnswers: selected.filter(c => c.answerCorrect).length,
        correctEffects: selected.filter(c => c.effectsCorrect).length,
        requestsTotal: sum("requests"), requestsMean: mean("requests"),
        reportedTokensMean: mean("reportedTokens"), inputTokensMean: mean("inputTokens"),
        cacheReadTokensMean: mean("cacheReadTokens"), cacheWriteTokensMean: mean("cacheWriteTokens"),
        outputTokensMean: mean("outputTokens"), reasoningTokensMean: mean("reasoningTokens"),
        costUsdTotal: cost, costUsdMean: mean("costUsd"),
        costUsdPerStrictSuccess: cost !== null && successes > 0 ? cost / successes : null,
        medianWallSeconds: percentile(selected.map(c => c.wallSeconds), 0.5),
        p90WallSeconds: percentile(selected.map(c => c.wallSeconds), 0.9),
        sourceProcessingMsTotal: sum("sourceProcessingMs"), capabilityCallsTotal: sum("capabilityCalls") });
    }
  }
  campaigns.push({ version: matrix.version, model: matrix.model, thinking: matrix.thinking,
    piVersion: matrix.piVersion, bunVersion: matrix.bun, rates: matrix.rates,
    attempts: cells.length, strictSuccesses: cells.filter((c: any) => c.success).length,
    costUsd: cells.reduce((n: number, c: any) => n + c.costUsd, 0), groups, cells: safeCells });
}
const result = { schemaVersion: 1, description: "049/051 development pilots; usage-based costs, all attempted cells included",
  tokenDefinition: "Input + cached reads + cached writes + output as reported by Pi; reasoning is not added again",
  turnDefinition: "Model/provider requests, not capability invocations",
  timeDefinition: "Per-cell elapsed process wall time; percentiles use linear interpolation; no aggregate inferential claim",
  campaigns };
const path = resolve("docs/evaluations/checking-policy-2026-10-01.json");
await writeFile(path, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ path, campaigns: campaigns.length, cells: campaigns.reduce((n, c) => n + c.attempts, 0) }));
