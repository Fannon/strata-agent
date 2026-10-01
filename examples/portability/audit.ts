/** Model-free replay audit. Never imports expected answers into the agent extension. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {makeWorld} from '../tuning/fixture.ts';
import {tasks,grade,parseAnswer} from '../tuning/protocol.ts';
const root=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_PORTABILITY_OUT??join(root,'.work/portability-20261001-v1'));
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
for(const [path,hash] of Object.entries(matrix.sources))assert.equal(createHash('sha256').update(await readFile(path.startsWith('/')?path:join(root,path))).digest('hex'),hash,path);
let requests=0,delivered=0,costUsd=0;
const sharedPrompts=new Map<string,string>();
for(const cell of matrix.cells){
 const dir=join(out,cell.id),result=JSON.parse(await readFile(join(dir,'result.json'),'utf8')),state=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));
 const prompt=JSON.parse(await readFile(join(dir,'prompt.json'),'utf8'));
 const marker='\nUse only the enabled experiment tools.';assert(prompt.systemPrompt.includes(marker),cell.id);
 const shared=prompt.systemPrompt.slice(prompt.systemPrompt.indexOf(marker)),promptKey=cell.taskId+':'+cell.profile;
 if(sharedPrompts.has(promptKey))assert.equal(shared,sharedPrompts.get(promptKey),cell.id+' shared model-facing contract');else sharedPrompts.set(promptKey,shared);
 const events=(await readFile(join(dir,'events.jsonl'),'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));
 const assistants=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message),last=assistants.at(-1);
 const text=(last?.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join(''),parsed=parseAnswer(text);
 const task=tasks.find(t=>t.id===cell.taskId)!,world=makeWorld(cell.taskId,cell.variant,task.operations),g=grade(cell.taskId,world.initial,state.data,parsed.answer);
 for(const [key,value] of Object.entries(g))assert.deepEqual(result[key],value,cell.id+':'+key);
 assert.equal(result.pureJson,parsed.pureJson,cell.id);
 assert.equal(result.requests,state.requests.length,cell.id);assert.equal(result.completedRequests,assistants.length,cell.id);
 assert.equal(state.requests.length,assistants.length,cell.id+' unaccounted request');
 assert.equal(result.businessSuccess,result.healthy&&g.answerCorrect&&g.effectsCorrect,cell.id);
 assert.equal(result.strictSuccess,result.businessSuccess&&parsed.pureJson,cell.id);
 assert.deepEqual(state.features,cell.profile==='candidate'?['recipe']:[],cell.id);
 const sum=(key:string)=>assistants.reduce((n,a)=>n+(a.usage?.[key]??0),0);
 for(const [metric,key] of Object.entries({inputTokens:'input',outputTokens:'output',cacheReadTokens:'cacheRead',cacheWriteTokens:'cacheWrite'}))assert.equal(result[metric],sum(key),cell.id);
 assert.equal(result.reportedTokens,sum('input')+sum('output')+sum('cacheRead')+sum('cacheWrite'),cell.id);
 const cost=assistants.reduce((n,a)=>n+a.usage.cost.total,0);assert(Math.abs(cost-result.costUsd)<1e-12,cell.id);
 const model=matrix.models.find((m:any)=>m.key===cell.modelKey),rates=model.rates;
 const priced=sum('input')*Number(rates.prompt)+sum('output')*Number(rates.completion)+sum('cacheRead')*Number(rates.input_cache_read)+sum('cacheWrite')*Number(rates.input_cache_write??0);
 assert(Math.abs(priced-cost)<1e-10,cell.id+' catalog pricing');
 const delivery=state.finalizations.filter((f:any)=>f.phase==='delivered');assert(delivery.length<=1,cell.id);
 if(delivery.length){
  const report=state.runs.find((r:any)=>r.program===delivery[0].program);assert(report&&!report.error&&report.metrics.outcome==='ok',cell.id);
  assert.equal(last.stopReason,'stop',cell.id);assert.equal(text,JSON.stringify(report.result),cell.id+' exact delivery');delivered++;
 }
 requests+=result.requests;costUsd+=cost;
}
assert(costUsd<matrix.maxBatchCostUsd);
console.log(JSON.stringify({auditedAttempts:matrix.cells.length,requests,delivered,costUsd,sourceHashes:'unchanged',sharedPromptContracts:sharedPrompts.size,paidCalls:0}));
