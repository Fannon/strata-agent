/** Issue 061 bounded third-model portability repeat; shared configuration, no retuning. Raw artifacts remain local. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {capture} from '../benchmark/process.ts';
import {makeWorld} from '../tuning/fixture.ts';
import {tasks,parseAnswer,grade} from '../tuning/protocol.ts';
const root=resolve(import.meta.dir,'../..'),out=resolve(process.env.STRATA_PORTABILITY_OUT??join(root,'.work/portability-20261001-v1'));
const pi='/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js';
const modelIds=['meta/muse-spark-1.3-contributor','z-ai/glm-5.3-flash','inclusionai/ling-3.0-flash-vl'];
const sources=['examples/tuning/fixture.ts','examples/tuning/protocol.ts','examples/portability/extension.ts','examples/portability/run.ts','examples/portability/summarize.ts','examples/tuning/variants.ts','examples/tuning/preflight.ts','examples/composition/fixture.ts','examples/composition/protocol.ts','src/recovery.ts','src/session.ts','src/compiler/workspace.ts','src/capabilities/broker.ts','src/capabilities/schemas.ts','src/runtime/executor.ts','src/runtime/worker.ts','src/runtime/capability-imports.ts','src/pi/direct-tools.ts','src/capabilities/manifest.ts','package.json','bun.lock','examples/benchmark/process.ts','examples/checking/runtime.ts'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const flag=process.argv[2];await mkdir(out,{recursive:true});
if(flag==='--prepare'){
 const catalog=JSON.parse(await readFile('/tmp/strata-openrouter-models-20261001-ling.json','utf8'));
 const models=modelIds.map((id,index)=>{const m=catalog.data.find((m:any)=>m.id===id);if(!m?.supported_parameters.includes('tools'))throw Error('Model absent or tools unsupported');return {id,key:['muse','glm','ling'][index],thinking:index===0?'medium':index===1?'low':'off',reasoning:index<2,rates:m.pricing,canonical:m.canonical_slug,contextWindow:m.context_length};});
 for(const m of models){const dir=join(out,'profile-'+m.key);await mkdir(dir,{recursive:true});await writeFile(join(dir,'models.json'),JSON.stringify({providers:{openrouter:{baseUrl:'https://openrouter.ai/api/v1',api:'openai-completions',apiKey:'$OPENROUTER_API_KEY',models:[{id:m.id,name:m.id,contextWindow:m.contextWindow,maxTokens:4096,reasoning:m.reasoning,input:['text'],cost:{input:Number(m.rates.prompt)*1e6,output:Number(m.rates.completion)*1e6,cacheRead:Number(m.rates.input_cache_read)*1e6,cacheWrite:0}}]}}}));await writeFile(join(dir,'settings.json'),JSON.stringify({autoCompaction:false,defaultProvider:'openrouter',defaultModel:m.id,defaultThinkingLevel:m.thinking,codemode:{mode:'only',inlineBudget:100000}}));}
 try{await readFile(join(out,'matrix.json'));throw Error('Output matrix already exists; preserve evidence');}catch(e){if((e as any).code!=='ENOENT')throw e;}
 const cells:any[]=[];
 for(let repeat=1;repeat<=3;repeat++)for(let ti=0;ti<tasks.length;ti++){
 const t=tasks[(ti*7)%tasks.length]!;
 const order=[0,1,2].map(i=>(i+repeat+ti)%3);
 for(const mi of order)for(const profile of repeat===1||((repeat+ti+mi)%2)?['baseline','candidate']:['candidate','baseline'])
 cells.push({id:`${t.id}-${models[mi]!.key}-${profile}-r${repeat}`,phase:'evaluation',taskId:t.id,family:t.family,repeat,variant:repeat+3,profile,modelKey:models[mi]!.key});
 }
 const fingerprints:Record<string,string>={};for(const p of sources)fingerprints[p]=hash(await readFile(join(root,p),'utf8'));
 fingerprints[pi]=hash(await readFile(pi,'utf8'));
 const matrix={version:'061-v1',selectionRule:'Fixed recipe from 060; no development or tuning in this campaign. New model holdout, existing six task definitions and three existing data worlds. Both arms use shipped checking, recovery and optional explicit finalization. No native Pi arm; no checking attribution.',pi,piVersion:'0.99.1',bun:Bun.version,models,cells,sources:fingerprints,maxRequests:8,maxOutputTokens:4096,maxInputBytes:262144,timeoutMs:180000,concurrency:4,maxBatchCostUsd:0.75,catalogDate:'2026-10-01',scoring:'business answer + exact resulting state; pure JSON separately; one unambiguous JSON code block accepted for business score',order:'deterministic task permutation and rotating models; baseline first in first data world, alternating approaches thereafter; asynchronous four-worker dispatch; fresh process/state per cell; provider cache uncontrolled',devTasks:[],evaluationTasks:tasks};
 await writeFile(join(out,'matrix.json'),JSON.stringify(matrix,null,2));await writeFile(join(out,'public-model-catalog.json'),JSON.stringify(catalog));console.log(JSON.stringify({prepared:cells.length,out}));process.exit(0);
}
if(!['--run'].includes(flag!))throw Error('Use --prepare, --run');
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
for(const [p,h] of Object.entries(matrix.sources))if(hash(await readFile(p.startsWith('/')?p:join(root,p),'utf8'))!==h)throw Error('Frozen source changed: '+p);
const key=process.env.OPENROUTER_API_KEY??JSON.parse(await readFile(join(homedir(),'.pi/agent/auth.json'),'utf8')).openrouter?.access;if(!key)throw Error('No credential');
let summaries:any[]=[];try{summaries=JSON.parse(await readFile(join(out,'summary.json'),'utf8'));}catch{}
for(const cell of matrix.cells)if(!summaries.some(s=>s.id===cell.id)){try{summaries.push(JSON.parse(await readFile(join(out,cell.id,'result.json'),'utf8')));}catch{}}
const selected=matrix.cells.filter((c:any)=>c.phase==='evaluation'&&!summaries.some(s=>s.id===c.id));
const selection={features:['recipe'],source:'060 selection frozen before third-model calls'};
let next=0,reserved=0,stopped:string|undefined;const started=Date.now();
async function worker(){while(!stopped&&next<selected.length){
 const cell=selected[next++],m=matrix.models.find((m:any)=>m.key===cell.modelKey),task=tasks.find(t=>t.id===cell.taskId)!;
 const reservation=matrix.maxRequests*(matrix.maxInputBytes*Number(m.rates.prompt)+matrix.maxOutputTokens*Number(m.rates.completion));
 const spent=summaries.reduce((n,s)=>n+(s.costUsd??s.reservedUsd),0);if(spent+reserved+reservation>matrix.maxBatchCostUsd){stopped='Budget guard before '+cell.id;break;}reserved+=reservation;
 const dir=join(out,cell.id);await mkdir(dir,{recursive:true});
 // Existing event artifacts without a result may indicate a paid interrupted run: never silently replace.
 try{const prior=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));if(prior.requests?.length){stopped='Unaccounted previous attempt '+cell.id;reserved-=reservation;break;}}catch{}
 try{await readFile(join(dir,'events.jsonl'));stopped='Unaccounted previous attempt '+cell.id;reserved-=reservation;break;}catch{}
 const config={...cell,model:m.id,operations:task.operations,candidateFeatures:selection?.features??[],maxRequests:matrix.maxRequests,maxOutputTokens:matrix.maxOutputTokens,maxInputBytes:matrix.maxInputBytes,statePath:join(dir,'state.json'),promptPath:join(dir,'prompt.json'),stopPath:join(dir,'guard-stop.txt')};
 const configPath=join(dir,'config.json');await writeFile(configPath,JSON.stringify(config));
 const args=['bun',pi,'--offline','--provider','openrouter','--model',m.id,'--thinking',m.thinking,'--no-session','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-builtin-tools','--mode','json','-e',join(import.meta.dir,'extension.ts')];args.push('-p',task.ask+'\nReturn your final answer as pure JSON with no commentary.');
 const captured=await capture(args,{cwd:dir,env:{...process.env,OPENROUTER_API_KEY:key,PI_CODING_AGENT_DIR:join(out,'profile-'+m.key),PI_OFFLINE:'1',PI_TELEMETRY:'0',STRATA_PORTABILITY_CONFIG:configPath},timeoutMs:matrix.timeoutMs,stdoutPath:join(dir,'events.jsonl'),stderrPath:join(dir,'stderr.txt')});
 let malformed=0;const events=captured.stdout.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{malformed++;return [];}});
 const assistants=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message),final=assistants.at(-1),finalText=(final?.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('');
 const parsed=parseAnswer(finalText);let state:any;try{state=JSON.parse(await readFile(config.statePath,'utf8'));}catch{}
 const usages=assistants.map(m=>m.usage),known=usages.length>0&&usages.every(u=>u&&Number.isFinite(u.cost?.total))&&(state?.requests?.length??assistants.length)===assistants.length;
 const costUsd=known?usages.reduce((n,u)=>n+u.cost.total,0):null;
 const initial=makeWorld(cell.taskId,cell.variant,task.operations).initial;
 const g=grade(cell.taskId,initial,state?.data??initial,parsed.answer);
 const healthy=captured.exitCode===0&&!captured.termination&&!malformed&&!!state&&known&&events.some(e=>e.type==='agent_end')&&final?.stopReason!=='error';
 const metrics=[...(state?.runs??[]).map((r:any)=>r.metrics),...(state?.nativeCalls??[])];
 const sum=(key:string)=>usages.reduce((n,u)=>n+(u?.[key]??0),0);
 const result={...cell,...g,healthy,businessSuccess:healthy&&g.answerCorrect&&g.effectsCorrect,strictSuccess:healthy&&g.answerCorrect&&g.effectsCorrect&&parsed.pureJson,pureJson:parsed.pureJson,costUsd,reservedUsd:reservation,usageKnown:known,requests:state?.requests?.length??assistants.length,completedRequests:assistants.length,ms:captured.ms,exitCode:captured.exitCode,termination:captured.termination??null,malformed,inputTokens:sum('input'),outputTokens:sum('output'),cacheReadTokens:sum('cacheRead'),cacheWriteTokens:sum('cacheWrite'),reportedTokens:sum('input')+sum('output')+sum('cacheRead')+sum('cacheWrite'),reasoningTokens:usages.some(u=>Number.isFinite(u?.reasoning))?sum('reasoning'):null,toolCalls:assistants.flatMap(a=>a.content??[]).filter(c=>c.type==='toolCall').length,capabilityCalls:metrics.reduce((n,m)=>n+m.capabilityCalls,0),diagnostics:metrics.reduce((n,m)=>n+m.diagnostics.length,0),compileErrors:metrics.filter(m=>m.outcome==='compile-error').length,runtimeErrors:metrics.filter(m=>m.outcome==='error').length,toolErrors:events.filter(e=>e.type==='tool_execution_end'&&e.isError).length,compileMs:metrics.reduce((n,m)=>n+m.compileMs,0),executionMs:metrics.reduce((n,m)=>n+m.executionMs,0),validationFailures:metrics.reduce((n,m)=>n+m.validationFailures,0),policyFailures:metrics.reduce((n,m)=>n+m.policyFailures,0),faults:state?.faults??[],finalizations:state?.finalizations??[],effectsQueries:state?.effectsQueries??[],startOffsetMs:Date.now()-started-captured.ms};
 summaries.push(result);reserved-=reservation;await writeFile(join(dir,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({id:cell.id,success:result.businessSuccess,strict:result.strictSuccess,healthy,requests:result.requests,ms:Math.round(result.ms),costUsd,done:summaries.length}));
 if(!known)stopped='Unknown usage '+cell.id;
 // Limits/timeouts are scored failures. Other infrastructure errors stop new dispatch.
 else if(!healthy&&captured.exitCode!==78&&!captured.termination)stopped='Infrastructure failure '+cell.id;
}}
await Promise.all(Array.from({length:matrix.concurrency},()=>worker()));summaries.sort((a,b)=>matrix.cells.findIndex((c:any)=>c.id===a.id)-matrix.cells.findIndex((c:any)=>c.id===b.id));await writeFile(join(out,'summary.json'),JSON.stringify(summaries,null,2));
console.log(JSON.stringify({cells:summaries.length,costUsd:summaries.reduce((n,s)=>n+(s.costUsd??0),0),elapsedMs:Date.now()-started,stopped}));if(stopped)throw Error(stopped);
