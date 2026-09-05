import { isDeepStrictEqual } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";

// Feasibility pilot: stock Pi vs typed+tools vs typed-only on seeded repo tasks.
// Default is dry-run (no model calls). Live: --run --max-cost-usd 2.50
const root = new URL("../", import.meta.url).pathname;
const args = new Set(process.argv.slice(2));
const opt = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};
const LIVE = args.has("--run");
const MODEL = opt("--model", "meta/muse-spark-1.3-contributor");
const MAX_COST = Number(opt("--max-cost-usd", "2.50"));
const REPEATS = Number(opt("--repeats", "1"));
const ARMS = opt("--arms", "A,H,C").split(",");
const TASKS = opt("--tasks", "T1,T2,T3").split(",");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = `${root}.work/repo-pilot/${stamp}`;
const key = process.env.OPENROUTER_API_KEY;

interface Task {
  id: string;
  ask: string;
  expected: unknown;
}
const seed = async (cell: string) => {
  const repo = `${outDir}/${cell}/repo`;
  await mkdir(`${repo}/src`, { recursive: true });
  await writeFile(
    `${repo}/package.json`,
    JSON.stringify(
      { name: "atlas", version: "2.4.1", scripts: { test: "bun test" } },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${repo}/src/main.ts`,
    "export function greet(name: string) {\n  return `hello ${name}`;\n}\n",
  );
  await writeFile(`${repo}/README.md`, "# atlas\n");
  const git = (a: string[]) => {
    const p = Bun.spawnSync(["git", ...a], {
      cwd: repo,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
    if (p.exitCode !== 0)
      throw new Error(`git ${a.join(" ")}: ${p.stderr.toString().slice(0, 200)}`);
  };
  git(["init", "-b", "main"]);
  git(["add", "package.json", "src/main.ts", "README.md"]);
  git(["commit", "-m", "initial"]);
  await writeFile(`${repo}/staged.txt`, "staged\n");
  git(["add", "staged.txt"]);
  await writeFile(
    `${repo}/src/main.ts`,
    "export function greet(name: string) {\n  return `hello ${name}!`;\n}\n",
  );
  await writeFile(`${repo}/notes.txt`, "todo\n");
  const tasks: Task[] = [
    {
      id: "T1",
      ask: 'Read package.json and report exactly {"name","version","testScript"} (scripts.test).',
      expected: { name: "atlas", version: "2.4.1", testScript: "bun test" },
    },
    {
      id: "T2",
      ask: "Find the definition of the function named `greet`. Report exactly {\"path\" (repo-relative), \"line\" (1-based), \"signature\" (the full definition line, trimmed)}.",
      expected: {
        path: "src/main.ts",
        line: 1,
        signature: "export function greet(name: string) {",
      },
    },
    {
      id: "T3",
      ask: "Report working-tree status exactly {\"branch\",\"staged\",\"unstaged\",\"untracked\"} with sorted arrays.",
      expected: {
        branch: "main",
        staged: ["staged.txt"],
        unstaged: ["src/main.ts"],
        untracked: ["notes.txt"],
      },
    },
  ];
  await writeFile(`${repo}/../expected.json`, JSON.stringify(tasks, null, 2));
  return { repo, tasks };
};

const tooling = {
  A: "Use the available file and shell tools (read, bash with cat/grep, git).",
  H: "Prefer typed_program with `import { api } from '@c/repo'` (api.readText/searchText/gitStatus); ordinary file/shell tools also work.",
  C: "Use ONLY typed_program with `import { api } from '@c/repo'` (api.readText/searchText/gitStatus). Direct file and shell tools are disabled; do not attempt them.",
};

const results: Record<string, unknown>[] = [];
let spent = 0;
let modelPrice = { input: 0, output: 0 };

if (!LIVE) {
  console.log(
    `dry-run: ${TASKS.length} tasks x ${ARMS.length} arms x ${REPEATS} repeats = ${TASKS.length * ARMS.length * REPEATS} cells. No model calls.`,
  );
  console.log(`Live with: bun examples/repo-pilot.ts --run --max-cost-usd 2.50`);
  for (const t of TASKS)
    for (const a of ARMS)
      console.log(`  cell ${t}:${a} — ${tooling[a as keyof typeof tooling].slice(0, 60)}…`);
  process.exit(0);
}
if (!key) throw new Error("Set OPENROUTER_API_KEY for --run");

const catalog = (await (
  await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(15000),
  })
).json()) as {
  data: { id: string; pricing: { prompt: string; completion: string } }[];
};
const entry = catalog.data.find((m) => m.id === MODEL);
if (!entry) throw new Error(`Model not in catalog: ${MODEL}`);
modelPrice = {
  input: Number(entry.pricing.prompt),
  output: Number(entry.pricing.completion),
};
console.log(
  `model ${MODEL} @ $${modelPrice.input}/tok in, $${modelPrice.output}/tok out; cap $${MAX_COST}`,
);

const profile = `${outDir}/profile`;
await mkdir(profile, { recursive: true });
await Bun.write(
  `${profile}/models.json`,
  JSON.stringify(
    {
      providers: {
        openrouter: {
          baseUrl: "https://openrouter.ai/api/v1",
          api: "openai-completions",
          apiKey: "OPENROUTER_API_KEY",
          models: [
            { id: MODEL, contextWindow: 128000, maxTokens: 2048, reasoning: false, input: ["text"] },
          ],
        },
      },
    },
    null,
    2,
  ),
);

const grade = (text: string, expected: unknown) => {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      if (isDeepStrictEqual(JSON.parse(blocks[i]), expected))
        return { pass: true as const, parsed: true as const };
    } catch {
      /* not JSON; try earlier block */
    }
  }
  return { pass: false as const, parsed: blocks.length > 0 };
};

for (const taskId of TASKS) {
  for (const arm of ARMS) {
    for (let rep = 0; rep < REPEATS; rep++) {
      const cell = `cell-${taskId}-${arm}-r${rep}`;
      if (spent >= MAX_COST) {
        results.push({ cell, verdict: "skipped", reason: "budget exhausted" });
        continue;
      }
      const { repo, tasks } = await seed(cell);
      const task = tasks.find((t) => t.id === taskId)!;
      const prompt =
        `Working directory is this repository. ${task.ask}\n${tooling[arm as keyof typeof tooling]}\nReply with ONLY the \`\`\`json block, no explanation.`;
      const configPath = `${outDir}/${cell}/strata.json`;
      if (arm !== "A")
        await Bun.write(
          configPath,
          JSON.stringify({
            transport: "repo",
            root: repo,
            allow: ["readText", "searchText", "gitStatus"],
          }),
        );
      const { STRATA_CONFIG: _drop, STRATA_STRICT: _drop2, ...baseEnv } = process.env;
      const cliArgs = [
        process.execPath,
        `${root}node_modules/@mariozechner/pi-coding-agent/dist/cli.js`,
        "--provider", "openrouter",
        "--model", MODEL,
        "--thinking", "off",
        "--no-session", "--no-extensions", "--no-skills",
        "--no-prompt-templates", "--no-context-files",
        "--mode", "json",
      ];
      if (arm !== "A") cliArgs.push("-e", `${root}src/pi/extension.ts`);
      cliArgs.push("-p", prompt);
      const child = Bun.spawn(cliArgs, {
        cwd: repo,
        env: {
          ...baseEnv,
          PI_CODING_AGENT_DIR: profile,
          ...(arm !== "A" ? { STRATA_CONFIG: configPath } : {}),
          ...(arm === "C" ? { STRATA_STRICT: "1" } : {}),
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const timer = setTimeout(() => child.kill(), 120000);
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      clearTimeout(timer);
      await Bun.write(`${outDir}/${cell}.jsonl`, stdout);
      await Bun.write(`${outDir}/${cell}.stderr`, stderr);
      const events = stdout.split("\n").flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
      const toolUses = events
        .filter((e) => e.type === "tool_execution_end")
        .map((e) => ({
          tool: e.toolName,
          error: typeof e.error === "string" ? e.error.slice(0, 200) : undefined,
        }));
      const blocked = toolUses.filter((t) =>
        (t.error ?? "").includes("STRATA_STRICT"),
      ).length;
      const assistantTexts = events
        .filter((e) => e.type === "message_end" && e.message?.role === "assistant")
        .map((e) => {
          const m = e.message;
          const text =
            typeof m.text === "string"
              ? m.text
              : Array.isArray(m.content)
                ? m.content.filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n")
                : "";
          const u = m.usage ?? {};
          return { text, in: Number(u.input ?? u.input_tokens ?? u.inputTokens ?? 0), out: Number(u.output ?? u.output_tokens ?? u.outputTokens ?? 0) };
        });
      const last = assistantTexts.map((t) => t.text).join("\n");
      const g = grade(last, task.expected);
      const cost = assistantTexts.reduce(
        (s, t) => s + t.in * modelPrice.input + t.out * modelPrice.output,
        0,
      );
      spent += cost;
      const directEffect = toolUses.filter((t) =>
        ["bash", "read", "write", "edit", "find", "grep", "ls"].includes(t.tool),
      ).length;
      results.push({
        cell, task: taskId, arm, rep, exitCode: code,
        pass: g.pass, answerParsed: g.parsed,
        toolUses: toolUses.map((t) => t.tool),
        blockedAttempts: blocked, directEffectCalls: directEffect,
        cost, spentTotal: spent,
      });
      console.log(
        `${cell}: pass=${g.pass} parsed=${g.parsed} tools=[${[...new Set(toolUses.map((t) => t.tool))].join(",")}] blocked=${blocked} cost=$${cost.toFixed(4)} spent=$${spent.toFixed(4)}`,
      );
    }
  }
}
await Bun.write(`${outDir}/results.json`, JSON.stringify({ model: MODEL, spent, results }, null, 2));
console.log(`done: spent $${spent.toFixed(4)} of $${MAX_COST}; artifacts in ${outDir}`);
await rm(`${outDir}/profile`, { recursive: true, force: true }).catch(() => {});
