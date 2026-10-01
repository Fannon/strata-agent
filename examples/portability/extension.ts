/** Portability fixture adapter; shared shipped checking, receipts and final-result selection in both arms. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Type} from '@sinclair/typebox';
import {createSession} from '../../src/session.ts';
import {makeWorld} from '../tuning/fixture.ts';
import {recipe} from '../tuning/variants.ts';
export default function(pi:any){
 const c=JSON.parse(readFileSync(process.env.STRATA_PORTABILITY_CONFIG!,'utf8'));
 if(!['baseline','candidate'].includes(c.profile))throw Error('Unknown profile');
 const enabled:string[]=c.profile==='candidate'?['recipe']:[];
 const w=makeWorld(c.taskId,c.variant,c.operations),runs:any[]=[],requests:any[]=[],finalizations:any[]=[],effectsQueries:any[]=[];
 let session:Awaited<ReturnType<typeof createSession>>;
 const persist=()=>writeFileSync(c.statePath,JSON.stringify({data:w.data,calls:w.calls,faults:[...w.faults],runs,nativeCalls:[],requests,features:enabled,finalizations,effectsQueries}));
 pi.on('session_start',async()=>{session=await createSession(w.manifest,w.connector,new Set(c.operations),{executor:'quickjs',declarations:'full'});persist();pi.setActiveTools(['typed_program','program_details','finalize_result','program_effects']);});
 pi.on('session_shutdown',async()=>{persist();await session?.close();});
 pi.on('before_agent_start',(e:any)=>{session.beginTurn();
 const common='\nUse only the enabled experiment tools. Lists paginate: follow nextCursor until null. Integer cents and individual stock units; order quantity is packs. Earlier effects survive execution failures; inspect current state before retrying uncertain writes. No other model calls. Return the requested final JSON.\n';
 let instructions="typed_program accepts a complete TypeScript module: import {api} from '@c/work'; export async function main() { ... }. Return the computed JSON from main(), rather than printing it. Errors include diagnostic and call feedback. Pure computation and capability imports only. Set finalize:true only for the final computed answer, or call finalize_result with the latest program id. The host delivers that selected JSON in the completed assistant message; stop normally without copying it. Selection expires on a new program or request. Finalization is not business correctness verification. Failures include this request's bounded recovery evidence; program_effects pages through receipts and allowed inspection operations. Confirmed means broker accepted a successful response, not independent state verification. Inspect state before retrying uncertain writes. Use program_details only if the current error feedback is insufficient.\n"+session.declarations;
 const read=w.manifest.operations.find(o=>o.name.startsWith('list'));if(enabled.includes('recipe')&&read){const field=Object.keys((read.outputSchema as any).properties).find(k=>k!=='nextCursor')!;instructions+=recipe(read.name,field);}
 writeFileSync(c.promptPath,JSON.stringify({systemPrompt:e.systemPrompt+common+instructions,prompt:e.prompt}));return {systemPrompt:e.systemPrompt+common+instructions};
 });
 pi.on('before_provider_request',(e:any,ctx:any)=>{const payload={...e.payload};if('max_tokens' in payload)payload.max_tokens=c.maxOutputTokens;else payload.max_completion_tokens=c.maxOutputTokens;if('max_tokens' in payload&&'max_completion_tokens' in payload)delete payload.max_completion_tokens;const size=Buffer.byteLength(JSON.stringify(payload));if(ctx.model?.provider!=='openrouter'||ctx.model?.id!==c.model||requests.length>=c.maxRequests||size>c.maxInputBytes){writeFileSync(c.stopPath,'model/request/payload guard');persist();process.exit(78);}requests.push({payloadBytes:size,reasoning:payload.reasoning??null});persist();return payload;});
 pi.on('tool_call',(e:any)=>{if(!['typed_program','program_details','finalize_result','program_effects'].includes(e.toolName))return {block:true,reason:'Tool outside experiment'};});
 pi.registerTool({name:'typed_program',label:'Typed program',description:'Run a TypeScript module exporting main() to compose work API calls. Return JSON from main(). Fresh QuickJS state; prior service effects persist after errors.',parameters:Type.Object({source:Type.String({maxLength:32768}),finalize:Type.Optional(Type.Boolean())}),async execute(_id:string,input:{source:string;finalize?:boolean},signal?:AbortSignal){const source=input.source;const report=await session.run(source,{signal,timeoutMs:5000});runs.push(report);persist();if(report.error)throw Error(report.text);if(input.finalize===true){session.selectResult(report.program);finalizations.push({phase:'selected',program:report.program,inline:true});persist();}return {content:[{type:'text',text:report.text}]};}});
 pi.registerTool({name:'program_details',label:'Program details',description:'Retrieve full bounded diagnostics, call metrics and logs for a prior program when the error feedback is insufficient.',parameters:Type.Object({program:Type.String({maxLength:64})}),async execute(_id:string,input:{program:string}){return {content:[{type:'text',text:JSON.stringify(session.details(input.program))}]};}});
 pi.on('message_start',(e:any)=>{if(e.message.role==='user')session?.beginTurn();});
 pi.on('message_end',(e:any)=>{
  if(e.message.role!=='assistant')return;
  if(['error','aborted','length'].includes(e.message.stopReason)){session?.invalidateResults();return;}
  if(e.message.stopReason!=='stop'||e.message.content.some((c:any)=>c.type==='toolCall'))return;
  const selected=session?.consumeSelection();if(!selected)return;
  finalizations.push({phase:'delivered',program:selected.program});persist();
  return {message:{...e.message,content:[...e.message.content.filter((c:any)=>c.type==='thinking'),{type:'text',text:selected.json}]}};
 });
 pi.registerTool({name:'finalize_result',label:'Finalize result',description:'Explicitly select the latest successful program result from this request for host JSON delivery. Finish normally without copying it. Selection does not verify business correctness.',parameters:Type.Object({program:Type.String({maxLength:64})}),async execute(_id:string,input:{program:string}){
  const selected=session.selectResult(input.program);finalizations.push({phase:'selected',program:selected.program,inline:false});persist();
  return {content:[{type:'text',text:JSON.stringify({selectedProgram:selected.program,delivery:'Host delivers selected JSON on normal completion. Finish without more tools.'})}]};
 }});
 pi.registerTool({name:'program_effects',label:'Program effects',description:'Page through bounded action acknowledgements/uncertain dispatches/rejections and allowed inspection operations. Omit program for this request; at most 5 receipts per page, continue nextOffset. Correlation ids are not idempotency keys.',parameters:Type.Object({program:Type.Optional(Type.String({maxLength:64})),offset:Type.Optional(Type.Integer({minimum:0}))}),async execute(_id:string,input:{program?:string;offset?:number}){
  let limit=5,page=session.effects(input.program,{offset:input.offset,limit}),text=JSON.stringify(page);
  while(Buffer.byteLength(text)>23900&&limit>1){page=session.effects(input.program,{offset:input.offset,limit:--limit});text=JSON.stringify(page);}
  if(Buffer.byteLength(text)>23900)throw Error('Receipt page exceeds tool budget; use an explicit program id.');
  effectsQueries.push({program:input.program??null,offset:input.offset??0});persist();return {content:[{type:'text',text}]};
 }});

}
