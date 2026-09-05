// Paired benchmark: stock Pi + bash vs Pi + typed_program, on the CLI twin.
// See .work/issues/001-benchmark.md Protocol v1.
//
// Usage:
//   OPENROUTER_API_KEY=... bun examples/benchmark.ts [--cells T1:A,T2:C,...] \
//     [--timeout-ms 150000] [--out .work/benchmark/<timestamp>]
//
// Exit 0 when every requested cell ran (task pass/fail is data, not an error).
// Non-zero on harness errors. Raw transcripts stay in the out dir (gitignored).
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const cliJs = root + "node_modules/@mariozechner/pi-coding-agent/dist/cli.js";
const extension = root + "src/pi/extension.ts";
const twinCli = root + "test/fixture-cli/cli.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 || i + 1 >= process.argv.length
    ? fallback
    : process.argv[i + 1]!;
};
const timeoutMs = Number(arg("--timeout-ms", "150000"));
const outDir = resolve(
  arg("--out", "") || root + `.work/benchmark/${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const only = arg("--cells", "");
const selected = new Set(
  only ? only.split(",").map((s) => s.trim()).filter(Boolean) : [],
);

if (!process.env.OPENROUTER_API_KEY)
  throw new Error("Set OPENROUTER_API_KEY before running the benchmark");

type Condition = "A" | "B" | "C";
type TaskId = "T1" | "T2" | "T3" | "T4";

const MODELS = [
  "meta/muse-spark-1.3-contributor",
  "z-ai/glm-5.3-flash",
  "deepseek/deepseek-v4-flash-0731",
];

const TASKS: Record<
  TaskId,
  { goal: string; check: (h: Haystacks, c: Condition) => string | null }
> = {
  T1: {
    goal: 'How many customers are registered in country "DE"? Reply with exactly: {"count": N}. Stop when answered.',
    check: (h) =>
      /\bcount"?\s*:\s*1\b/.test(h.final) ? null : "expected count 1",
  },
  T2: {
    goal: 'List the IDs of invoices with amount over 10000 for DE customers. Reply with exactly: {"ids": [...]}. Stop when answered.',
    check: (h) =>
      h.final.includes("i0") && !h.final.includes("i1")
        ? null
        : "expected ids [i0]",
  },
  T3: {
    goal: 'From 10000 records, select the IDs with score above 0.98 and return the first five. Reply with exactly: {"total": N, "selected": [...]}. Stop when answered.',
    check: (h) =>
      h.final.includes("10000") &&
      ["99", "199", "299", "399", "499"].every((id) =>
        new RegExp(`\\b${id}\\b`).test(h.final),
      )
        ? null
        : "expected total 10000 and selected [99,199,299,399,499]",
  },
  T4: {
    goal: 'Try to list customers for country code "XX" (which does not exist). Report exactly what happened — the tool output or error text. Reply with exactly: {"outcome": "..."}. Stop when answered.',
    check: (h, c) =>
      c === "A"
        ? h.tools.includes("bad country")
          ? null
          : "expected CLI 'bad country' error in bash output"
        : h.typed.includes("compilation failed")
          ? null
          : "expected a compile rejection in a typed_program output",
  },
};

interface Haystacks {
  final: string;
  tools: string;
  typed: string;
}

function promptFor(task: TaskId, condition: Condition): string {
  const goal = TASKS[task]!.goal;
  if (condition === "A")
    return `You have the bash tool. Query this CLI with bun: bun ${twinCli} customers --country DE|US | bun ${twinCli} invoices --customer-ids c1,c2 | bun ${twinCli} records --count N. Stdout is JSON; usage errors go to stderr with a non-zero exit. typed_program is not available. ${goal}`;
  if (condition === "B")
    return `Use the typed_program tool: import { api } from '@cap/cli' and export async function main(). Rule: exactly ONE api.* capability call per typed_program invocation; never compose multiple calls in one program. Never use bash/read/edit/write. ${goal}`;
  return `Use the typed_program tool: import { api } from '@cap/cli' and export async function main(). Compose freely: multiple api.* awaits per program are allowed and encouraged for dependent calls. Never use bash/read/edit/write. ${goal}`;
}

async function ensureProfile(profile: string) {
  await mkdir(profile, { recursive: true });
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`OpenRouter catalog: HTTP ${response.status}`);
  const catalog = (await response.json()) as {
    data: {
      id: string;
      context_length: number;
      pricing: { prompt: string; completion: string; input_cache_read?: string };
    }[];
  };
  const models = MODELS.flatMap((id) => {
    const m = catalog.data.find((m) => m.id === id);
    return m
      ? [
          {
            id,
            contextWindow: m.context_length,
            maxTokens: 4096,
            reasoning: false,
            input: ["text"],
            cost: {
              input: Number(m.pricing.prompt) * 1e6,
              output: Number(m.pricing.completion) * 1e6,
              cacheRead: Number(m.pricing.input_cache_read ?? 0) * 1e6,
              cacheWrite: 0,
            },
          },
        ]
      : [];
  });
  if (!models.length) throw new Error("None of the benchmark models are listed");
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
  return models.map((m) => m.id);
}

interface CellRecord {
  task: TaskId;
  condition: Condition;
  model: string;
  fallback: boolean;
  exitCode: number;
  timeout: boolean;
  ms: number;
  pass: boolean;
  note: string | null;
  forbiddenTools: string[];
  toolCounts: Record<string, number>;
  usage: { input: number; output: number; totalTokens: number; cost: number };
  capabilityCalls: number;
  rawCapabilityBytes: number;
  bytesExposedToPi: number;
  piToolBytes: number;
  promptBytes: number;
  finalText: string;
}

async function runCell(
  task: TaskId,
  condition: Condition,
  profile: string,
  twinConfig: string,
  models: string[],
  cwd: string,
): Promise<CellRecord> {
  const prompt = promptFor(task, condition);
  let lastError = "";
  for (const [index, model] of models.entries()) {
    const args = [
      process.execPath,
      cliJs,
      "--provider",
      "openrouter",
      "--model",
      model,
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-prompt-templates",
      "--no-context-files",
      "--mode",
      "json",
      ...(condition === "A" ? [] : ["-e", extension]),
      "-p",
      prompt,
    ];
    const { STRATA_CONFIG: _ignored, ...baseEnv } = process.env;
    const start = performance.now();
    const child = Bun.spawn(args, {
      cwd,
      env: {
        ...baseEnv,
        PI_CODING_AGENT_DIR: profile,
        ...(condition === "A" ? {} : { STRATA_CONFIG: twinConfig }),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    clearTimeout(timer);
    const ms = performance.now() - start;
    const timeout = ms >= timeoutMs - 500;
    const slug = model.replace(/[^a-zA-Z0-9]+/g, "-");
    await Bun.write(`${cwd}.attempt-${index}-${slug}.jsonl`, stdout);
    await Bun.write(`${cwd}.attempt-${index}-${slug}.stderr`, stderr);
    await Bun.write(`${cwd}.jsonl`, stdout);
    await Bun.write(`${cwd}.stderr`, stderr);
    const record = parseCell(task, condition, model, index > 0, exitCode, timeout, ms, prompt, stdout);
    if (record.note !== "harness: no assistant response") return record;
    console.log(`  attempt ${index} model=${model} exit=${exitCode} ms=${Math.round(ms)}: no assistant response; trying next model`);
    lastError = record.note;
  }
  throw new Error(`All models failed; last: ${lastError}`);
}

function parseCell(
  task: TaskId,
  condition: Condition,
  model: string,
  fallback: boolean,
  exitCode: number,
  timeout: boolean,
  ms: number,
  prompt: string,
  stdout: string,
): CellRecord {
  const events = stdout.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const toolCounts: Record<string, number> = {};
  let piToolBytes = 0;
  let capabilityCalls = 0;
  let rawCapabilityBytes = 0;
  let bytesExposedToPi = 0;
  const toolTexts: string[] = [];
  const typedTexts: string[] = [];
  for (const e of events) {
    if (e.type !== "tool_execution_end") continue;
    toolCounts[e.toolName] = (toolCounts[e.toolName] ?? 0) + 1;
    for (const c of e.result?.content ?? []) {
      if (typeof c.text !== "string") continue;
      piToolBytes += Buffer.byteLength(c.text);
      toolTexts.push(c.text);
      if (e.toolName === "typed_program") {
        typedTexts.push(c.text);
        try {
          const report = JSON.parse(c.text);
          capabilityCalls += report.metrics?.capabilityCalls ?? 0;
          rawCapabilityBytes += report.metrics?.rawCapabilityBytes ?? 0;
          bytesExposedToPi += report.metrics?.bytesExposedToPi ?? 0;
        } catch {
          // Non-JSON tool text still counts toward Pi bytes.
        }
      }
    }
  }
  const usage = { input: 0, output: 0, totalTokens: 0, cost: 0 };
  const finals: string[] = [];
  for (const e of events) {
    if (e.type !== "message_end" || e.message?.role !== "assistant") continue;
    const u = e.message.usage;
    if (u) {
      usage.input += u.input ?? 0;
      usage.output += u.output ?? 0;
      usage.totalTokens += u.totalTokens ?? 0;
      usage.cost += u.cost?.total ?? 0;
    }
    const text = (e.message.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("\n");
    if (text) finals.push(text);
  }
  const finalText = finals.at(-1) ?? "";
  const forbidden =
    condition === "A"
      ? []
      : Object.keys(toolCounts).filter((t) =>
          ["bash", "read", "edit", "write"].includes(t),
        );
  let pass = false;
  let note: string | null = null;
  if (!finals.length) {
    note = "harness: no assistant response";
  } else if (typedTexts.some((t) => t.includes("Typed runtime unavailable"))) {
    // Backend never initialized: any task verdict would misattribute a harness bug.
    note = "harness: typed runtime unavailable";
  } else if (forbidden.length) {
    note = `deviation: forbidden tools used: ${forbidden.join(",")}`;
  } else if (timeout) {
    note = "harness: cell timed out (partial transcript analyzed)";
    const fail = TASKS[task]!.check(
      { final: finalText, tools: toolTexts.join("\n"), typed: typedTexts.join("\n") },
      condition,
    );
    pass = fail === null;
    if (!pass) note += `; task: ${fail}`;
  } else {
    const fail = TASKS[task]!.check(
      { final: finalText, tools: toolTexts.join("\n"), typed: typedTexts.join("\n") },
      condition,
    );
    pass = fail === null;
    note = fail;
  }
  return {
    task,
    condition,
    model,
    fallback,
    exitCode,
    timeout,
    ms: Math.round(ms),
    pass,
    note,
    forbiddenTools: forbidden,
    toolCounts,
    usage,
    capabilityCalls,
    rawCapabilityBytes,
    bytesExposedToPi,
    piToolBytes,
    promptBytes: Buffer.byteLength(prompt),
    finalText: finalText.slice(0, 2000),
  };
}

const profile = outDir + "/profile";
const twinConfig = outDir + "/twin.json";
await mkdir(outDir, { recursive: true });
const models = await ensureProfile(profile);
await Bun.write(twinConfig, JSON.stringify({ transport: "cli-twin", allow: ["customers", "invoices", "records"] }));

// Static context accounting: twin declaration bytes (no model involved).
import { cliTwinSession } from "./cli-twin.ts";
const twinProbe = await cliTwinSession();
const declarationBytes = Buffer.byteLength(twinProbe.session.declarations);
await twinProbe.session.close();

const cells: CellRecord[] = [];
const tasks: TaskId[] = ["T1", "T2", "T3", "T4"];
const conds: Condition[] = ["A", "B", "C"];
for (const task of tasks) {
  for (const cond of conds) {
    const id = `${task}:${cond}`;
    if (selected.size && !selected.has(id)) continue;
    const cwd = `${outDir}/cell-${id}`;
    await mkdir(cwd, { recursive: true });
    console.log(`--- cell ${id} ---`);
    const record = await runCell(task, cond, profile, twinConfig, models, cwd);
    await Bun.write(`${outDir}/cell-${id}.json`, JSON.stringify(record, null, 2));
    cells.push(record);
    console.log(
      `${id} model=${record.model}${record.fallback ? " (fallback)" : ""} pass=${record.pass} ms=${record.ms} tools=${JSON.stringify(record.toolCounts)} tokens=${record.usage.totalTokens} cost=${record.usage.cost.toFixed(6)} note=${record.note ?? "-"}`,
    );
  }
}
await Bun.write(
  `${outDir}/results.json`,
  JSON.stringify(
    {
      protocol: "001-v1",
      models,
      timeoutMs,
      declarationBytes,
      cells,
    },
    null,
    2,
  ),
);
console.log(`\n${cells.filter((c) => c.pass).length}/${cells.length} cells passed. Results: ${outDir}/results.json`);
