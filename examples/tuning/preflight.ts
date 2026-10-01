/** Model-free checks for helper inference/limits and independent holdout SQL answers. */
import assert from 'node:assert/strict';
import {Database} from 'bun:sqlite';
import {makeWorld} from './fixture.ts';
import {tasks,developmentTasks,oracle,grade} from './protocol.ts';
import {helperSource,modelDeclarations,recipe} from './variants.ts';
import {createSession} from '../../src/session.ts';
let checks=0;
for(let variant=4;variant<=6;variant++){
 const w=makeWorld('audit',variant),db=new Database(':memory:');
 for(const [table,rows] of Object.entries(w.initial)){const keys=Object.keys(rows[0]!);db.exec(`CREATE TABLE ${table} (${keys.map(k=>'"'+k+'"').join(',')})`);const q=db.prepare(`INSERT INTO ${table} VALUES (${keys.map(()=>'?').join(',')})`);for(const r of rows)q.run(...keys.map(k=>typeof r[k]==='boolean'?+r[k]:r[k]));}
 db.exec('CREATE VIEW balance AS SELECT i.*,COALESCE(p.paid,0) AS paid,MAX(0,i.totalCents-COALESCE(p.paid,0)) AS unpaid FROM invoices i LEFT JOIN (SELECT invoiceId,SUM(amountCents) AS paid FROM payments GROUP BY invoiceId) p ON p.invoiceId=i.id');
 const all=(sql:string)=>db.query(sql).all() as any[],first=(sql:string)=>all(sql)[0],answers:Record<string,unknown>={};
 answers.N1={countries:all("SELECT c.country,SUM(MIN(i.totalCents,i.paid)*r.numerator/r.denominator) AS coveredEurCents,SUM(i.unpaid*r.numerator/r.denominator) AS unpaidEurCents,SUM(i.paid>0 AND i.unpaid>0) AS partialCount FROM balance i JOIN customers c ON c.id=i.customerId JOIN rates r ON r.currency=i.currency WHERE c.active=1 AND i.status!='void' AND i.dueDate<='2026-09-15' GROUP BY c.country ORDER BY c.country")};
 const reservations:any[]=[];for(const o of all("SELECT o.id AS orderId,o.sku,MAX(0,o.quantity*p.packSize-COALESCE(r.units,0)) AS units FROM orders o JOIN products p ON p.sku=o.sku JOIN stock s ON s.sku=o.sku LEFT JOIN (SELECT orderId,SUM(units) AS units FROM reservations GROUP BY orderId) r ON r.orderId=o.id WHERE o.status='pending' AND p.active=1 AND s.protected=0 ORDER BY o.promisedDate,o.id")){const s=first(`SELECT availableUnits FROM stock WHERE sku='${o.sku}'`);if(!o.units||s.availableUnits<o.units)continue;reservations.push(o);db.prepare('UPDATE stock SET availableUnits=availableUnits-? WHERE sku=?').run(o.units,o.sku);}answers.N2={reservations};for(const s of w.initial.stock)db.prepare('UPDATE stock SET availableUnits=? WHERE sku=?').run(s.availableUnits,s.sku);
 answers.N3={credits:all("WITH logs AS (SELECT ticketId,SUM(CASE WHEN billable THEN minutes ELSE 0 END) AS mins FROM worklogs GROUP BY ticketId) SELECT c.id AS customerId,MIN(2000,50*SUM(MAX(0,COALESCE(l.mins,0)-t.budgetMinutes))) AS amountCents FROM customers c JOIN tickets t ON t.accountRef=c.accountRef LEFT JOIN logs l ON l.ticketId=t.id WHERE c.active=1 AND t.status='open' AND t.priority='high' AND NOT EXISTS(SELECT 1 FROM credits cr WHERE cr.customerId=c.id AND cr.reason='priority-overrun') GROUP BY c.id HAVING amountCents>0 ORDER BY c.id")};
 answers.N4={payments:all("WITH ranked AS (SELECT i.*,ROW_NUMBER() OVER(PARTITION BY i.customerId ORDER BY i.dueDate,i.id) AS rn FROM balance i JOIN customers c ON c.id=i.customerId WHERE c.active=1 AND c.country='FR' AND i.status='open' AND i.currency='EUR' AND i.unpaid>0) SELECT id AS invoiceId,MIN(20000,unpaid) AS amountCents FROM ranked WHERE rn=1 ORDER BY id")};
 answers.N5={products:all("WITH demand AS (SELECT p.sku,SUM(MAX(0,o.quantity*p.packSize-COALESCE(r.units,0))) AS neededUnits FROM products p JOIN orders o ON o.sku=p.sku LEFT JOIN (SELECT orderId,SUM(units) AS units FROM reservations GROUP BY orderId) r ON r.orderId=o.id WHERE o.status='pending' GROUP BY p.sku) SELECT p.sku,d.neededUnits,MIN(d.neededUnits,s.availableUnits) AS fulfillableUnits,MIN(d.neededUnits,s.availableUnits)*p.priceCents AS valueCents FROM products p JOIN stock s ON s.sku=p.sku JOIN demand d ON d.sku=p.sku WHERE p.active=1 AND s.protected=0 AND d.neededUnits>0 ORDER BY valueCents DESC,p.sku LIMIT 5")};
 answers.N6=first("SELECT p.sku,'c002' AS customerId,p.packSize*p.priceCents AS amountCents FROM products p JOIN stock s ON s.sku=p.sku WHERE p.active=1 AND s.protected=0 AND s.availableUnits>=15 ORDER BY p.priceCents,p.sku LIMIT 1");
 for(const t of tasks){assert.deepEqual(answers[t.id],oracle(t.id,w.initial).answer,t.id);checks++;}
 db.close();
 const session=await createSession(w.manifest,w.connector,new Set(w.manifest.operations.map(o=>o.name)));
 const source="import {api} from '@c/work';export async function main(){const rows=await collectPages(api.listInvoices,p=>p.invoices);return {count:rows.length};}";
 let r=await session.run(source+'\n'+helperSource);assert.equal(r.error,undefined,JSON.stringify(r));assert.deepEqual(r.result,{count:192});checks++;
 r=await session.run("import {api} from '@c/work';export async function main(){const rows=await collectPages(api.listInvoices,p=>p.invoices);const wrong=rows[0]!.invoiceId;await api.recordPayment({invoiceId:'i001',amountCents:1});return wrong;}\n"+helperSource);assert.equal(r.metrics.outcome,'compile-error');assert.equal(r.metrics.capabilityCalls,0);assert(r.metrics.diagnostics.some(d=>d.includes('TS2339')));checks++;
 r=await session.run("import {api} from '@c/work';export async function main(){"+recipe('listInvoices','invoices').split('is:\n')[1]!.split('\nThis is only')[0]!+"return {count:rows.length};}");assert.equal(r.error,undefined,JSON.stringify(r));assert.deepEqual(r.result,{count:192});checks++;
 const lean=modelDeclarations(session.declarations,true);assert(!lean.includes('declare module "@cap/work"'));assert(lean.includes('declare module "@c/work"'));assert(lean.length<session.declarations.length*.55);checks++;
 r=await session.run("export async function main(){return await collectPages(async (_input:{cursor?:string})=>({rows:[1],nextCursor:'same'}),p=>p.rows);}\n"+helperSource);assert(r.error?.includes('repeated cursor'));checks++;
 await session.close();
}
for(const t of [...tasks,...developmentTasks]){
 const w=makeWorld(t.id,4,t.operations),e=oracle(t.id,w.initial),final=structuredClone(w.initial);let id=9000;
 for(const key of ['payments','reservations','credits'] as const)for(const row of (e as any)[key]??[])final[key].push({id:'test'+id++,...row});
 for(const r of e.reservations??[])final.stock.find(s=>s.sku===r.sku)!.availableUnits-=r.units;
 assert(grade(t.id,w.initial,final,e.answer).effectsCorrect);assert(!grade(t.id,w.initial,final,{wrong:true}).answerCorrect);checks++;
 const corrupt=structuredClone(final);corrupt.payments.push({id:'unexpected',invoiceId:'i001',amountCents:1});assert(!grade(t.id,w.initial,corrupt,e.answer).effectsCorrect);checks++;
}
console.log(JSON.stringify({modelFreeChecks:checks,independentSqlAnswers:18,paidCalls:0}));
