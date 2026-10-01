/** Model-free mechanism controls and stored-program feasibility, issue 049. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { makeWorld } from "./fixture.ts";
import { makeRuntime, policies } from "./runtime.ts";
import { moduleSource, tasks, grade } from "./protocol.ts";
const out = resolve(process.env.STRATA_CHECKING_OUT ?? ".work/checking-20260930");
const controls = [
  { id: "valid", source: moduleSource("return (await api.listCustomers({country:'DE'})).customers.map(c=>c.id);"),
    assess: (r: any) => JSON.stringify(r.result) === '["c1","c2","c3","c5"]' },
  { id: "invalid-argument", source: moduleSource("return api.listCustomers({county:'DE'});"), assess: (r: any) => !!r.error },
  { id: "partial-effect", source: tasks["repair-partial"].seed!, assess: (r: any) => !!r.error },
  { id: "silent-wrong-output", source: tasks["repair-silent"].seed!, assess: (r: any) => r.metrics.outcome === "compile-error" || JSON.stringify(r.result) === '{"invoiceIds":[]}' },
  { id: "dead-branch", source: moduleSource("if(false){await api.recordPayment({invoiceId:'i1',amountCents:'bad'});} return 42;"),
    assess: (r: any) => r.metrics.outcome === "compile-error" || r.result === 42 },
  { id: "wrong-business-rule", source: moduleSource("return {customers:[]};"), assess: (r: any) => r.metrics.outcome === "ok" },
  { id: "response-contract", source: moduleSource("return api.brokenResponse({});"), assess: (r: any) => r.metrics.calls[0]?.failure === "output" },
];
const results: unknown[] = [];
for (const control of controls) for (const policy of policies) {
  const world = makeWorld(), runtime = await makeRuntime(world, policy);
  try {
    const r = await runtime.run(control.source);
    if (!control.assess(r)) throw new Error(`Unexpected control: ${control.id}/${policy}`);
    results.push({ control: control.id, policy, outcome: r.metrics.outcome, diagnostics: r.metrics.diagnostics,
      result: r.result, compileMs: r.metrics.compileMs, executionMs: r.metrics.executionMs,
      calls: r.metrics.calls, addedPayments: world.payments.length - 1 });
  } finally { runtime.close(); }
}
// A stored workflow versus the same unchecked script, on reordered/changed data.
// No retrieval, adaptation or model-cost benefit is claimed by this manual replay.
const stored = moduleSource(`
  const {customers}=await api.listCustomers({country:'DE'});
  const active=customers.filter(c=>c.active).map(c=>c.id);
  const {invoices}=await api.listInvoices({customerIds:active});
  const selected=invoices.filter(i=>i.currency==='EUR'&&i.status==='open');
  return {customers:active.sort().map(customerId=>{
    const rows=selected.filter(i=>i.customerId===customerId);
    return {customerId,totalCents:rows.reduce((n,i)=>n+i.totalCents,0),invoiceIds:rows.map(i=>i.id).sort()};
  }).filter(c=>c.totalCents>100000)};
`);
const replays: unknown[] = [];
for (const policy of ["always", "never"] as const) for (let variant = 0; variant < 5; variant++) {
  const world = makeWorld(variant), runtime = await makeRuntime(world, policy);
  try {
    const r = await runtime.run(stored);
    const g = grade("aggregate", makeWorld(variant), r.result, world.payments);
    if (!g.answerCorrect || !g.effectsCorrect || r.error) throw new Error("Stored replay mismatch");
    replays.push({policy,variant,...g,compileMs:r.metrics.compileMs,executionMs:r.metrics.executionMs});
  } finally { runtime.close(); }
}
await mkdir(out,{recursive:true});
await writeFile(resolve(out,"probe.json"),JSON.stringify({controls:results,replays},null,2));
console.log(JSON.stringify({controls:results.length,storedReplays:replays.length,allExpected:true}));
