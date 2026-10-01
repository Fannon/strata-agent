/** Real Pi SDK, real production extension/worker, scripted local model; no network. */
import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, AuthStorage, ModelRegistry, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage, type Model, type TextContent, type ToolCall, type ThinkingContent, type Context } from "@mariozechner/pi-ai";
import strata from "../../src/pi/extension.ts";

const model: Model<"openai-completions"> = {
  id:"local-scripted", name:"Model-free test", provider:"strata-test", api:"openai-completions",
  baseUrl:"http://unused.invalid", reasoning:false,input:["text"],
  cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:32000,maxTokens:1024,
};
async function sdk(script: (context: Context, request: number) => (TextContent|ToolCall|ThinkingContent)[], fn: (session: Awaited<ReturnType<typeof createAgentSession>>['session'], requests:()=>number) => Promise<void>, recovery = false) {
  const dir=await mkdtemp(join(tmpdir(),"strata-final-sdk-"));
  const previousConfig=process.env.STRATA_CONFIG;
  if (recovery) {
    const config=join(dir,"config.json");
    await writeFile(config,JSON.stringify({id:"pay",command:process.execPath,args:[new URL("../fixture-mcp/recovery-server.ts",import.meta.url).pathname],allow:["recordPayment","listPayments"]}));
    process.env.STRATA_CONFIG=config;
  }
  const settings=SettingsManager.inMemory({compaction:{enabled:false},retry:{enabled:false}});
  const auth=AuthStorage.inMemory();auth.setRuntimeApiKey(model.provider,"unused-test-key");
  const loader=new DefaultResourceLoader({cwd:dir,agentDir:dir,settingsManager:settings,noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,extensionFactories:[strata]});
  await loader.reload();
  const manager=SessionManager.inMemory(dir);
  const {session}=await createAgentSession({cwd:dir,agentDir:dir,model,authStorage:auth,modelRegistry:ModelRegistry.inMemory(auth),settingsManager:settings,sessionManager:manager,resourceLoader:loader,noTools:"builtin"});
  const extensionErrors: string[] = [];
  await session.bindExtensions({ onError: error => extensionErrors.push(error.error) });
  let requests=0;
  session.agent.streamFn=(_model,context)=>{
    const content=script(context,++requests);
    const message:AssistantMessage={role:"assistant",content,api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:content.some(c=>c.type==='toolCall')?'toolUse':'stop',timestamp:Date.now()};
    const stream=createAssistantMessageEventStream();
    queueMicrotask(()=>{stream.push({type:"start",partial:message});stream.push({type:"done",reason:message.stopReason as "stop"|"toolUse",message});stream.end();});
    return stream;
  };
  try {await fn(session,()=>requests); expect(extensionErrors).toEqual([]);} finally {
    await session.extensionRunner.emit({type:"session_shutdown",reason:"quit"});session.dispose();
    if (recovery) { if (previousConfig===undefined) delete process.env.STRATA_CONFIG; else process.env.STRATA_CONFIG=previousConfig; }
    await rm(dir,{recursive:true,force:true});
  }
}
const text=(text:string):TextContent=>({type:"text",text});
const run=(id:string,source:string,finalize=false):ToolCall=>({type:"toolCall",id,name:"typed_program",arguments:{source,finalize}});
const latestProgram=(context:Context)=>{
  const result=[...context.messages].reverse().find(m=>m.role==='toolResult'&&m.toolName==='typed_program');
  if(!result || result.role!=='toolResult')throw Error('No program result');
  return JSON.parse(result.content.filter(c=>c.type==='text').map(c=>(c as TextContent).text).join('')).program as string;
};

test("Pi inline selection delivers exact computed JSON in events, agent state and persisted history",async()=>{
  const answer={nested:[null,false,0,'quote" and é'],sum:42};
  await sdk((_context,n)=> n===1 ? [run("r1",`export async function main(){return ${JSON.stringify(answer)};}`,true)] : [{type:'thinking',thinking:'Internal computation explanation'},text('Here is your answer:\n```json\n{"wrong":true}\n```')],async(session,requests)=>{
    let completed='';const unsubscribe=session.subscribe(e=>{if(e.type==='message_end'&&e.message.role==='assistant'&&e.message.stopReason==='stop') completed=e.message.content.filter(c=>c.type==='text').map(c=>(c as TextContent).text).join('');});
    await session.prompt("Compute and finalize the result");unsubscribe();
    expect(requests()).toBe(2); // one program turn + normal finish, no copying/repair turn added
    expect(completed).toBe(JSON.stringify(answer));
    expect(session.getLastAssistantText()).toBe(completed);
    const branch=session.sessionManager.getBranch();
    const assistant=branch.filter(e=>e.type==='message'&&e.message.role==='assistant').at(-1);
    expect(assistant?.type==='message'&&assistant.message.role==='assistant'&&assistant.message.content).toEqual([{type:"thinking",thinking:"Internal computation explanation"},text(completed)]);
    expect(branch.filter(e=>e.type==='custom'&&e.customType==='strata.final-result').map(e=>(e as any).data.phase)).toEqual(['selected','delivered']);
    const last=session.messages.at(-1) as AssistantMessage;expect(last.usage.output).toBe(1);
  });
},20000);

