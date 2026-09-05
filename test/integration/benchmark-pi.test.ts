import { test, expect } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { capture } from "../../examples/benchmark/process.ts";
import { assessTrace } from "../../examples/benchmark/protocol.ts";

// Real pinned Pi CLI + benchmark guard + deterministic local SSE provider. No paid requests.
test("benchmark Pi integration: pre-request caps stop HTTP dispatch, receipts and grading match real events", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), "strata-benchmark-pi-"));
  let hits = 0;
  let typed = false;
  const received: Record<string, unknown>[] = [];
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    hits++;
    received.push(await request.json() as Record<string, unknown>);
    const calling = typed ? hits <= 2 : hits === 1;
    const country = hits === 1 ? "XX" : "DE";
    const delta = calling ? { role: "assistant", tool_calls: [{ index: 0, id: `fixture-call-${hits}`, type: "function", function: {
      name: typed ? "typed_program" : "bash", arguments: JSON.stringify(typed
        ? { source: `import {api} from '@cap/cli'; export async function main() { return {count: (await api.customers({country: '${country}'})).customers.length}; }` }
        : { command: `${quote(process.execPath)} ${quote(join(root, "test/fixture-cli/cli.ts"))} customers --country DE` }),
    } }] } : { role: "assistant", content: typed ? '{"rejected":true,"recoveredCount":1}' : '{"count":1}' };
    const chunks = [
      { id: `response-${hits}`, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: null }] },
      { id: `response-${hits}`, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: calling ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    ];
    return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
  } });
  try {
    const profile = join(directory, "profile");
    await mkdir(profile);
    await writeFile(join(profile, "models.json"), JSON.stringify({ providers: { openrouter: {
      baseUrl: `http://127.0.0.1:${server.port}/v1`, api: "openai-completions", apiKey: "OPENROUTER_API_KEY",
      models: [{ id: "test/model", name: "Local fixture", reasoning: false, input: ["text"], contextWindow: 1000, maxTokens: 128, cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } }],
    } } }));
    await writeFile(join(profile, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0 } } }));
    const run = async (id: string, maxRequests: number, badPath = false, typedMode = false) => {
      typed = typedMode;
      hits = 0; received.length = 0;
      const cwd = join(directory, id);
      await mkdir(cwd);
      const configPath = `${cwd}.guard.json`;
      const twinPath = `${cwd}.twin.json`;
      await writeFile(twinPath, JSON.stringify({ transport: "cli-twin", allow: ["customers", "invoices", "records"] }));
      await writeFile(configPath, JSON.stringify({ model: "test/model", maxOutputTokens: 64,
        requestsPath: badPath ? join(directory, "absent", "requests") : `${cwd}.requests`, stopPath: `${cwd}.stop`, promptPath: `${cwd}.prompt`,
        budget: { maxRequests, maxTokens: 10000, maxCostUsd: 10, requestTokens: 1064, requestCostUsd: 1 },
      }));
      const result = await capture([process.execPath, join(root, "node_modules/@mariozechner/pi-coding-agent/dist/cli.js"),
        "--provider", "openrouter", "--model", "test/model", "--thinking", "off", "--no-session", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files", "--mode", "json",
        ...(typed ? ["-e", join(root, "src/pi/extension.ts")] : []),
        "-e", join(root, "examples/benchmark/guard.ts"), "-p", "Query fixture DE customers and return their count."], {
        cwd, env: { PATH: process.env.PATH, PI_CODING_AGENT_DIR: profile, OPENROUTER_API_KEY: "local-test-placeholder", STRATA_BENCHMARK_GUARD: configPath, STRATA_CONFIG: typed ? twinPath : "" },
        timeoutMs: 20000, stdoutPath: `${cwd}.stdout`, stderrPath: `${cwd}.stderr`,
      });
      return { ...result, cwd };
    };
    const complete = await run("complete", 2);
    expect(complete.stderr).not.toContain("Failed to load");
    expect(complete.exitCode).toBe(0);
    expect(hits).toBe(2);
    const verdict = assessTrace({ task: "T1", condition: "A", model: "test/model", stdout: complete.stdout, exitCode: complete.exitCode, termination: complete.termination });
    expect(verdict.harness.errors).toEqual([]);
    expect(verdict.success).toBe(true);
    expect(verdict.accounting.complete).toBe(true);
    expect(verdict.usage.totalTokens).toBe(30);
    expect((await readFile(`${complete.cwd}.requests`, "utf8")).trim().split("\n")).toHaveLength(2);
    for (const request of received) expect(request.max_tokens ?? request.max_completion_tokens).toBe(64);
    const recovered = await run("typed-recovery", 3, false, true);
    expect(recovered.exitCode).toBe(0);
    expect(hits).toBe(3);
    const recoveryVerdict = assessTrace({ task: "T4", condition: "B", model: "test/model", stdout: recovered.stdout, exitCode: recovered.exitCode, termination: recovered.termination });
    expect(recoveryVerdict.harness.errors).toEqual([]);
    expect(recoveryVerdict.correctness.reason).toBeNull();
    expect(recoveryVerdict.success).toBe(true);
    expect(recoveryVerdict.metrics.capabilityCalls).toBe(1);
    const capped = await run("capped", 1);
    expect(capped.exitCode).toBe(78);
    expect(hits).toBe(1);
    expect(JSON.parse(await readFile(`${capped.cwd}.stop`, "utf8")).reason).toBe("request limit");
    const ioError = await run("io-error", 2, true);
    expect(ioError.exitCode).toBe(78);
    expect(hits).toBe(0);
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
