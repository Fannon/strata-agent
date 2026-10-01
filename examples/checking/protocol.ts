/** Controller-owned grading; never import this module in the Pi extension. */
import { isDeepStrictEqual } from "node:util";
import type { World } from "./fixture.ts";
export type Task = "aggregate" | "reconcile" | "repair-partial" | "repair-silent";
export const moduleSource = (body: string) => `import { api } from '@c/pilot';\nexport async function main() { ${body} }`;
export const tasks: Record<Task, { ask: string; seed?: string }> = {
  aggregate: { ask: "For active DE customers, select open EUR invoices. Return only customers whose combined selected total exceeds 100000 cents. Return exactly {customers:[{customerId,totalCents,invoiceIds}]}, sorting customers by customerId and invoiceIds lexically. Do not record payments." },
  reconcile: { ask: "For every open EUR invoice belonging to active DE customers whose individual totalCents is at least 100000, record exactly its unpaid remainder, accounting for all existing payments. Never duplicate payments. Return exactly {payments:[{invoiceId,amountCents}]}, containing only payments you added, sorted by invoiceId. Do not pay other invoices." },
  "repair-partial": { ask: "Recover the prior attempt shown below. Ensure exactly one NEW payment of 10000 cents is recorded for i1 (in addition to any payment present before the prior attempt); earlier writes survive errors. Inspect existing payments before retrying a write. Return exactly {invoiceIds:[\"i1\"],paidCents:10000}. Use declarations and observed state to repair; do not duplicate the prior payment.",
    seed: moduleSource("await api.recordPayment({invoiceId:'i1',amountCents:10000}); const r=await api.listCustomers({country:'DE'}); return r.customerList.map(c=>c.id);") },
  "repair-silent": { ask: "Verify and repair the prior attempt below; successful execution alone does not establish correctness. Return exactly {invoiceIds:[...]}, containing all EUR invoices for c1 whose totalCents exceeds 100000, including paid invoices, with IDs sorted lexically. Do not record payments.",
    seed: moduleSource("const r=await api.listInvoices({customerIds:['c1']}); return {invoiceIds:r.invoices.filter(i=>i.currency==='EUR' && i.totlaCents>100000).map(i=>i.id).sort()};") },
};
export function expected(task: Task, world: World) {
  if (task === "repair-partial") return { invoiceIds: ["i1"], paidCents: 10000 };
  if (task === "repair-silent") return { invoiceIds: world.invoices.filter(i => i.customerId === "c1" && i.currency === "EUR" && i.totalCents > 100000).map(i => i.id).sort() };
  const ids = new Set(world.customers.filter(c => c.country === "DE" && c.active).map(c => c.id));
  const invoices = world.invoices.filter(i => ids.has(i.customerId) && i.currency === "EUR" && i.status === "open");
  if (task === "reconcile") return { payments: invoices.filter(i => i.totalCents >= 100000).map(i => ({ invoiceId: i.id,
    amountCents: i.totalCents - world.payments.filter(p => p.invoiceId === i.id).reduce((n,p) => n+p.amountCents,0) })).filter(p => p.amountCents > 0).sort((a,b) => a.invoiceId.localeCompare(b.invoiceId)) };
  return { customers: [...ids].sort().map(customerId => {
    const selected = invoices.filter(i => i.customerId === customerId);
    return { customerId, totalCents: selected.reduce((n,i) => n+i.totalCents,0), invoiceIds: selected.map(i => i.id).sort() };
  }).filter(c => c.totalCents > 100000) };
}
export function grade(task: Task, initial: World, answer: unknown, finalPayments: World["payments"]) {
  const wanted = expected(task, initial);
  const effects = finalPayments.slice(initial.payments.length).map(({ invoiceId, amountCents }) => ({ invoiceId, amountCents }))
    .sort((a,b) => a.invoiceId.localeCompare(b.invoiceId) || a.amountCents-b.amountCents);
  const wantedEffects = task === "repair-partial" ? [{ invoiceId: "i1", amountCents: 10000 }] : task === "reconcile" ? (wanted as { payments: unknown[] }).payments : [];
  return { answerCorrect: isDeepStrictEqual(answer, wanted), effectsCorrect: isDeepStrictEqual(effects, wantedEffects), effectCount: effects.length };
}
