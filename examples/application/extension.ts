/** Same live MCP operations and broker validation for native Pi and checked Strata. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Type} from '@sinclair/typebox';
import {connectMcp} from '../../src/capabilities/mcp/connector.ts';
import {CapabilityBroker} from '../../src/capabilities/broker.ts';
import {createSession} from '../../src/session.ts';
import {metrics} from '../checking/runtime.ts';
import {allowedOperation} from './protocol.ts';
export default async function(pi:any){
 const c=JSON.parse(readFileSync(process.env.STRATA_APPLICATION_CONFIG!,'utf8'));
 if(!['native','checked'].includes(c.profile))throw Error('Unknown application profile');
 const runs:any[]=[],nativeCalls:any[]=[],requests:any[]=[],finalizations:any[]=[],submissions:any[]=[];
 let session:Awaited<ReturnType<typeof createSession>>|undefined;
 let connection:Awaited<ReturnType<typeof connectMcp>>|undefined;
 let broker:CapabilityBroker|undefined,programCalls=0,closed=false;
 const persist=()=>writeFileSync(c.statePath,JSON.stringify({runs,nativeCalls,requests,finalizations,submissions,closed}));
 if(c.profile==='native'){
  const {createCodemodeExtension}=await import(c.piDist+'/extensions/codemode/index.js');
  // Keep native execution/result semantics; impose the same source/call/time bounds.
  const wrapped=Object.create(pi);wrapped.registerTool=(def:any)=>pi.registerTool({...def,async execute(id:any,input:any,signal:any,onUpdate:any,ctx:any){
   if(Buffer.byteLength(input.code)>32768)throw Error('Source exceeds 32768 bytes');
   programCalls=0;
   const code=input.code.replace(/^\s*\/\/\s*@options:.*(?:\n|$)/,'');
   return def.execute(id,{code:'// @options: {"timeout_ms":30000,"max_output_tokens":10000}\n'+code},signal,onUpdate,ctx);
  }});
  createCodemodeExtension({models:false,mode:'only',inlineBudget:100000})(wrapped);
 }
 pi.on('session_start',async()=>{
  connection=await connectMcp('appworld',{command:c.python,args:['-m','appworld.cli','serve','mcp','stdio','--app-names',c.apps.join(','),'--output-type','both','--remote-apis-url',c.remoteApisUrl,'--root',c.root],env:{...process.env,APPWORLD_ROOT:c.root,APPWORLD_CACHE:c.root+'/cache'}});
  const allowed=new Set<string>(connection.manifest.operations.map(o=>o.name).filter(allowedOperation));
  // Both arms see exactly the same read/auth/submission surface, without prohibited write declarations.
  const manifest={...connection.manifest,operations:connection.manifest.operations.filter(o=>allowed.has(o.name))};
  writeFileSync(c.manifestPath,JSON.stringify(manifest));
  const original=connection.connector;
  const connector={async invoke(name:string,input:Record<string,unknown>,signal:AbortSignal){if(name==='supervisor__complete_task'){submissions.push({answer:input.answer});persist();}return original.invoke(name,input,signal);},close:()=>original.close()};
  if(c.profile==='checked')session=await createSession(manifest,connector,allowed,{executor:'quickjs',declarations:'full',validation:{acceptNaiveDateTime:true}});
  else{
   broker=new CapabilityBroker(manifest,connector,allowed,{acceptNaiveDateTime:true});
   for(const op of manifest.operations)pi.registerTool({name:op.name,label:op.name,description:op.description,exposure:'codemode',namespace:{name:'appworld',description:'AppWorld application APIs'},parameters:Type.Unsafe(op.inputSchema),outputSchema:op.outputSchema?Type.Unsafe(op.outputSchema):undefined,async execute(_id:any,input:any,signal?:AbortSignal){
    if(++programCalls>100)throw Error('Per-script capability call limit exceeded (100)');
    const m=metrics('native:'+nativeCalls.length);try{const result=await broker!.invoke('appworld',op.name,input,signal??new AbortController().signal,m);m.outcome='ok';return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}finally{nativeCalls.push(m);persist();}
   }});
  }
  persist();pi.setActiveTools(c.profile==='native'?['codemode']:['typed_program','program_details','finalize_result']);
 });
 pi.on('session_shutdown',async()=>{closed=true;persist();if(session)await session.close();else await connection?.connector.close();});
 pi.on('before_agent_start',(e:any)=>{
  session?.beginTurn();
  const common='\nSolve the read-only AppWorld task using the available application APIs and local computation. Lists may paginate; obtain complete data as needed. Call payloads use a response wrapper. Get account context/credentials from supervisor APIs only. Login and supervisor__complete_task are allowed; other business writes are unavailable. Do not call other models. Submit the exact requested answer with supervisor__complete_task, then finish with that same answer value as pure JSON (a string or number when requested). Successful-looking computations do not establish task correctness.\n';
  const specific=c.profile==='native'?'Compose the application tools with native codemode. Tools retain their original names. Return the computed result from the script.\n':"typed_program takes a complete TypeScript module importing {api} from '@c/appworld' and exporting a zero-argument main() that returns JSON. Fresh program state; types are checked before execution. Errors include diagnostics and call evidence. program_details can inspect retained reports. Select only the final answer using finalize:true or finalize_result; the host delivers that exact JSON on normal completion. Selection does not certify task correctness.\n"+session!.declarations;
  writeFileSync(c.promptPath,JSON.stringify({systemPrompt:e.systemPrompt+common+specific,prompt:e.prompt}));return {systemPrompt:e.systemPrompt+common+specific};
 });
 pi.on('before_provider_request',(e:any,ctx:any)=>{
  if(c.scripted)return;
  const payload={...e.payload};if('max_tokens' in payload)payload.max_tokens=c.maxOutputTokens;else payload.max_completion_tokens=c.maxOutputTokens;
  if('max_tokens' in payload&&'max_completion_tokens' in payload)delete payload.max_completion_tokens;
  const bytes=Buffer.byteLength(JSON.stringify(payload));
  if(ctx.model?.provider!=='openrouter'||ctx.model?.id!==c.model||requests.length>=c.maxRequests||bytes>c.maxInputBytes){writeFileSync(c.stopPath,'model/request/payload guard');persist();process.exit(78);}
  requests.push({payloadBytes:bytes,reasoning:payload.reasoning??null});persist();return payload;
 });
 pi.on('tool_call',(e:any)=>{
  const permitted=c.profile==='native'?e.toolName==='codemode'||allowedOperation(e.toolName):['typed_program','program_details','finalize_result'].includes(e.toolName);
  if(!permitted)return {block:true,reason:'Tool outside read-only application study'};
 });
 if(c.profile==='checked'){
  pi.registerTool({name:'typed_program',label:'Typed program',description:'Typecheck and execute a TypeScript module exporting main(), returning JSON. Calls and results are bounded; prior submission/auth effects persist.',parameters:Type.Object({source:Type.String({maxLength:32768}),finalize:Type.Optional(Type.Boolean())}),async execute(_id:any,input:any,signal?:AbortSignal){
   const report=await session!.run(input.source,{signal,timeoutMs:30000});runs.push(report);persist();if(report.error)throw Error(report.text);
   if(input.finalize){session!.selectResult(report.program);finalizations.push({phase:'selected',program:report.program,inline:true});persist();}
   return {content:[{type:'text',text:report.text}]};
  }});
  pi.registerTool({name:'program_details',label:'Program details',description:'Inspect bounded diagnostics and call metrics after an error.',parameters:Type.Object({program:Type.String()}),async execute(_id:any,input:any){return {content:[{type:'text',text:JSON.stringify(session!.details(input.program))}]};}});
  pi.registerTool({name:'finalize_result',label:'Finalize result',description:'Select the latest successful program JSON for exact host delivery. Finish normally; selection is not task verification.',parameters:Type.Object({program:Type.String()}),async execute(_id:any,input:any){const selected=session!.selectResult(input.program);finalizations.push({phase:'selected',program:selected.program,inline:false});persist();return {content:[{type:'text',text:'Selected final JSON. Finish normally without more tools.'}]};}});
  pi.on('message_start',(e:any)=>{if(e.message.role==='user')session?.beginTurn();});
  pi.on('message_end',(e:any)=>{
   if(e.message.role!=='assistant')return;
   if(['error','aborted','length'].includes(e.message.stopReason)){session?.invalidateResults();return;}
   if(e.message.stopReason!=='stop'||e.message.content.some((v:any)=>v.type==='toolCall'))return;
   const selected=session?.consumeSelection();if(!selected)return;
   finalizations.push({phase:'delivered',program:selected.program});persist();return {message:{...e.message,content:[...e.message.content.filter((v:any)=>v.type==='thinking'),{type:'text',text:selected.json}]}};
  });
 }
}
