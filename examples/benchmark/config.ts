import { resolve } from "node:path";
import { conditions, tasks, type Condition, type Task } from "./protocol.ts";

export interface Options {
  run: boolean; out: string; model: string; thinking: string;
  cells: string[]; repeats: number; timeoutMs: number;
  maxRequests: number; maxOutputTokens: number; maxCellTokens: number;
  maxCostUsd: number | null;
}
export function options(args: string[], cwd = process.cwd()): Options {
  const flags = new Map<string, string>();
  let run = false, dry = false;
  const names = ["out", "model", "thinking", "cells", "repeats", "timeout-ms", "max-requests", "max-output-tokens", "max-cell-tokens", "max-cost-usd"];
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (key === "--run" || key === "--dry-run") {
      if (key === "--run") { if (run) throw new Error("Duplicate --run"); run = true; }
      else { if (dry) throw new Error("Duplicate --dry-run"); dry = true; }
      continue;
    }
    if (!names.includes(key.slice(2)) || !key.startsWith("--")) throw new Error(`Unknown option ${key}`);
    if (flags.has(key)) throw new Error(`Duplicate ${key}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    flags.set(key, value);
  }
  if (run && dry) throw new Error("Choose --run or --dry-run");
  const positive = (key: string, fallback: number, max: number) => {
    const value = Number(flags.get(key) ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0 || value > max) throw new Error(`${key} must be an integer in 1..${max}`);
    return value;
  };
  const cost = flags.has("--max-cost-usd") ? Number(flags.get("--max-cost-usd")) : null;
  if (cost !== null && (!Number.isFinite(cost) || cost <= 0 || cost > 1000)) throw new Error("--max-cost-usd must be in (0, 1000]");
  if (run && cost === null) throw new Error("Live runs require explicit --max-cost-usd");
  const cells = flags.has("--cells") ? flags.get("--cells")!.split(",") : tasks.flatMap((t) => conditions.map((c) => `${t}:${c}`));
  const valid = new Set(tasks.flatMap((t) => conditions.map((c) => `${t}:${c}`)));
  if (!cells.length || cells.some((c) => !valid.has(c)) || new Set(cells).size !== cells.length) throw new Error("--cells requires unique T1:A..T4:C pairs");
  const model = flags.get("--model") ?? "meta/muse-spark-1.3-contributor";
  if (!/^[\w./:-]+$/.test(model)) throw new Error("Invalid model ID");
  const thinking = flags.get("--thinking") ?? "medium";
  if (!["off", "minimal", "low", "medium", "high", "xhigh"].includes(thinking)) throw new Error("Invalid thinking level");
  return {
    run, out: resolve(cwd, flags.get("--out") ?? `.work/benchmark/v2-${new Date().toISOString().replace(/[:.]/g, "-")}`),
    model, thinking, cells,
    repeats: positive("--repeats", 1, 100), timeoutMs: positive("--timeout-ms", 150000, 600000),
    maxRequests: positive("--max-requests", 8, 100), maxOutputTokens: positive("--max-output-tokens", 4096, 32768),
    maxCellTokens: positive("--max-cell-tokens", 2_000_000, 100_000_000), maxCostUsd: cost,
  };
}

/** Rotating the starting condition counterbalances complete triples over three repeats. */
export function matrix(config: Pick<Options, "cells" | "repeats">) {
  const cells: { id: string; task: Task; condition: Condition; repeat: number }[] = [];
  for (let repeat = 0; repeat < config.repeats; repeat++) {
    for (const [taskIndex, task] of tasks.entries()) {
      for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[(i + taskIndex + repeat) % conditions.length]!;
        if (config.cells.includes(`${task}:${condition}`)) cells.push({ id: `${task}-${condition}-r${repeat + 1}`, task, condition, repeat: repeat + 1 });
      }
    }
  }
  return cells;
}

export interface Budget {
  maxRequests: number; maxTokens: number; maxCostUsd: number;
  requestTokens: number; requestCostUsd: number;
}
/** Reservations never get refunded based on missing or underreported provider usage. */
export function reserve(budget: Budget, requests: number) {
  const next = requests + 1;
  if (next > budget.maxRequests) return "request limit";
  if (next * budget.requestTokens > budget.maxTokens) return "token reservation limit";
  if (next * budget.requestCostUsd > budget.maxCostUsd) return "cost reservation limit";
  return null;
}
