/** No paid calls: verify pagination, schemas, state scoring and real checked recovery. */
import assert from 'node:assert/strict';
import {makeWorld} from './fixture.ts';
import {tasks,development,oracle,grade,parseAnswer} from './protocol.ts';
import {CapabilityBroker} from '../../src/capabilities/broker.ts';
import {createSession} from '../../src/session.ts';
import {metrics} from '../checking/runtime.ts';
let checked=0;
for(const t of [...tasks,...development])for(let variant=0;variant<3;variant++){
 const w=makeWorld(t.id,variant,t.operations),expected=oracle(t.id,w.initial);
 const broker=new CapabilityBroker(w.manifest,w.connector,new Set(t.operations));
 async function invoke(name:string,input:Record<string,unknown>){return broker.invoke('work',name,input,new AbortController().signal,metrics('preflight'));}
 for(const op of w.manifest.operations.filter(o=>o.metadata?.readOnly)){
 const table=op.name.slice(4).replace(/^./,c=>c.toLowerCase()) as keyof typeof w.data;let cursor:string|undefined,rows:any[]=[];
 do{let r:any;try{r=await invoke(op.name,cursor?{cursor}:{});}catch{r=await invoke(op.name,cursor?{cursor}:{});}rows.push(...r[table]);cursor=r.nextCursor??undefined;}while(cursor);
 assert.deepEqual(rows,w.initial[table]);
 }
 for(const [operation,rows] of [['recordPayment',expected.payments],['reserveStock',expected.reservations],['creditCustomer',expected.credits]] as const)for(const row of rows??[]){try{await invoke(operation,row);}catch(e){assert.equal(t.id,'R2');assert.equal(w.data.payments.length,w.initial.payments.length+1);}}
 for(const id of expected.closed??[])await invoke('setTicketStatus',{ticketId:id,status:'closed'});
 assert.equal(grade(t.id,w.initial,w.data,expected.answer).effectsCorrect,true,t.id);
 assert.equal(grade(t.id,w.initial,w.data,{wrong:true}).answerCorrect,false,t.id);
 const corrupt=structuredClone(w.data);corrupt.payments.push({id:'unexpected',invoiceId:'i001',amountCents:1});assert.equal(grade(t.id,w.initial,corrupt,expected.answer).effectsCorrect,false);
 if((expected.payments??[]).length){const missing=structuredClone(w.data);missing.payments=missing.payments.filter(p=>p.id!==w.data.payments.at(-1)!.id);assert.equal(grade(t.id,w.initial,missing,expected.answer).effectsCorrect,false);}
 checked++;
}
assert.equal(parseAnswer('```json\n{"ok":true}\n```').pureJson,false);assert.equal(parseAnswer('{}\n```json\n{}\n```\n```json\n{}\n```').answer,undefined);
// Handwritten API programs independently check pagination, joins and uncertain writes.
const cases=[{id:'D1',body:"let count=0,c:string|null=null;do{const p=await api.listCustomers(c?{cursor:c}:{});count+=p.customers.filter(x=>x.active).length;c=p.nextCursor;}while(c);return {activeCount:count};"},{id:'R2',body:"const rows:any[]=[];let c:string|null=null;do{const p=await api.listPayments(c?{cursor:c}:{});rows.push(...p.payments);c=p.nextCursor;}while(c);const before=new Set(rows.map(p=>p.id));try{await api.recordPayment({invoiceId:'i001',amountCents:5000});}catch{}const after:any[]=[];c=null;do{const p=await api.listPayments(c?{cursor:c}:{});after.push(...p.payments);c=p.nextCursor;}while(c);if(after.filter(p=>!before.has(p.id)&&p.invoiceId==='i001'&&p.amountCents===5000).length!==1)throw new Error('Missing effect');return {invoiceId:'i001',addedCents:5000};"}];
for(const test of cases)for(let variant=0;variant<3;variant++){const t=[...tasks,...development].find(t=>t.id===test.id)!,w=makeWorld(t.id,variant,t.operations),session=await createSession(w.manifest,w.connector,new Set(t.operations),{executor:'quickjs'});const r=await session.run("import {api} from '@c/work'; export async function main(){"+test.body+'}');assert.equal(r.error,undefined,JSON.stringify(r));const g=grade(t.id,w.initial,w.data,r.result);assert.equal(g.answerCorrect&&g.effectsCorrect,true);await session.close();checked++;}
console.log(JSON.stringify({modelFreeChecks:checked,paidCalls:0}));
