/** Issue 049 extension for the installed Pi 0.99.1, with isolated fixtures. */
import { readFileSync, writeFileSync } from "node:fs";
import { Type } from "@sinclair/typebox";
import { toTypeBox } from "../../src/pi/direct-tools.ts";
import { makeWorld, manifest } from "./fixture.ts";
import { makeRuntime, metrics, policies, type Policy } from "./runtime.ts";

export default function (pi: any) {
  const config = JSON.parse(readFileSync(process.env.STRATA_CHECKING_CONFIG!, "utf8"));
  const world = makeWorld(config.variant ?? 0);
  const profile: string = config.profile;
  const policy: Policy = profile === "native" ? "never" : profile as Policy;
  if (profile !== "native" && !policies.includes(policy)) throw new Error("Unknown policy");
  let runtime: Awaited<ReturnType<typeof makeRuntime>>;
  const runs: unknown[] = [], nativeCalls: unknown[] = [];
  let seed: unknown;
  let requests = 0;
  const persist = () => writeFileSync(config.statePath, JSON.stringify({ payments: world.payments,
    invocations: world.invocations, runs, nativeCalls, seed, requests }, null, 2));
  const unavailable = () => { if (!runtime) throw new Error("Experiment runtime unavailable"); };
  pi.on("session_start", async () => {
    runtime = await makeRuntime(world, policy);
    if (config.seed) { seed = await runtime.run(config.seed); runs.push({ seed: true, ...seed as object }); }
    persist();
    if (profile === "native") pi.setActiveTools(["codemode"]);
    else pi.setActiveTools(["typed_program"]);
  });
  pi.on("session_shutdown", async () => { persist(); runtime?.close(); });
  pi.on("before_agent_start", (event: any) => {
    unavailable();
    const instructions = profile === "native" ? "Use codemode to compose the pilot tools and return structured JSON. No classifier or other model calls are permitted." :
      "typed_program accepts a complete TypeScript module: import {api} from '@c/pilot'; export async function main() { ... }. Pure computation and capability imports only. Return JSON. All calls are schema-validated and locally authorized. Errors may include diagnostics. Earlier writes survive a failure; inspect existing payments before retrying. Use only this tool.\n" + runtime.declarations;
    const prior = seed ? "\nPrior source:\n" + config.seed + "\nPrior observed execution:\n" + JSON.stringify({ ...seed as object, metrics: undefined }) : "";
    writeFileSync(config.promptPath, JSON.stringify({ systemPrompt: event.systemPrompt + "\n" + instructions, prompt: event.prompt, prior }));
    return { systemPrompt: event.systemPrompt + "\n" + instructions + prior };
  });
  pi.on("before_provider_request", (event: any, ctx: any) => {
    if (ctx.model?.provider !== "openrouter" || ctx.model?.id !== config.model || requests >= config.maxRequests) {
      writeFileSync(config.stopPath, "model/request guard"); process.exit(78);
    }
    const payload = { ...event.payload };
    if ("max_tokens" in payload) payload.max_tokens = 4096;
    else payload.max_completion_tokens = 4096;
    if ("max_tokens" in payload && "max_completion_tokens" in payload) delete payload.max_completion_tokens;
    requests++; persist();
    return payload;
  });
  pi.on("tool_call", (event: any) => {
    if (event.toolName === "codemode" && /\bmodels\b/.test(event.input?.code ?? ""))
      return { block: true, reason: "Nested model calls are outside this experiment" };
    const permitted = profile === "native" ? ["codemode", ...manifest.operations.map(o => o.name)] : ["typed_program"];
    if (!permitted.includes(event.toolName)) return { block: true, reason: "Tool outside experiment" };
  });
  if (profile === "native") {
    for (const op of manifest.operations) pi.registerTool({
      name: op.name, label: op.name, description: op.description,
      exposure: "codemode", namespace: { name: "pilot", description: manifest.description },
      parameters: toTypeBox(op.inputSchema), outputSchema: toTypeBox(op.outputSchema!),
      async execute(_id: string, input: Record<string, unknown>, signal?: AbortSignal) {
        unavailable();
        const m = metrics(`native:${nativeCalls.length + 1}`);
        try {
          const result = await runtime.broker.invoke("pilot", op.name, input, signal ?? new AbortController().signal, m);
          nativeCalls.push(m); persist();
          return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, details: { metrics: m } };
        } catch (e) { nativeCalls.push(m); persist(); throw e; }
      },
    });
  } else pi.registerTool({
    name: "typed_program", label: "Typed program",
    description: "Run a complete TypeScript module exporting main() to compose pilot API calls. Returns structured results or execution/diagnostic feedback. Earlier writes survive errors. Fresh QuickJS execution state.",
    parameters: Type.Object({ source: Type.String({ maxLength: 32768 }) }),
    async execute(_id: string, input: { source: string }, signal?: AbortSignal) {
      unavailable();
      const report = await runtime.run(input.source, signal);
      runs.push(report); persist();
      if (report.error) throw new Error(report.text);
      return { content: [{ type: "text", text: report.text }], details: { metrics: report.metrics } };
    },
  });
}
