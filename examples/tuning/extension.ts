/** Experimental tuning only; production compiler/broker/session unchanged. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Type} from '@sinclair/typebox';
import {createSession} from '../../src/session.ts';
import {makeWorld} from './fixture.ts';
import {profiles,helperSource,helperSignature,modelDeclarations,recipe} from './variants.ts';
export default function(pi:any){
 const c=JSON.parse(readFileSync(process.env.STRATA_TUNING_CONFIG!,'utf8'));
 if(![...profiles,'candidate'].includes(c.profile))throw Error('Unknown profile');
 const enabled:string[]=c.profile==='candidate'?c.candidateFeatures:(c.profile==='baseline'?[]:[c.profile]);
 const w=makeWorld(c.taskId,c.variant,c.operations),runs:any[]=[],requests:any[]=[];
 let session:Awaited<ReturnType<typeof createSession>>;
 const persist=()=>writeFileSync(c.statePath,JSON.stringify({data:w.data,calls:w.calls,faults:[...w.faults],runs,nativeCalls:[],requests,features:enabled}));
 pi.on('session_start',async()=>{session=await createSession(w.manifest,w.connector,new Set(c.operations),{executor:'quickjs',declarations:'full'});persist();pi.setActiveTools(['typed_program','program_details']);});
 pi.on('session_shutdown',async()=>{persist();await session?.close();});
 pi.on('before_agent_start',(e:any)=>{
 const common='\nUse only the enabled experiment tools. Lists paginate: follow nextCursor until null. Integer cents and individual stock units; order quantity is packs. Earlier effects survive execution failures; inspect current state before retrying uncertain writes. No other model calls. Return the requested final JSON.\n';
 let instructions="typed_program accepts a complete TypeScript module: import {api} from '@c/work'; export async function main() { ... }. Return the computed JSON from main(), rather than printing it. Errors include diagnostic and call feedback. Pure computation and capability imports only. Use program_details only if the current error feedback is insufficient.\n"+modelDeclarations(session.declarations,enabled.includes('lean'));
 const read=w.manifest.operations.find(o=>o.name.startsWith('list'));if(enabled.includes('recipe')&&read){const field=Object.keys((read.outputSchema as any).properties).find(k=>k!=='nextCursor')!;instructions+=recipe(read.name,field);}
 if(enabled.includes('helper'))instructions+='\nA tested collectPages function is already defined in your module by the runtime. Do not redefine/import it. Signature: '+helperSignature+' Use collectPages(api.listInvoices, page => page.invoices), adapting to enabled operation/actual array field. It follows cursor pages, checks repeated cursors and bounds records; calls still use the broker. No automatic retries.\n';
 writeFileSync(c.promptPath,JSON.stringify({systemPrompt:e.systemPrompt+common+instructions,prompt:e.prompt}));return {systemPrompt:e.systemPrompt+common+instructions};
 });
 pi.on('before_provider_request',(e:any,ctx:any)=>{const payload={...e.payload};if('max_tokens' in payload)payload.max_tokens=c.maxOutputTokens;else payload.max_completion_tokens=c.maxOutputTokens;if('max_tokens' in payload&&'max_completion_tokens' in payload)delete payload.max_completion_tokens;const size=Buffer.byteLength(JSON.stringify(payload));if(ctx.model?.provider!=='openrouter'||ctx.model?.id!==c.model||requests.length>=c.maxRequests||size>c.maxInputBytes){writeFileSync(c.stopPath,'model/request/payload guard');persist();process.exit(78);}requests.push({payloadBytes:size,reasoning:payload.reasoning??null});persist();return payload;});
 pi.on('tool_call',(e:any)=>{if(!['typed_program','program_details'].includes(e.toolName))return {block:true,reason:'Tool outside experiment'};});
 pi.registerTool({name:'typed_program',label:'Typed program',description:'Run a TypeScript module exporting main() to compose work API calls. Return JSON from main(). Fresh QuickJS state; prior service effects persist after errors.',parameters:Type.Object({source:Type.String({maxLength:32768})}),async execute(_id:string,input:{source:string},signal?:AbortSignal){const source=input.source+(enabled.includes('helper')?'\n'+helperSource:'');const report=await session.run(source,{signal,timeoutMs:5000});runs.push(report);persist();if(report.error){if(enabled.includes('feedback')&&report.metrics.outcome==='compile-error')throw Error(JSON.stringify({program:report.program,error:'Compile failed; no code or calls from this program ran. Earlier program effects persist.',diagnostics:report.metrics.diagnostics.slice(0,3),remainingDiagnostics:Math.max(0,report.metrics.diagnostics.length-3),more:'Use program_details for remaining diagnostic/call evidence.'}));throw Error(report.text);}return {content:[{type:'text',text:report.text}]};}});
 pi.registerTool({name:'program_details',label:'Program details',description:'Retrieve full bounded diagnostics, call metrics and logs for a prior program when the error feedback is insufficient.',parameters:Type.Object({program:Type.String({maxLength:64})}),async execute(_id:string,input:{program:string}){return {content:[{type:'text',text:JSON.stringify(session.details(input.program))}]};}});
}
