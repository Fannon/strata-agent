/** Model-free sanitized export and task-block paired comparisons. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {makeWorld} from './fixture.ts';
import {oracle} from './protocol.ts';
const root=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_COMPOSITION_OUT??join(root,'.work/composition-20261001-v1'));
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
// Per-cell files are durable checkpoints even if the controller was interrupted.
const cells:any[]=[];for(const c of matrix.cells){try{cells.push(JSON.parse(await readFile(join(out,c.id,'result.json'),'utf8')));}catch{}}
// Audit runtime evidence independently of the controller's convenience counters.
const stable=(x:any):string=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
for(const c of cells){
 const dir=join(out,c.id),state=JSON.parse(await readFile(join(dir,'state.json'),'utf8')),t=[...matrix.evaluationTasks,...matrix.devTasks].find((t:any)=>t.id===c.taskId),w=makeWorld(c.taskId,c.variant,t.operations),expected=oracle(c.taskId,w.initial);
 const runs=state.runs??[];
 c.compilerDiagnosticCodes=runs.flatMap((r:any)=>r.metrics.diagnostics.flatMap((d:string)=>[...d.matchAll(/TS(\d+)/g)].map(m=>Number(m[1]))));
 c.compileRejectedPrograms=runs.filter((r:any)=>r.metrics.outcome==='compile-error').length;
 c.compileRejectionsBeforeEffects=runs.filter((r:any)=>r.metrics.outcome==='compile-error'&&r.metrics.capabilityCalls===0).length;
 if(c.profile==='native'){
  // Native broker call metrics start with outcome:error and have no script timer;
  // that sentinel is not evidence that a completed call failed.
  const events=(await readFile(join(dir,'events.jsonl'),'utf8')).split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  c.runtimeErrors=events.filter(e=>e.type==='tool_execution_end'&&e.toolName==='codemode'&&e.isError).length;c.executionMs=null;
 }
 c.missingEffects=0;c.duplicateEffects=0;c.unintendedEffects=0;c.wrongValueEffects=0;
 c.capabilityFailuresByKind={};for(const m of [...runs.map((r:any)=>r.metrics),...(state.nativeCalls??[])])for(const call of m.calls??[])if(call.failure)c.capabilityFailuresByKind[call.failure]=(c.capabilityFailuresByKind[call.failure]??0)+1;
 for(const key of ['payments','reservations','credits'] as const){
  const identity=(row:any)=>key==='payments'?row.invoiceId:key==='reservations'?row.orderId+'|'+row.sku:row.customerId+'|'+row.reason;
  const wanted=new Map<string,any[]>(),observed=new Map<string,any[]>();
  for(const row of (expected as any)[key]??[])wanted.set(identity(row),[...(wanted.get(identity(row))??[]),row]);
  for(const {id,...row} of state.data[key].filter((r:any)=>!w.initial[key].some(i=>i.id===r.id)))observed.set(identity(row),[...(observed.get(identity(row))??[]),row]);
  for(const [id,wr] of wanted){const ar=observed.get(id)??[],remaining=ar.map(stable);let exact=0;for(const r of wr){const i=remaining.indexOf(stable(r));if(i>=0){remaining.splice(i,1);exact++;}}c.missingEffects+=Math.max(0,wr.length-ar.length);c.duplicateEffects+=Math.max(0,ar.length-wr.length);c.wrongValueEffects+=Math.min(wr.length,ar.length)-exact;}
  for(const [id,ar] of observed)if(!wanted.has(id))c.unintendedEffects+=ar.length;
 }
 const closed=new Set(expected.closed??[]);for(const before of w.initial.tickets){const after=state.data.tickets.find((t:any)=>t.id===before.id);if(closed.has(before.id)&&after?.status!=='closed')c.missingEffects++;else if(!closed.has(before.id)&&after?.status!==before.status)c.unintendedEffects++;}
 c.compositionErrors=c.profile==='native'?c.runtimeErrors:c.compileErrors+c.runtimeErrors;
 c.expectedEffects=(expected.payments??[]).length+(expected.reservations??[]).length+(expected.credits??[]).length+(expected.closed??[]).length;
}
const mean=(a:number[])=>a.reduce((n,x)=>n+x,0)/a.length;
const q=(a:number[],p:number)=>{const b=[...a].sort((a,b)=>a-b);if(!b.length)return null;const i=(b.length-1)*p;return b[Math.floor(i)]!+(b[Math.ceil(i)]!-b[Math.floor(i)]!)*(i-Math.floor(i));};
function summarize(rows:any[]){const sum=(k:string)=>rows.reduce((n,c)=>n+(c[k]??0),0),n=rows.length,success=rows.filter(c=>c.businessSuccess).length;return {attempts:n,distinctTasks:new Set(rows.map(c=>c.taskId)).size,businessSuccess:success,strictSuccess:rows.filter(c=>c.strictSuccess).length,answerCorrect:rows.filter(c=>c.answerCorrect).length,effectsCorrect:rows.filter(c=>c.effectsCorrect).length,pureJson:rows.filter(c=>c.pureJson).length,healthy:rows.filter(c=>c.healthy).length,requests:sum('requests'),meanRequests:sum('requests')/n,meanReportedTokens:sum('reportedTokens')/n,inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),cacheReadTokens:sum('cacheReadTokens'),cacheWriteTokens:sum('cacheWriteTokens'),reasoningTokens:rows.every(c=>c.reasoningTokens!==null)?sum('reasoningTokens'):null,reportedTokens:sum('reportedTokens'),medianMs:q(rows.map(c=>c.ms),.5),p90Ms:q(rows.map(c=>c.ms),.9),successfulMedianMs:q(rows.filter(c=>c.businessSuccess).map(c=>c.ms),.5),costUsd:rows.every(c=>c.costUsd!==null)?sum('costUsd'):null,meanCostUsd:rows.every(c=>c.costUsd!==null)?sum('costUsd')/n:null,costPerBusinessSuccessUsd:success&&rows.every(c=>c.costUsd!==null)?sum('costUsd')/success:null,toolCalls:sum('toolCalls'),capabilityCalls:sum('capabilityCalls'),compileErrors:sum('compileErrors'),runtimeErrors:sum('runtimeErrors'),toolErrors:sum('toolErrors'),compositionErrors:sum('compositionErrors'),diagnostics:sum('diagnostics'),compileMs:sum('compileMs'),executionMs:rows.every(c=>c.executionMs!==null)?sum('executionMs'):null,validationFailures:sum('validationFailures'),policyFailures:sum('policyFailures'),missingEffects:sum('missingEffects'),duplicateEffects:sum('duplicateEffects'),unintendedEffects:sum('unintendedEffects'),wrongValueEffects:sum('wrongValueEffects'),expectedEffects:sum('expectedEffects'),compileRejectedPrograms:sum('compileRejectedPrograms'),compileRejectionsBeforeEffects:sum('compileRejectionsBeforeEffects')};}
const groups:any[]=[];for(const phase of ['dev','evaluation'])for(const model of matrix.models)for(const profile of ['native','checked']){const rows=cells.filter(c=>c.phase===phase&&c.modelKey===model.key&&c.profile===profile);if(rows.length)groups.push({phase,model:model.id,modelKey:model.key,thinking:model.thinking,profile,...summarize(rows)});}
const families:any[]=[];for(const model of matrix.models)for(const profile of ['native','checked'])for(const family of ['joins','aggregation','updates','contracts','service-recovery']){const rows=cells.filter(c=>c.phase==='evaluation'&&c.modelKey===model.key&&c.profile===profile&&c.family===family);if(rows.length)families.push({modelKey:model.key,profile,family,...summarize(rows)});}
let seed=54001;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const paired:any[]=[];
for(const model of matrix.models){const rows=cells.filter(c=>c.phase==='evaluation'&&c.modelKey===model.key),ids=[...new Set(rows.map(c=>c.taskId))];const blocks=ids.map(id=>{const native=rows.filter(c=>c.taskId===id&&c.profile==='native'),checked=rows.filter(c=>c.taskId===id&&c.profile==='checked');return {taskId:id,native,checked};}).filter(b=>b.native.length===3&&b.checked.length===3);if(!blocks.length)continue;
 const metric=(bs:typeof blocks)=>{const n=bs.flatMap(b=>b.native),c=bs.flatMap(b=>b.checked);return {successDifference:mean(c.map(c=>+c.businessSuccess))-mean(n.map(c=>+c.businessSuccess)),costRatio:mean(c.map(c=>c.costUsd))/mean(n.map(c=>c.costUsd)),tokenRatio:mean(c.map(c=>c.reportedTokens))/mean(n.map(c=>c.reportedTokens)),requestRatio:mean(c.map(c=>c.requests))/mean(n.map(c=>c.requests)),meanTimeRatio:mean(c.map(c=>c.ms))/mean(n.map(c=>c.ms))};};
 const estimates=metric(blocks),samples=Array.from({length:10000},()=>metric(Array.from({length:blocks.length},()=>blocks[Math.floor(random()*blocks.length)]!)));
 const intervals=Object.fromEntries(Object.keys(estimates).map(k=>[k,[q(samples.map(s=>(s as any)[k]),.025),q(samples.map(s=>(s as any)[k]),.975)]]));
 const pairs=blocks.flatMap(b=>b.native.map(n=>({n,c:b.checked.find(c=>c.repeat===n.repeat)!})));paired.push({modelKey:model.key,taskBlocks:blocks.length,pairedAttempts:pairs.length,estimates,bootstrap95:intervals,checkedOnlySuccess:pairs.filter(p=>p.c.businessSuccess&&!p.n.businessSuccess).length,nativeOnlySuccess:pairs.filter(p=>p.n.businessSuccess&&!p.c.businessSuccess).length,bothSuccess:pairs.filter(p=>p.n.businessSuccess&&p.c.businessSuccess).length,bothFail:pairs.filter(p=>!p.n.businessSuccess&&!p.c.businessSuccess).length});
}
const exportData={version:'054-v1',date:'2026-10-01',protocol:{piVersion:matrix.piVersion,bun:matrix.bun,models:matrix.models,maxRequests:matrix.maxRequests,maxOutputTokens:matrix.maxOutputTokens,maxInputBytes:matrix.maxInputBytes,timeoutMs:matrix.timeoutMs,concurrency:matrix.concurrency,scoring:matrix.scoring,order:matrix.order,sources:matrix.sources,developmentSourceVersion:matrix.developmentSourceVersion,taskDefinitions:matrix.evaluationTasks,developmentTasks:matrix.devTasks},groups,families,paired,uncertainty:'Descriptive 95% percentile bootstrap, 10000 resamples of whole task blocks, preserving repetitions and both arms; synthetic selected corpus, not population/generalization intervals. Time ratio uses arithmetic mean, not median. Cache/provider routing uncontrolled; completion output includes reasoning where provider does not separate it.',cells};
// Absolute local Pi installation path is not relevant in the published source-hash mapping.
for(const p of Object.keys(exportData.protocol.sources))if(p.startsWith('/')){exportData.protocol.sources['installed-pi-cli']=exportData.protocol.sources[p];delete exportData.protocol.sources[p];}
await writeFile(join(root,'docs/evaluations/composition-2026-10-01.json'),JSON.stringify(exportData,null,2)+'\n');
console.log(JSON.stringify({cells:cells.length,groups,paired,failures:cells.filter(c=>!c.businessSuccess).map(c=>({id:c.id,healthy:c.healthy,answerCorrect:c.answerCorrect,effectsCorrect:c.effectsCorrect,diagnostics:c.diagnostics,toolErrors:c.toolErrors}))},null,2));
