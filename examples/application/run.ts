/** Bounded issue 065 AppWorld study. Derived task data and transcripts stay local. */
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {capture} from '../benchmark/process.ts';
import {definitions,development,parseAnswer} from './protocol.ts';
const repo=resolve(import.meta.dir,'../..');
const out=resolve(process.env.STRATA_APPLICATION_OUT??join(repo,'.work/application-20261002-v2'));
if(!out.startsWith(join(repo,'.work')+'/'))throw Error('Evidence must remain ignored under .work');
const root=join(repo,'.work/appworld'),python=join(root,'venv/bin/python');
const piDist='/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist',piCli=join(piDist,'bundle/cli.js');
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
async function tree(dir:string):Promise<string[]>{const entries=(await readdir(dir,{withFileTypes:true})).filter(e=>e.name!=='__pycache__');return (await Promise.all(entries.map(e=>e.isDirectory()?tree(join(dir,e.name)):Promise.resolve([join(dir,e.name)])))).flat().sort();}
export async function fingerprints(){
 const files=[...(await tree(join(repo,'examples/application'))),...(await tree(join(repo,'src'))),join(repo,'examples/checking/runtime.ts'),join(repo,'examples/benchmark/process.ts'),join(repo,'package.json'),join(repo,'bun.lock'),join(root,'environment-lock.txt'),join(piDist,'../package.json'),...(await tree(join(piDist,'extensions/codemode'))),piCli];
 const result:Record<string,string>={};for(const f of files)result[f.startsWith(repo+'/')?relative(repo,f):f]=hash(await readFile(f));return result;
}
async function inputFingerprints(){
 const files=(await tree(join(root,'data/base_dbs'))).filter(f=>/\.(db|json)$/.test(f));
 for(const t of [development.task,...definitions.flatMap(d=>[1,2,3].map(i=>d.family+'_'+i))]){
  const dir=join(root,'data/tasks',t);
  // Full snapshots here change upstream's choice of .jsonl vs .db inputs.
  if((await readdir(join(dir,'dbs'))).some(f=>f.endsWith('.db')))throw Error('Unexpected input snapshot: '+t);
  files.push(join(dir,'specs.json'),...(await tree(join(dir,'dbs'))).filter(f=>f.endsWith('.jsonl')));
 }
 const result:Record<string,string>={};for(const f of files)result[relative(root,f)]=hash(await readFile(f));return result;
}
const flag=process.argv[2];await mkdir(out,{recursive:true});
if(flag==='--prepare'){
 if(await Bun.file(join(out,'matrix.json')).exists())throw Error('Refusing to overwrite a matrix');
 const catalog=JSON.parse(await readFile(join(repo,'.work/continuation-20261002/public-model-catalog.json'),'utf8'));
 const models=['meta/muse-spark-1.3-contributor','z-ai/glm-5.3-flash'].map((id,i)=>{
  const m=catalog.data.find((m:any)=>m.id===id);if(!m)throw Error('Model missing');
  if(Number(m.pricing.request??0)!==0)throw Error('Per-request prices need an explicit reservation');
  return {id,key:i?'glm':'muse',thinking:i?'low':'medium',rates:m.pricing,canonical:m.canonical_slug,contextWindow:m.context_length};
 });
 for(const m of models){
  const dir=join(out,'profile-'+m.key);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'models.json'),JSON.stringify({providers:{openrouter:{baseUrl:'https://openrouter.ai/api/v1',api:'openai-completions',apiKey:'$OPENROUTER_API_KEY',models:[{id:m.id,name:m.id,contextWindow:m.contextWindow,maxTokens:4096,reasoning:true,input:['text'],cost:{input:Number(m.rates.prompt)*1e6,output:Number(m.rates.completion)*1e6,cacheRead:Number(m.rates.input_cache_read??m.rates.prompt)*1e6,cacheWrite:0}}]}}}));
  await writeFile(join(dir,'settings.json'),JSON.stringify({compaction:{enabled:false},retry:{enabled:false},defaultProvider:'openrouter',defaultModel:m.id,defaultThinkingLevel:m.thinking,codemode:{mode:'only',inlineBudget:100000}}));
 }
 const cells:any[]=[];
 for(const phase of ['dev','evaluation'])for(let variant=1;variant<=(phase==='dev'?1:3);variant++)for(let ti=0;ti<(phase==='dev'?1:definitions.length);ti++){
  const d=phase==='dev'?{...development,family:'6bdbc26',category:'development-library-count'}:definitions[(ti*5)%definitions.length]!;
  const task=phase==='dev'?development.task:d.family+'_'+variant;
  for(const mi of (variant+ti)%2?[0,1]:[1,0])for(const profile of (variant+ti+mi)%2?['native','checked']:['checked','native'])cells.push({id:task+'-'+models[mi]!.key+'-'+profile,phase,task,family:d.family,category:d.category,apps:d.apps,variant,profile,modelKey:models[mi]!.key});
 }
 const matrix={version:'065-application-v2',createdAt:new Date().toISOString(),piVersion:JSON.parse(await readFile(join(piDist,'../package.json'),'utf8')).version,piDist,piCli,bun:Bun.version,root,python,appworldSource:'42b5bcf3cd334fee33f0c37c02070a9f5807add5',appworldPackage:'0.2.0.dev0',dataVersion:'0.2.0',mcpVersion:'2.2.0',models,cells,sources:await fingerprints(),inputs:await inputFingerprints(),maxRequests:12,maxOutputTokens:4096,maxInputBytes:262144,timeoutSeconds:180,concurrency:2,maxBatchCostUsd:2,
  scoring:'Primary: healthy run, upstream task completed and every evaluation passes, unchanged domain state. Supplementary: final JSON matches submitted answer; pure JSON. Model-free/meta reads are not task successes.',
  stopping:'Stop new dispatch on missing usage, infrastructure/grading failure, or budget guard. Count limits/timeouts as failures. No evaluation-driven tuning. Continue only with benefit on both models and at least two families, without correctness loss; otherwise pause.',
  sampling:'6 new training-task definitions, 3 existing sibling world instances each, 18 task instances per arm/model. No fresh-data or population-inference claim. Preloaded app-relevant read schemas; no discovery/reuse arm.',
  limits:'Same read/auth/submission MCP operations, input/output validation, 32768-byte code, 100 capability calls/script, 30-second scripts. Native Pi Codemode and Strata differ in prompts/declarations/runtime/results/finalization; whole-system comparison, no checking ablation.'};
 await writeFile(join(out,'matrix.json'),JSON.stringify(matrix,null,2));await writeFile(join(out,'public-model-catalog.json'),JSON.stringify(catalog));console.log(JSON.stringify({prepared:cells.length,dev:4,evaluation:72,capUsd:2,out}));process.exit(0);
}
if(!['--dev','--run'].includes(flag!))throw Error('Use --prepare, --dev or --run');
const matrix=JSON.parse(await readFile(join(out,'matrix.json'),'utf8'));
if(JSON.stringify(await fingerprints())!==JSON.stringify(matrix.sources))throw Error('Frozen source changed');
if(JSON.stringify(await inputFingerprints())!==JSON.stringify(matrix.inputs))throw Error('Frozen inputs changed');
const key=process.env.OPENROUTER_API_KEY??JSON.parse(await readFile(join(homedir(),'.pi/agent/auth.json'),'utf8')).openrouter?.access;
if(!key)throw Error('No OpenRouter credential');
const summaries:any[]=[];
for(const cell of matrix.cells)if(await Bun.file(join(out,cell.id,'result.json')).exists())summaries.push(JSON.parse(await readFile(join(out,cell.id,'result.json'),'utf8')));
if(flag==='--run'&&summaries.filter(s=>s.phase==='dev').length!==4)throw Error('Complete separated development first');
let next=0,reserved=0,stopped:string|undefined;
const cells=matrix.cells.filter((c:any)=>c.phase===(flag==='--dev'?'dev':'evaluation')&&!summaries.some(s=>s.id===c.id));
async function worker(){while(!stopped&&next<cells.length){
 const cell=cells[next++],model=matrix.models.find((m:any)=>m.key===cell.modelKey);
 // One byte upper-bounds one token for these text-only payloads. Cache writes have
 // zero catalog price; cache reads cannot exceed uncached pricing for these models.
 const inputRate=Math.max(Number(model.rates.prompt),Number(model.rates.input_cache_read??0),Number(model.rates.input_cache_write??0));
 const reservation=matrix.maxRequests*(matrix.maxInputBytes*inputRate+matrix.maxOutputTokens*Number(model.rates.completion));
 if(summaries.reduce((n,s)=>n+(s.costUsd??s.reservedUsd),0)+reserved+reservation>matrix.maxBatchCostUsd){stopped='Budget guard before '+cell.id;break;}reserved+=reservation;
 const dir=join(out,cell.id);await mkdir(dir,{recursive:true});
 if(await Bun.file(join(dir,'events.jsonl')).exists()||await Bun.file(join(dir,'state.json')).exists()){stopped='Unaccounted previous attempt '+cell.id;reserved-=reservation;break;}
 const config={...cell,root,python,piDist,piCli,out:dir,profileDir:join(out,'profile-'+model.key),model:model.id,thinking:model.thinking,maxRequests:matrix.maxRequests,maxOutputTokens:matrix.maxOutputTokens,maxInputBytes:matrix.maxInputBytes,timeoutSeconds:matrix.timeoutSeconds,statePath:join(dir,'state.json'),manifestPath:join(dir,'manifest.json'),promptPath:join(dir,'prompt.json'),stopPath:join(dir,'guard-stop.txt')};
 const configPath=join(dir,'config.json');await writeFile(configPath,JSON.stringify(config));
 const captured=await capture([python,join(import.meta.dir,'controller.py'),'--config',configPath],{cwd:repo,env:{...process.env,OPENROUTER_API_KEY:key},timeoutMs:(matrix.timeoutSeconds+60)*1000,stdoutPath:join(dir,'controller.txt'),stderrPath:join(dir,'controller-stderr.txt')});
 let state:any,grade:any;try{state=JSON.parse(await readFile(config.statePath,'utf8'));}catch{}try{grade=JSON.parse(await readFile(join(dir,'grade.json'),'utf8'));}catch{}
 let raw='';try{raw=await readFile(join(dir,'events.jsonl'),'utf8');}catch{}
 let malformed=0;const events=raw.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{malformed++;return [];}});
 const assistants=events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').map(e=>e.message),final=assistants.at(-1);
 const finalText=(final?.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join(''),parsed=parseAnswer(finalText),usages=assistants.map(a=>a.usage);
 const known=usages.length>0&&usages.every(u=>u&&Number.isFinite(u.cost?.total))&&state?.requests.length===assistants.length;
 const sum=(key:string)=>usages.reduce((n,u)=>n+(u?.[key]??0),0),costUsd=known?usages.reduce((n,u)=>n+u.cost.total,0):null;
 const healthy=captured.exitCode===0&&!captured.termination&&!grade?.gradeError&&grade?.agentExit===0&&!grade?.timedOut&&!malformed&&!!state?.closed&&known&&events.some(e=>e.type==='agent_end')&&final?.stopReason==='stop';
 const answerCorrect=!!grade?.completed&&grade?.failures===0&&grade?.passes>0,effectsCorrect=grade?.effectsCorrect??null;
 const submission=state?.submissions.at(-1)?.answer;
 const finalMatchesSubmission=submission!==undefined&&JSON.stringify(parsed.answer)===JSON.stringify(submission);
 const ms=[...(state?.runs??[]).map((r:any)=>r.metrics),...(state?.nativeCalls??[])];
 const result={...cell,healthy,answerCorrect,effectsCorrect,businessSuccess:healthy&&answerCorrect&&effectsCorrect,strictSuccess:healthy&&answerCorrect&&effectsCorrect&&finalMatchesSubmission&&parsed.pureJson,pureJson:parsed.pureJson,finalMatchesSubmission,completed:grade?.completed??null,passes:grade?.passes??null,failures:grade?.failures??null,gradeError:grade?grade.gradeError:'missing grade',changedModelCount:grade?.changedModelCount??null,costUsd,reservedUsd:reservation,usageKnown:known,requests:state?.requests.length??assistants.length,completedRequests:assistants.length,ms:captured.ms,agentMs:grade?.agentMs??null,exitCode:captured.exitCode,agentExit:grade?.agentExit??null,timedOut:grade?.timedOut??!!captured.termination,termination:captured.termination,malformed,inputTokens:sum('input'),outputTokens:sum('output'),cacheReadTokens:sum('cacheRead'),cacheWriteTokens:sum('cacheWrite'),reportedTokens:sum('input')+sum('output')+sum('cacheRead')+sum('cacheWrite'),reasoningTokens:usages.some(u=>Number.isFinite(u?.reasoning))?sum('reasoning'):null,toolCalls:assistants.flatMap(a=>a.content??[]).filter(c=>c.type==='toolCall').length,capabilityCalls:ms.reduce((n,m)=>n+m.capabilityCalls,0),capabilityAttempts:ms.reduce((n,m)=>n+m.calls.length,0),compileErrors:ms.filter(m=>m.outcome==='compile-error').length,diagnostics:ms.reduce((n,m)=>n+m.diagnostics.length,0),compileMs:ms.reduce((n,m)=>n+m.compileMs,0),validationFailures:ms.reduce((n,m)=>n+m.validationFailures,0),policyFailures:ms.reduce((n,m)=>n+m.policyFailures,0),toolErrors:events.filter(e=>e.type==='tool_execution_end'&&e.isError).length,delivered:(state?.finalizations??[]).filter((f:any)=>f.phase==='delivered').length};
 summaries.push(result);reserved-=reservation;await writeFile(join(dir,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({id:cell.id,success:result.businessSuccess,strict:result.strictSuccess,healthy,requests:result.requests,calls:result.capabilityCalls,costUsd,ms:Math.round(result.ms),done:summaries.length}));
 if(!known)stopped='Unknown usage '+cell.id;
 else if(grade?.gradeError||!grade||(!healthy&&!grade.timedOut&&grade.agentExit!==78&&!captured.termination))stopped='Infrastructure/grade failure '+cell.id;
}}
await Promise.all(Array.from({length:matrix.concurrency},worker));summaries.sort((a,b)=>matrix.cells.findIndex((c:any)=>c.id===a.id)-matrix.cells.findIndex((c:any)=>c.id===b.id));await writeFile(join(out,'summary.json'),JSON.stringify(summaries,null,2));
await writeFile(join(out,'dispatch.json'),JSON.stringify({stopped:stopped??null,completed:summaries.length,costUsd:summaries.reduce((n,s)=>n+(s.costUsd??0),0)}));console.log(JSON.stringify({completed:summaries.length,stopped,costUsd:summaries.reduce((n,s)=>n+(s.costUsd??0),0)}));if(stopped)process.exitCode=1;
