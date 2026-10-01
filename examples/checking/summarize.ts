/** Sanitized aggregates only; raw sources, tool data and transcripts stay local. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const out = resolve(process.env.STRATA_CHECKING_OUT ?? ".work/checking-20260930-v2");
const cells: any[] = JSON.parse(await readFile(join(out,"summary.json"),"utf8"));
const median = (values: number[]) => { const a = [...values].sort((a,b)=>a-b); return (a[Math.floor((a.length-1)/2)]!+a[Math.ceil((a.length-1)/2)]!)/2; };
const groups = [];
for (const family of ["natural", "repair-partial", "repair-silent"]) for (const profile of ["native", "always", "never", "after-failure"]) {
  const selected = cells.filter(c=>c.profile===profile&&(family==="natural"?["aggregate","reconcile"].includes(c.task):c.task===family));
  if (!selected.length) continue;
  let generatedPrograms=0, generatedCompileErrors=0, generatedRuntimeErrors=0, generatedSourceErrors=0, seedCompileErrors=0, seedRuntimeErrors=0;
  for (const c of selected) {
    const state = JSON.parse(await readFile(join(out,c.id,"state.json"),"utf8"));
    for (const r of state.runs) {
      if (r.seed) { seedCompileErrors+=Number(r.metrics.outcome==="compile-error"); seedRuntimeErrors+=Number(r.metrics.outcome==="error"); }
      else { generatedPrograms++; generatedCompileErrors+=Number(r.metrics.outcome==="compile-error");
        generatedRuntimeErrors+=Number(r.metrics.outcome==="error"&&r.metrics.executionMs>0);
        generatedSourceErrors+=Number(r.metrics.outcome==="error"&&r.metrics.executionMs===0); }
    }
  }
  const sum = (name: string) => selected.reduce((n,c)=>n+c[name],0);
  groups.push({family,profile,cells:selected.length,successes:sum("success"),answerCorrect:sum("answerCorrect"),effectsCorrect:sum("effectsCorrect"),
    costUsd:sum("costUsd"),requests:sum("requests"),medianSeconds:median(selected.map(c=>c.ms))/1000,
    compileMs:sum("compileMs"),inputTokens:sum("inputTokens"),outputTokens:sum("outputTokens"),cacheRead:sum("cacheRead"),
    generatedPrograms,generatedCompileErrors,generatedRuntimeErrors,generatedSourceErrors,seedCompileErrors,seedRuntimeErrors,writesBeforeRecovery:sum("writesBeforeRecovery"),
    finalEffects:sum("effectCount"),capabilityCalls:sum("capabilityCalls")});
}
const matrix = JSON.parse(await readFile(join(out,"matrix.json"),"utf8"));
const result={version:matrix.version,model:matrix.model,thinking:matrix.thinking,cells:cells.length,successes:cells.reduce((n,c)=>n+Number(c.success),0),
  costUsd:cells.reduce((n,c)=>n+c.costUsd,0),groups};
await writeFile(join(out,"aggregate.json"),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
