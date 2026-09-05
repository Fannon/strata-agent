// Benchmark-only extension; installed identically in A/B/C. No user-facing tools.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { reserve, type Budget } from "./config.ts";
import { record } from "./protocol.ts";

export interface GuardConfig {
  budget: Budget; model: string; maxOutputTokens: number;
  requestsPath: string; stopPath: string; promptPath: string;
}

export default function (pi: ExtensionAPI) {
  let config: GuardConfig;
  let requests = 0;
  const stop = (reason: string): never => {
    try {
      if (config?.stopPath) writeFileSync(config.stopPath, JSON.stringify({ reason, requests }));
    } finally {
      // Pi swallows extension-hook exceptions. Exit before provider dispatch, even on I/O failure.
      console.error(`Benchmark guard stopped: ${reason}`);
      process.exit(78);
    }
  };
  try {
    const file = process.env.STRATA_BENCHMARK_GUARD;
    if (!file) stop("missing guard configuration");
    const parsed: unknown = JSON.parse(readFileSync(file!, "utf8"));
    if (!record(parsed) || !record(parsed.budget)) stop("invalid guard configuration");
    config = parsed as unknown as GuardConfig;
    for (const key of ["maxRequests", "maxTokens", "requestTokens"] as const) {
      if (!Number.isSafeInteger(config.budget[key]) || config.budget[key] <= 0) stop("invalid token/request limits");
    }
    for (const key of ["maxCostUsd", "requestCostUsd"] as const) {
      if (!Number.isFinite(config.budget[key]) || config.budget[key] < 0) stop("invalid cost limits");
    }
    if (!Number.isSafeInteger(config.maxOutputTokens) || config.maxOutputTokens <= 0 ||
        [config.model, config.requestsPath, config.stopPath, config.promptPath].some((s) => typeof s !== "string" || !s)) stop("invalid guard fields");
  } catch { stop("guard initialization failed"); }
  pi.on("before_agent_start", (event) => {
    try { writeFileSync(config.promptPath, JSON.stringify({ systemPrompt: event.systemPrompt, prompt: event.prompt }, null, 2)); }
    catch { stop("cannot persist effective prompt"); }
  });
  pi.on("before_provider_request", (event, ctx) => {
    try {
      if (ctx.model?.provider !== "openrouter" || ctx.model.id !== config.model) stop("model changed");
      if (!record(event.payload)) stop("invalid provider payload");
      if (ctx.model!.contextWindow + config.maxOutputTokens !== config.budget.requestTokens) stop("context reservation mismatch");
      const reason = reserve(config.budget, requests);
      if (reason) stop(reason);
      const payload = { ...(event.payload as Record<string, unknown>) };
      if ("max_tokens" in payload && "max_completion_tokens" in payload) stop("ambiguous output limits");
      if ("max_tokens" in payload) payload.max_tokens = config.maxOutputTokens;
      else payload.max_completion_tokens = config.maxOutputTokens;
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) stop("request payload byte limit");
      appendFileSync(config.requestsPath, JSON.stringify({ request: ++requests, reservedTokens: config.budget.requestTokens,
        reservedCostUsd: config.budget.requestCostUsd, payload }) + "\n");
      return payload;
    } catch { stop("cannot persist request reservation"); }
  });
}
