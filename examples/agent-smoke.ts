import { isDeepStrictEqual } from "node:util";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Opt-in live check: only deterministic fixture data is requested from the model.
const root = fileURLToPath(new URL("../", import.meta.url));
const profile = root + ".work/smoke-profile";
const cwd = root + ".work/smoke-workspace";
await mkdir(profile, { recursive: true });
await mkdir(cwd, { recursive: true });
if (!process.env.OPENROUTER_API_KEY)
  throw new Error("Set OPENROUTER_API_KEY before running this opt-in test");
const ids = [
  "meta/muse-spark-1.3-contributor",
  "z-ai/glm-5.3-flash",
  "deepseek/deepseek-v4-flash-0731",
];
const response = await fetch("https://openrouter.ai/api/v1/models", {
  signal: AbortSignal.timeout(15000),
});
if (!response.ok)
  throw new Error(`OpenRouter catalog: HTTP ${response.status}`);
const catalog = (await response.json()) as {
  data: {
    id: string;
    context_length: number;
    pricing: { prompt: string; completion: string; input_cache_read?: string };
    supported_parameters?: string[];
  }[];
};
const models = ids.flatMap((id) => {
  const model = catalog.data.find((m) => m.id === id);
  return model
    ? [
        {
          id,
          contextWindow: model.context_length,
          maxTokens: 4096,
          reasoning: false,
          input: ["text"],
          cost: {
            input: Number(model.pricing.prompt) * 1e6,
            output: Number(model.pricing.completion) * 1e6,
            cacheRead: Number(model.pricing.input_cache_read ?? 0) * 1e6,
            cacheWrite: 0,
          },
        },
      ]
    : [];
});
await Bun.write(
  profile + "/models.json",
  JSON.stringify(
    {
      providers: {
        openrouter: {
          baseUrl: "https://openrouter.ai/api/v1",
          api: "openai-completions",
          apiKey: "OPENROUTER_API_KEY",
          models,
        },
      },
    },
    null,
    2,
  ),
);
const prompt = `Test typed_program using only its fixture API. First intentionally call customers with county instead of country and verify the compiler rejects it. Then use one valid typed_program call to: fetch DE customers, fetch their invoices, fetch 10000 records, and return exactly {customerIds: customers.map(c=>c.id), invoiceIds: invoices.map(i=>i.id), recordIds: records.filter(r=>r.score>0.98).slice(0,3).map(r=>r.id)} (adapt variable names to the actual structured response). Do not use bash/read/edit/write or any other tool. Report the observed results and rawCapabilityBytes versus bytesExposedToPi. Stop after those checks.`;
for (const model of models) {
  console.log(`Testing openrouter/${model.id}`);
  const child = Bun.spawn(
    [
      process.execPath,
      root + "node_modules/@mariozechner/pi-coding-agent/dist/cli.js",
      "--provider",
      "openrouter",
      "--model",
      model.id,
      "--thinking",
      "off",
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-prompt-templates",
      "--no-context-files",
      "--mode",
      "json",
      "-e",
      root + "src/pi/extension.ts",
      "-p",
      prompt,
    ],
    {
      cwd,
      env: { ...process.env, PI_CODING_AGENT_DIR: profile, STRATA_CONFIG: "" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const timer = setTimeout(() => child.kill(), 120000);
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  clearTimeout(timer);
  const events = stdout.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  await Bun.write(root + ".work/agent-smoke.jsonl", stdout);
  await Bun.write(root + ".work/agent-smoke.stderr", stderr);
  const reports = events
    .filter(
      (e) => e.type === "tool_execution_end" && e.toolName === "typed_program",
    )
    .flatMap((e) =>
      (e.result?.content ?? []).flatMap(
        (c: { type: string; text?: string }) => {
          try {
            return [JSON.parse(c.text ?? "")];
          } catch {
            return [];
          }
        },
      ),
    );
  const rejection = reports.find(
    (r) => r.metrics?.diagnostics?.length && r.metrics.capabilityCalls === 0,
  );
  const success = reports.find((r) =>
    isDeepStrictEqual(r.result, {
      customerIds: ["c1"],
      invoiceIds: ["i0"],
      recordIds: [99, 199, 299],
    }),
  );
  const unexpectedTools = events
    .filter(
      (e) => e.type === "tool_execution_end" && e.toolName !== "typed_program",
    )
    .map((e) => e.toolName);
  const usage = events
    .filter((e) => e.type === "message_end" && e.message?.role === "assistant")
    .map((e) => e.message.usage);
  const summary = {
    model: model.id,
    exitCode: code,
    compileRejection: Boolean(rejection),
    composition: Boolean(success),
    unexpectedTools,
    metrics: success?.metrics,
    usage,
  };
  console.log(JSON.stringify(summary, null, 2));
  await Bun.write(
    root + ".work/agent-smoke-summary.json",
    JSON.stringify(summary, null, 2),
  );
  if (code === 0 && rejection && success && unexpectedTools.length === 0)
    process.exit(0);
  console.log(
    "Smoke check did not pass; trying the next configured fallback. Transcript: .work/agent-smoke.jsonl",
  );
}
throw new Error("No requested OpenRouter model passed the smoke check");