test("Pi explicit selection avoids copying a result and never spills into the next user request",async()=>{
  await sdk((context,n)=>{
    if(n===1)return [run('r1','export function main(){return null;}')];
    if(n===2)return [{type:'toolCall',id:'s1',name:'finalize_result',arguments:{program:latestProgram(context)}}];
    return [text(n===3?'```json\nnull\n```':'second request ordinary answer')];
  },async(session,requests)=>{
    await session.prompt('Finalize the computed null');
    expect(requests()).toBe(3);expect(session.getLastAssistantText()).toBe('null');
    await session.prompt('New request without selection');
    expect(requests()).toBe(4);expect(session.getLastAssistantText()).toBe('second request ordinary answer');
  });
},20000);

test("Pi later failure invalidates selected data and exposes recovery instead of delivering a stale answer",async()=>{
  await sdk((_context,n)=>n===1?[run('r1','export function main(){return {intermediate:true};}',true)]:n===2?[run('r2','export function main(){return 1n;}')]:[text('Failure needs repair')],async(session,requests)=>{
    await session.prompt('Do work, then encounter a later failure');
    expect(requests()).toBe(3);expect(session.getLastAssistantText()).toBe('Failure needs repair');
    const errors=session.messages.filter(m=>m.role==='toolResult'&&m.isError);
    expect(errors).toHaveLength(1);
    const error=errors[0]!;expect(error.role==='toolResult'&&JSON.parse((error.content[0] as TextContent).text).recovery.confirmed).toBe(0);
  });
},20000);


test("actual Pi/MCP recovery exposes acknowledged versus uncertain writes and verifies the ledger without replay",async()=>{
  await sdk((context,n)=> {
    if(n===1)return [run('writes',"import {api} from '@c/pay';export async function main(){await api.recordPayment({invoiceId:'i1',amountCents:123});await api.recordPayment({invoiceId:'i2',amountCents:456});return {ok:true};}")];
    if(n===2)return [{type:'toolCall',id:'effects',name:'program_effects',arguments:{}}];
    if(n===3){
      const result=[...context.messages].reverse().find(m=>m.role==='toolResult'&&m.toolName==='program_effects');
      if(result?.role!=='toolResult')throw Error('Missing effects');
      const evidence=JSON.parse((result.content[0] as TextContent).text);
      expect(evidence.confirmed).toBe(1);expect(evidence.uncertain).toBe(1);
      expect(evidence.receipts[0].response.value.payment.id).toBe('p1');
      expect(evidence.receipts[1].input.value).toEqual({invoiceId:'i2',amountCents:456});
      expect(evidence.inspection[0].operations).toEqual(['listPayments']);
      return [run('verify',"import {api} from '@c/pay';export async function main(){return (await api.listPayments({})).payments;}",true)];
    }
    return [text('```json\n[]\n```')];
  },async(session,requests)=>{
    await session.prompt('Make the requested payments and recover from a bad reply without replay');
    expect(requests()).toBe(4);
    expect(JSON.parse(session.getLastAssistantText()!)).toEqual([
      {id:'old',invoiceId:'i1',amountCents:123},
      {id:'p1',invoiceId:'i1',amountCents:123},
      {id:'p2',invoiceId:'i2',amountCents:456},
    ]);
    const failures=session.messages.filter(m=>m.role==='toolResult'&&m.isError);
    expect(failures).toHaveLength(1);
    expect(JSON.stringify(failures)).toContain('program_effects');
  },true);
},20000);


test("an external tool invalidates a prior selection even when that tool is read-only",async()=>{
  await sdk((_context,n)=> n===1?[run('r1','export function main(){return {old:true};}',true)]:n===2?[{type:'toolCall',id:'search',name:'search_capabilities',arguments:{query:'invoice'}}]:[text('Answer after another tool')],async(session)=>{
    await session.prompt('Continue using another tool after selection');
    expect(session.getLastAssistantText()).toBe('Answer after another tool');
  });
},20000);
