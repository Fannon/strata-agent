/** Audit 065's interrupted attempts without replacing them or losing primary grades. */
import assert from 'node:assert/strict';
import {readFile,mkdir,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const repo=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_APPLICATION_OUT??join(repo,'.work/application-20261002-v2'));
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
const known:any[]=[],reconciled:any[]=[],recoveredGrades:any[]=[];
let lower=0,upper=0,requests=0,completed=0;
for(const cell of matrix.cells){
 const dir=join(out,cell.id),r=JSON.parse(await readFile(join(dir,'result.json'),'utf8'));
 requests+=r.requests;completed++;
 if(!r.reconciliation){
  assert(r.usageKnown);
  const state=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));
  const metrics=[...state.runs.map((p:any)=>p.metrics),...state.nativeCalls];
  assert.equal(r.capabilityCalls,metrics.reduce((n,m)=>n+m.capabilityCalls,0));
  assert.equal(r.capabilityCalls,metrics.reduce((n,m)=>n+m.calls.filter((c:any)=>c.invoked).length,0));
  assert.equal(r.capabilityAttempts,metrics.reduce((n,m)=>n+m.calls.length,0));
  assert.equal(r.compileErrors,metrics.filter(m=>m.outcome==='compile-error').length);
  assert(metrics.filter(m=>m.outcome==='compile-error').every(m=>m.capabilityCalls===0));
  lower+=r.costUsd;upper+=r.costUsd;known.push(cell);continue;
 }
 const proof=r.reconciliation;
 const original=await readFile(join(dir,'result.pre-reconciliation.json'));
 assert.equal(createHash('sha256').update(original).digest('hex'),proof.originalSha256);
 const before=JSON.parse(original.toString());
 // Reconciliation changes accounting only; preserves the attempt's original grade.
 for(const key of Object.keys(before).filter(k=>!['costUsd','usageKnown','reservedUsd'].includes(k)))assert.deepEqual(r[key],before[key],cell.id+':'+key);
 assert.equal(r.businessSuccess,false);assert.equal(r.effectsCorrect,null);assert.equal(proof.timeUnavailable,true);
 const events=(await readFile(join(dir,'events.jsonl'),'utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const assistants=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message);
 const statePath=join(dir,'state.json');let state:any;if(await Bun.file(statePath).exists())state=JSON.parse(await readFile(statePath,'utf8'));
 const requestCount=state?.requests.length??0;assert.equal(requestCount,proof.requestsLogged);assert.equal(assistants.length,proof.completedRequests);
 if(!requestCount){assert(!state&&events.every(e=>e.type==='session'));assert(proof.noRequestEvidence);assert.equal(r.costUsd,0);}
 else{
  const model=matrix.models.find((m:any)=>m.key===cell.modelKey),rates=model.rates;
  assert(state.requests.every((p:any)=>p.reasoning?.effort===model.thinking&&p.payloadBytes<=matrix.maxInputBytes));
  const pending=requestCount-assistants.length;assert.equal(pending,proof.unreportedRequests);assert.equal(pending,1);
  const recorded=assistants.reduce((n,a)=>n+a.usage.cost.total,0);
  const priced=assistants.reduce((n,a)=>n+a.usage.input*Number(rates.prompt)+a.usage.output*Number(rates.completion)+a.usage.cacheRead*Number(rates.input_cache_read)+a.usage.cacheWrite*Number(rates.input_cache_write??0),0);
  assert(Math.abs(recorded-priced)<1e-10);assert.equal(recorded,proof.knownCostUsd);
  const bound=recorded+pending*(matrix.maxInputBytes*Math.max(Number(rates.prompt),Number(rates.input_cache_read??0),Number(rates.input_cache_write??0))+matrix.maxOutputTokens*Number(rates.completion));
  assert.equal(bound,proof.costUpperUsd);assert.equal(r.costUsd,null);
 }
 assert.equal(r.reservedUsd,proof.costUpperUsd);lower+=proof.costLowerUsd;upper+=proof.costUpperUsd;reconciled.push(cell.id);
 // Late snapshots came from the original surviving servers. Recompute the
 // upstream and full-row grades from those snapshots without network access.
 const recovered=JSON.parse(await readFile(join(dir,'recovered-grade.json'),'utf8'));
 assert(recovered.recoveredFromOriginalServer&&!recovered.agentRestarted&&recovered.paidCalls===0);
 const replay=Bun.spawn([matrix.python,join(repo,'examples/benchmark/recover-application.py'),'--config',join(dir,'config.json'),'--port','0','--audit'],{cwd:repo,stdout:'pipe',stderr:'pipe'});
 const [recoveryText,recoveryError,recoveryExit]=await Promise.all([new Response(replay.stdout).text(),new Response(replay.stderr).text(),replay.exited]);
 if(recoveryExit!==0)throw Error(recoveryError);
 const recovery=JSON.parse(recoveryText);assert.equal(recovery.effectsCorrect,true);assert.equal(recovery.completed,false);assert.equal(recovery.failures,1);
 recoveredGrades.push(cell.id);
}
assert.equal(completed,76);assert(upper<matrix.maxBatchCostUsd);
// Run the original frozen audit over all 74 fully accounted attempts. Its output
// explicitly describes that subset; the checks above cover the other two.
const subset=join(out,'audit-known');await mkdir(subset,{recursive:true});
await Bun.write(join(subset,'matrix.json'),JSON.stringify({...matrix,cells:known}));
for(const c of known){const p=join(subset,c.id);try{await symlink(join(out,c.id),p,'dir');}catch(e:any){if(e.code!=='EEXIST')throw e;}}
const proc=Bun.spawn(['bun',join(repo,'examples/application/audit.ts')],{cwd:repo,env:{...process.env,STRATA_APPLICATION_OUT:subset},stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,exit]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
if(exit!==0)throw Error(stderr);const base=JSON.parse(stdout);
const result={auditedAttempts:completed,fullyAccounted:known.length,reconciled,recoveredGrades,requests,exactDeliveries:base.delivered,costBoundsUsd:[lower,upper],sourceHashes:base.sourceHashes,schemaGroups:base.schemaGroups,promptContracts:base.promptContracts,paidCalls:0};
await Bun.write(join(out,'audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
