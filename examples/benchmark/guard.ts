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
  const file = process.env.STRATA_BENCHMARK_GUARD;
  if (!file) throw new Error("Missing benchmark guard configuration");
  const config = JSON.parse(readFileSync(file, "utf8")) as GuardConfig;
  let requests = 0;
  const stop = (reason: string): never => {
    writeFileSync(config.stopPath, JSON.stringify({ reason, requests }));
    // Extension-hook exceptions are swallowed by Pi. Exit before provider dispatch instead.
    process.exit(78);
  };
  pi.on("before_agent_start", (event) => {
    writeFileSync(config.promptPath, JSON.stringify({ systemPrompt: event.systemPrompt, prompt: event.prompt }, null, 2));
  });
  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "openrouter" || ctx.model.id !== config.model) stop("model changed");
    if (!record(event.payload)) stop("invalid provider payload");
    const reason = reserve(config.budget, requests);
    if (reason) stop(reason);
    const payload = { ...event.payload };
    if ("max_tokens" in payload) payload.max_tokens = config.maxOutputTokens;
    else payload.max_completion_tokens = config.maxOutputTokens;
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) stop("request payload byte limit");
    // Persist the exact payload and reservation BEFORE allowing the HTTP request.
    appendFileSync(config.requestsPath, JSON.stringify({ request: ++requests, reservedTokens: config.budget.requestTokens,
      reservedCostUsd: config.budget.requestCostUsd, payload }) + "\n");
    return payload;
  });
}
