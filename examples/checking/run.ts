/** Bounded issue 049 pilot. --prepare is model-free; --baseline precedes --experiment. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { capture } from "../benchmark/process.ts";
import { makeWorld } from "./fixture.ts";
import { tasks, grade, type Task } from "./protocol.ts";
const root = resolve(import.meta.dir, "../..");
const out = resolve(process.env.STRATA_CHECKING_OUT ?? join(root, ".work/checking-20260930-v2"));
const pi = "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js";
const model = "meta/muse-spark-1.3-contributor";
const profileDir = join(out, "profile");
const profiles = ["native", "always", "never", "after-failure"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
await mkdir(out, { recursive: true });
const flag = process.argv[2];
if (flag === "--prepare") {
  await mkdir(profileDir, { recursive: true });
  const catalog = JSON.parse(await readFile("/tmp/strata-openrouter-models.json", "utf8"));
  const m = catalog.data.find((m: any) => m.id === model);
  if (!m) throw new Error("Requested model missing");
  await writeFile(join(profileDir, "models.json"), JSON.stringify({ providers: { openrouter: {
    baseUrl: "https://openrouter.ai/api/v1", api: "openai-completions", apiKey: "$OPENROUTER_API_KEY",
    models: [{ id: model, name: model, contextWindow: m.context_length, maxTokens: 4096,
      reasoning: true, input: ["text"], cost: { input: Number(m.pricing.prompt)*1e6,
        output: Number(m.pricing.completion)*1e6, cacheRead: Number(m.pricing.input_cache_read)*1e6, cacheWrite: 0 } }],
  } } }, null, 2));
  await writeFile(join(profileDir, "settings.json"), JSON.stringify({ autoCompaction: false,
    defaultProvider: "openrouter", defaultModel: model, defaultThinkingLevel: "medium", codemode: { mode: "only", inlineBudget: 3000 } }));
  const cells: { id: string; profile: string; task: Task; repeat: number; phase: string }[] = [];
  for (let repeat = 1; repeat <= 3; repeat++) for (const task of ["aggregate", "reconcile"] as Task[]) {
    for (const profile of ["native", "always"]) cells.push({ id: `${task}-${profile}-r${repeat}`, profile, task, repeat, phase: "baseline" });
  }
  for (let repeat = 1; repeat <= 3; repeat++) for (const task of ["aggregate", "reconcile"] as Task[]) {
    for (const profile of repeat % 2 ? ["never", "after-failure"] : ["after-failure", "never"]) cells.push({ id: `${task}-${profile}-r${repeat}`, profile, task, repeat, phase: "experiment" });
  }
  for (let repeat = 1; repeat <= 2; repeat++) for (const task of ["repair-partial", "repair-silent"] as Task[]) {
    const order = repeat % 2 ? profiles.slice(1) : [...profiles.slice(1)].reverse();
    for (const profile of order) cells.push({ id: `${task}-${profile}-r${repeat}`, profile, task, repeat, phase: "experiment" });
  }
  const sources: Record<string,string> = {};
  for (const p of ["fixture.ts", "runtime.ts", "extension.ts", "protocol.ts", "run.ts"]) sources[p] = hash(await readFile(join(import.meta.dir,p),"utf8"));
  await writeFile(join(out,"matrix.json"),JSON.stringify({ version:"049-v2", pi, piVersion:"0.99.1", bun:Bun.version,
    model, thinking:"medium", rates:m.pricing, maxRequests:8, maxOutputTokens:4096,
    timeoutMs:180000, maxBatchCostUsd:4.5, sources, cells },null,2));
  console.log(JSON.stringify({ prepared: cells.length, baseline: 12, experimental: 24, out }));
  process.exit(0);
}
if (!["--baseline", "--experiment"].includes(flag!)) throw new Error("Use --prepare, --baseline or --experiment");
const matrix = JSON.parse(await readFile(join(out,"matrix.json"),"utf8"));
for (const [p,h] of Object.entries(matrix.sources)) if(hash(await readFile(join(import.meta.dir,p),"utf8"))!==h) throw new Error(`Frozen source changed: ${p}`);
const key = process.env.OPENROUTER_API_KEY ?? JSON.parse(await readFile(join(homedir(),".pi/agent/auth.json"),"utf8")).openrouter?.access;
if (!key) throw new Error("No OpenRouter credential");
let summaries: any[] = [];
try { summaries = JSON.parse(await readFile(join(out,"summary.json"),"utf8")); } catch {}
if (flag === "--experiment" && summaries.filter(s=>s.phase==="baseline").length!==12) throw new Error("Complete baseline first");
for (const cell of matrix.cells.filter((c:any)=>c.phase===(flag==="--baseline"?"baseline":"experiment"))) {
  if (summaries.some(s=>s.id===cell.id)) continue;
  const total = summaries.reduce((n,s)=>n+s.costUsd,0);
  // Full-context upper bound for all requests in the next cell, charged at current public rates.
  const reserved = matrix.maxRequests*(1048576*Number(matrix.rates.prompt)+4096*Number(matrix.rates.completion));
  if(total+reserved>matrix.maxBatchCostUsd) throw new Error("Batch budget reached before next cell");
  const dir = join(out,cell.id); await mkdir(dir,{recursive:true});
  const task = tasks[cell.task as Task];
  const config = { ...cell, variant:0, model, maxRequests:8, seed:task.seed,
    statePath:join(dir,"state.json"), promptPath:join(dir,"prompt.json"), stopPath:join(dir,"guard-stop.txt") };
  const configPath = join(dir,"config.json"); await writeFile(configPath,JSON.stringify(config));
  const args = ["bun",pi,"--offline","--provider","openrouter","--model",model,"--thinking","medium",
    "--no-session","--no-extensions","--no-skills","--no-prompt-templates","--no-context-files","--no-builtin-tools","--mode","json",
    "-e",join(import.meta.dir,"extension.ts")];
  if(cell.profile==="native")args.push("-e","builtin:codemode");
  args.push("-p",task.ask+"\nUse only the enabled experiment tools. Return your final answer as pure JSON with no commentary.");
  const captured = await capture(args,{cwd:dir,env:{...process.env,OPENROUTER_API_KEY:key,
    PI_CODING_AGENT_DIR:profileDir,PI_OFFLINE:"1",PI_TELEMETRY:"0",STRATA_CHECKING_CONFIG:configPath},
    timeoutMs:matrix.timeoutMs,stdoutPath:join(dir,"events.jsonl"),stderrPath:join(dir,"stderr.txt")});
  let malformed = 0;
  const events = captured.stdout.split("\n").filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{malformed++;return [];}});
  const assistants = events.filter(e=>e.type==="message_end"&&e.message?.role==="assistant").map(e=>e.message);
  const final = assistants.at(-1);
  const finalText=(final?.content??[]).filter((c:any)=>c.type==="text").map((c:any)=>c.text).join("");
  let answer: unknown; try{answer=JSON.parse(finalText);}catch{}
  let state: any; try{state=JSON.parse(await readFile(config.statePath,"utf8"));}catch{}
  const usages=assistants.map(m=>m.usage);
  const known=usages.length>0&&usages.every(u=>u&&Number.isFinite(u.cost?.total));
  const costUsd=known?usages.reduce((n,u)=>n+u.cost.total,0):null;
  const grading=grade(cell.task,makeWorld(),answer,state?.payments??[]);
  const healthy=captured.exitCode===0&&!captured.termination&&!malformed&&!!state&&known&&events.some(e=>e.type==="agent_end")&&final?.stopReason!=="error";
  const runMetrics=(state?.runs??[]).map((r:any)=>r.metrics);
  const summary={...cell,...grading,healthy,success:healthy&&grading.answerCorrect&&grading.effectsCorrect,
    costUsd,requests:state?.requests??assistants.length,ms:captured.ms,exitCode:captured.exitCode,termination:captured.termination,malformed,
    inputTokens:usages.reduce((n,u)=>n+(u?.input??0),0),outputTokens:usages.reduce((n,u)=>n+(u?.output??0),0),cacheRead:usages.reduce((n,u)=>n+(u?.cacheRead??0),0),
    diagnostics:runMetrics.reduce((n:number,m:any)=>n+m.diagnostics.length,0),compileErrors:runMetrics.filter((m:any)=>m.outcome==="compile-error").length,
    runtimeErrors:runMetrics.filter((m:any)=>m.outcome==="error").length,compileMs:runMetrics.reduce((n:number,m:any)=>n+m.compileMs,0),
    capabilityCalls:runMetrics.reduce((n:number,m:any)=>n+m.capabilityCalls,0)+(state?.nativeCalls??[]).reduce((n:number,m:any)=>n+m.capabilityCalls,0),
    writesBeforeRecovery:state?.seed?Math.max(0,state.seed.metrics.calls.filter((c:any)=>c.operation==="recordPayment"&&c.invoked&&!c.failure).length):0};
  summaries.push(summary);await writeFile(join(dir,"result.json"),JSON.stringify(summary,null,2));
  await writeFile(join(out,"summary.json"),JSON.stringify(summaries,null,2));
  console.log(JSON.stringify({id:cell.id,success:summary.success,healthy,costUsd,requests:summary.requests,ms:Math.round(summary.ms),effects:grading.effectCount}));
  if(!known)throw new Error(`Missing usage: stopped after ${cell.id}`);
  if(!healthy)throw new Error(`Unhealthy cell: inspect local artifacts for ${cell.id}`);
}
console.log(JSON.stringify({cells:summaries.length,costUsd:summaries.reduce((n,s)=>n+s.costUsd,0)}));
