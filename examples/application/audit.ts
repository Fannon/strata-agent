/** Replay accounting and delivery evidence without paid calls or publishing task data. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {allowedOperation,parseAnswer} from './protocol.ts';
const repo=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_APPLICATION_OUT??join(repo,'.work/application-20261002-v2'));
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
for(const [p,h] of Object.entries(matrix.sources))assert.equal(createHash('sha256').update(await readFile(p.startsWith('/')?p:join(repo,p))).digest('hex'),h,p);
for(const [p,h] of Object.entries(matrix.inputs))assert.equal(createHash('sha256').update(await readFile(join(matrix.root,p))).digest('hex'),h,p);
let requests=0,delivered=0,costUsd=0;const manifests=new Map<string,string>(),prompts=new Map<string,string>();
const results=[];
for(const cell of matrix.cells){
 const file=join(out,cell.id,'result.json');if(!await Bun.file(file).exists())continue;
 const result=JSON.parse(await readFile(file,'utf8')),state=JSON.parse(await readFile(join(out,cell.id,'state.json'),'utf8'));
 const manifest=JSON.parse(await readFile(join(out,cell.id,'manifest.json'),'utf8'));
 assert(manifest.operations.every((op:any)=>allowedOperation(op.name)),cell.id+' read grants');
 const manifestText=JSON.stringify(manifest),manifestKey=cell.apps.join(',');
 if(manifests.has(manifestKey))assert.equal(manifestText,manifests.get(manifestKey),cell.id+' schema parity');else manifests.set(manifestKey,manifestText);
 const prompt=JSON.parse(await readFile(join(out,cell.id,'prompt.json'),'utf8'));
 const suffix=prompt.systemPrompt.slice(prompt.systemPrompt.indexOf('\nSolve the read-only AppWorld task'));
 const promptKey=manifestKey+':'+cell.profile;if(prompts.has(promptKey))assert.equal(suffix,prompts.get(promptKey),cell.id+' cross-model prompt parity');else prompts.set(promptKey,suffix);
 const events=(await readFile(join(out,cell.id,'events.jsonl'),'utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const assistants=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message),last=assistants.at(-1);
 assert.equal(state.requests.length,assistants.length,cell.id+' accounted requests');assert.equal(result.requests,state.requests.length);
 assert(state.requests.length<=matrix.maxRequests);assert(state.requests.every((r:any)=>r.payloadBytes<=matrix.maxInputBytes));
 const model=matrix.models.find((m:any)=>m.key===cell.modelKey);
 assert(state.requests.every((r:any)=>r.reasoning?.effort===model.thinking),cell.id+' reasoning setting');
 const sum=(key:string)=>assistants.reduce((n,a)=>n+(a.usage?.[key]??0),0);
 for(const [metric,key] of Object.entries({inputTokens:'input',outputTokens:'output',cacheReadTokens:'cacheRead',cacheWriteTokens:'cacheWrite'}))assert.equal(result[metric],sum(key));
 assert.equal(result.reportedTokens,sum('input')+sum('output')+sum('cacheRead')+sum('cacheWrite'));
 const priced=sum('input')*Number(model.rates.prompt)+sum('output')*Number(model.rates.completion)+sum('cacheRead')*Number(model.rates.input_cache_read??model.rates.prompt)+sum('cacheWrite')*Number(model.rates.input_cache_write??0);
 const cost=assistants.reduce((n,a)=>n+a.usage.cost.total,0);assert(Math.abs(cost-priced)<1e-10,cell.id+' catalog cost');assert(Math.abs(cost-result.costUsd)<1e-12);
 const grade=JSON.parse(await readFile(join(out,cell.id,'grade.json'),'utf8'));assert.equal(result.answerCorrect,!!grade.completed&&grade.failures===0&&grade.passes>0);
 assert.equal(result.effectsCorrect,grade.effectsCorrect);assert.equal(result.businessSuccess,result.healthy&&result.answerCorrect&&result.effectsCorrect);
 const text=(last?.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join(''),parsed=parseAnswer(text);assert.equal(parsed.pureJson,result.pureJson);
 assert.equal(result.strictSuccess,result.businessSuccess&&result.pureJson&&result.finalMatchesSubmission);
 for(const f of state.finalizations.filter((f:any)=>f.phase==='delivered')){
  const r=state.runs.find((r:any)=>r.program===f.program);assert(r&&!r.error);assert.equal(text,JSON.stringify(r.result));delivered++;
 }
 requests+=result.requests;costUsd+=cost;results.push(result);
}
assert(costUsd<matrix.maxBatchCostUsd);
console.log(JSON.stringify({auditedAttempts:results.length,requests,delivered,costUsd,sourceHashes:'unchanged',schemaGroups:manifests.size,promptContracts:prompts.size,paidCalls:0}));
