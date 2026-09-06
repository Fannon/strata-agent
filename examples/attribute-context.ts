// Offline context-cost attribution (issue 004, slice A). Reads a repo-2 run
// directory and breaks every request byte into categories, then compares
// profiles. No network, no model, no artifacts. Usage: bun
// examples/attribute-context.ts <runDir> [<runDir> ...]
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const dirs = process.argv.slice(2);
if (!dirs.length) throw new Error("Usage: bun examples/attribute-context.ts <runDir> [...]");

interface Cat { sysBase: number; decl: number; instr: number; tools: number; user: number;
  programs: number; results: number; input: number; output: number; cacheR: number; cacheW: number;
  requests: number; responses: number; toolCalls: number; brokerCalls: number; cost: number; cells: number; success: number }

const zero = (): Cat => ({ sysBase: 0, decl: 0, instr: 0, tools: 0, user: 0, programs: 0,
  results: 0, input: 0, output: 0, cacheR: 0, cacheW: 0, requests: 0, responses: 0,
  toolCalls: 0, brokerCalls: 0, cost: 0, cells: 0, success: 0 });

const bytes = (v: unknown) => Buffer.byteLength(typeof v === "string" ? v : JSON.stringify(v) ?? "");

for (const dir of dirs) {
  const declarations = await readFile(join(dir, "declarations.d.ts"), "utf8").catch(() => "");
  const results = JSON.parse(await readFile(join(dir, "results.json"), "utf8"));
  const byProfile = new Map<string, Cat>();
  const cellOf = (name: string) => name.replace(/^cell-(.+)-r\d+$/, "$1");
  for (const cell of results.cells as Record<string, unknown>[]) {
    if ((cell as { status: string }).status !== "attempted") continue;
    const id = cell.id as string;
    const profile = (cell.profile as string) ?? cellOf(id).split("-").slice(0, -1).join("-");
    void profile;
    const prof = (cell as { profile?: string }).profile ?? "unknown";
    const cat = byProfile.get(prof) ?? zero();
    byProfile.set(prof, cat);
    cat.cells++;
    if ((cell as { success: boolean }).success) cat.success++;
    const m = (cell as { metrics?: { capabilityCalls?: number } }).metrics;
    cat.brokerCalls += m?.capabilityCalls ?? 0;
    const usage = (cell as { usage?: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; cost: number | null } }).usage;
    if (usage && usage.input !== null) {
      cat.input += usage.input ?? 0; cat.output += usage.output ?? 0;
      cat.cacheR += usage.cacheRead ?? 0; cat.cacheW += usage.cacheWrite ?? 0;
      cat.cost += usage.cost ?? 0;
    }
    cat.responses += (cell as { modelResponses?: number }).modelResponses ?? 0;
    const counts = (cell as { toolCounts?: Record<string, number> }).toolCounts ?? {};
    for (const n of Object.values(counts)) cat.toolCalls += n;
    // Requests: split system bytes into Pi base vs declarations vs instructions.
    const reqPath = join(dir, `${id}`, "requests.jsonl");
    const receipts = (await readFile(reqPath, "utf8").catch(() => "")).split("\n").filter(Boolean);
    for (const line of receipts) {
      const payload = (JSON.parse(line) as { payload: { messages: { role: string; content: unknown }[]; tools?: unknown } }).payload;
      cat.requests++;
      cat.tools += bytes(payload.tools ?? []);
      for (const msg of payload.messages) {
        const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        if (msg.role === "system") {
          const di = text.indexOf('declare module "@');
          if (di === -1) { cat.sysBase += bytes(text); continue; }
          // Declarations block runs to the end of the system message in these traces; verify below.
          cat.sysBase += bytes(text.slice(0, di));
          cat.decl += bytes(text.slice(di));
        } else if (msg.role === "user" && (text.includes("Working directory is this repository") || text.length < 2000)) {
          cat.instr += bytes(text);
        } else {
          cat.user += bytes(text);
        }
      }
    }
    // Tool-call arguments (programs) and tool results from the trace.
    const trace = (await readFile(join(dir, `${id}`, "stdout.jsonl"), "utf8").catch(() => "")).split("\n").filter(Boolean);
    for (const line of trace) {
      let e: Record<string, unknown>;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "tool_execution_start" && typeof e.args === "object") cat.programs += bytes(e.args);
      if (e.type === "tool_execution_end" && typeof e.result === "object") {
        const content = (e.result as { content?: unknown }).content;
        cat.results += bytes(content ?? []);
      }
    }
  }
  console.log(`\n== ${dir} (declarations.d.ts ${bytes(declarations)} B) ==`);
  console.log("profile | cells ok | reqs | in-tok | out-tok | cacheR | $ | sysBase | decl | tools | instr+user | progs | results | resp | toolCalls | brokerCalls");
  for (const [p, c] of byProfile) {
    console.log(`${p} | ${c.success}/${c.cells} | ${c.requests} | ${c.input} | ${c.output} | ${c.cacheR} | ${c.cost.toFixed(4)} | ${c.sysBase} | ${c.decl} | ${c.tools} | ${c.instr + c.user} | ${c.programs} | ${c.results} | ${c.responses} | ${c.toolCalls} | ${c.brokerCalls}`);
  }
}
