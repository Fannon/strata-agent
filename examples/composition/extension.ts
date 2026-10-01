/** Matched business capabilities for native Pi and the production checked session. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Type} from '@sinclair/typebox';
import {toTypeBox} from '../../src/pi/direct-tools.ts';
import {createSession} from '../../src/session.ts';
import {CapabilityBroker} from '../../src/capabilities/broker.ts';
import {metrics} from '../checking/runtime.ts';
import {makeWorld} from './fixture.ts';
export default function(pi:any){
 const c=JSON.parse(readFileSync(process.env.STRATA_COMPOSITION_CONFIG!,'utf8'));
 const w=makeWorld(c.taskId,c.variant,c.operations), runs:any[]=[],nativeCalls:any[]=[],requests:any[]=[];
 const broker=new CapabilityBroker(w.manifest,w.connector,new Set(c.operations));
 let session:Awaited<ReturnType<typeof createSession>>|undefined;
 const persist=()=>writeFileSync(c.statePath,JSON.stringify({data:w.data,calls:w.calls,faults:[...w.faults],runs,nativeCalls,requests}));
 pi.on('session_start',async()=>{if(c.profile==='checked')session=await createSession(w.manifest,w.connector,new Set(c.operations),{executor:'quickjs',declarations:'full'});persist();pi.setActiveTools([c.profile==='native'?'codemode':'typed_program']);});
 pi.on('session_shutdown',async()=>{persist();await session?.close();});
 pi.on('before_agent_start',(e:any)=>{
 const common='\nUse only the enabled experiment tools. Lists paginate: follow nextCursor until null. Integer cents and individual stock units; order quantity is packs. Earlier effects survive execution failures; inspect current state before retrying uncertain writes. No other model calls. Return the requested final JSON.\n';
 const specific=c.profile==='native'?'Compose the work tools with codemode. Return the computed result from the script.':"typed_program accepts a complete TypeScript module: import {api} from '@c/work'; export async function main() { ... }. Return the computed JSON from main(), rather than printing it. Errors include diagnostic and call feedback. Pure computation and capability imports only.\n"+session!.declarations;
 writeFileSync(c.promptPath,JSON.stringify({systemPrompt:e.systemPrompt+common+specific,prompt:e.prompt}));return {systemPrompt:e.systemPrompt+common+specific};
 });
 pi.on('before_provider_request',(e:any,ctx:any)=>{
 const payload={...e.payload};if('max_tokens' in payload)payload.max_tokens=c.maxOutputTokens;else payload.max_completion_tokens=c.maxOutputTokens;
 if('max_tokens' in payload&&'max_completion_tokens' in payload)delete payload.max_completion_tokens;
 const size=Buffer.byteLength(JSON.stringify(payload));
 if(ctx.model?.provider!=='openrouter'||ctx.model?.id!==c.model||requests.length>=c.maxRequests||size>c.maxInputBytes){writeFileSync(c.stopPath,'model/request/payload guard');persist();process.exit(78);}
 requests.push({payloadBytes:size,reasoning:payload.reasoning??null});persist();return payload;
 });
 pi.on('tool_call',(e:any)=>{if(e.toolName==='codemode'&&/\bmodels\b/.test(e.input?.code??''))return {block:true,reason:'Nested model calls excluded'};if(![c.profile==='native'?'codemode':'typed_program',...(c.profile==='native'?c.operations:[])].includes(e.toolName))return {block:true,reason:'Tool outside experiment'};});
 if(c.profile==='native')for(const op of w.manifest.operations)pi.registerTool({name:op.name,label:op.name,description:op.description,exposure:'codemode',namespace:{name:'work',description:w.manifest.description},parameters:toTypeBox(op.inputSchema),outputSchema:toTypeBox(op.outputSchema!),async execute(_id:string,input:Record<string,unknown>,signal?:AbortSignal){const m=metrics('native:'+nativeCalls.length);try{const result=await broker.invoke('work',op.name,input,signal??new AbortController().signal,m);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}finally{nativeCalls.push(m);persist();}}});
 else pi.registerTool({name:'typed_program',label:'Typed program',description:'Run a TypeScript module exporting main() to compose work API calls. Return JSON from main(). Fresh QuickJS state; prior service effects persist after errors.',parameters:Type.Object({source:Type.String({maxLength:32768})}),async execute(_id:string,input:{source:string},signal?:AbortSignal){const report=await session!.run(input.source,{signal,timeoutMs:5000});runs.push(report);persist();if(report.error)throw new Error(report.text);return {content:[{type:'text',text:report.text}]};}});
}
