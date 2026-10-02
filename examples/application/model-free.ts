/** Run the actual installed Pi SDK/adapter/live AppWorld MCP with scripted local responses. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
import extension from './extension.ts';
const c=JSON.parse(readFileSync(process.argv[process.argv.indexOf('--config')+1]!,'utf8'));
const {createAgentSession,DefaultResourceLoader,SessionManager,SettingsManager,ModelRuntime}=await import(c.piDist+'/index.js');
const model:any={id:'local-scripted',name:'Model-free AppWorld preflight',provider:'local',api:'openai-completions',baseUrl:'http://unused.invalid',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:32000,maxTokens:1024};
const settings=SettingsManager.inMemory({compaction:{enabled:false},retry:{enabled:false},codemode:{mode:'only',inlineBudget:100000}});
const loader=new DefaultResourceLoader({cwd:c.out,agentDir:c.out,settingsManager:settings,noExtensions:true,noSkills:true,noPromptTemplates:true,noContextFiles:true,extensionFactories:[extension]});await loader.reload();
const runtime=await ModelRuntime.create({authPath:resolve(c.out,'mock-auth.json'),modelsPath:null,refreshOnCreate:false,allowModelNetwork:false});
runtime.registerProvider('local',{apiKey:'unused-probe',baseUrl:model.baseUrl,api:model.api,models:[model]});await runtime.setRuntimeApiKey('local','unused-probe');
const {session}=await createAgentSession({cwd:c.out,agentDir:c.out,model,modelRuntime:runtime,settingsManager:settings,sessionManager:SessionManager.inMemory(c.out),resourceLoader:loader,noTools:'builtin'});
const errors:any[]=[];await session.bindExtensions({onError:(e:any)=>errors.push(e)});
let requests=0;
const readSource="const task=await api.supervisor__show_active_task({});if(!('instruction' in task.response))throw Error('Missing active task');"+(c.apps.includes('spotify')?"const p=await api.supervisor__show_profile({});const passwords=await api.supervisor__show_account_passwords({});if(!('email' in p.response)||!Array.isArray(passwords.response))throw Error('Missing account context');const cred=passwords.response.find(v=>v.account_name==='spotify');if(!cred)throw Error('Missing Spotify account');const login=await api.spotify__login({username:p.response.email,password:cred.password});if(!('access_token' in login.response))throw Error('Login failed');const songs=await api.spotify__show_song_library({access_token:login.response.access_token,page_limit:1});if(!Array.isArray(songs.response))throw Error('Library read failed');":"")+"return {present:true};";
session.agent.streamFunction=()=>{
 const content=++requests===1?[{type:'toolCall',id:'read',name:c.profile==='checked'?'typed_program':'codemode',arguments:c.profile==='checked'?{source:"import {api} from '@c/appworld';export async function main(){"+readSource+'}',finalize:true}:{code:readSource.replaceAll('api.','tools.')}}]:[{type:'text',text:c.profile==='checked'?'wrong draft':'{"present":true}'}];
 const message:any={role:'assistant',content,api:model.api,provider:model.provider,model:model.id,usage:{input:1,output:1,cacheRead:0,cacheWrite:0,totalTokens:2,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:requests===1?'toolUse':'stop',timestamp:Date.now()};
 const stream=createAssistantMessageEventStream();queueMicrotask(()=>{stream.push({type:'start',partial:message});stream.push({type:'done',reason:message.stopReason,message});stream.end();});return stream;
};
try{
 await session.prompt('Model-free actual AppWorld/MCP read');const results=session.messages.filter((m:any)=>m.role==='toolResult');
 writeFileSync(resolve(c.out,'scripted-probe.json'),JSON.stringify({errors,results,requests,final:session.getLastAssistantText(),paidCalls:0}));
 if(errors.length||results.some((m:any)=>m.isError)||requests!==2||session.getLastAssistantText()!=='{"present":true}')throw Error('Scripted probe failed; inspect local evidence');
 console.log(JSON.stringify({profile:c.profile,scriptedRequests:requests,paidCalls:0,passed:true}));
}finally{await session.extensionRunner.emit({type:'session_shutdown',reason:'quit'});session.dispose();}
