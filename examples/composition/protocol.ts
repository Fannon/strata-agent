/** Controller-owned task specifications and oracles. Never import in the Pi extension. */
import { isDeepStrictEqual } from "node:util";
import type { World } from "./fixture.ts";
type Data = World["data"];
const sort = (rows: any[], key: string) => rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
const paid = (d: Data, invoiceId: string) => d.payments.filter(p => p.invoiceId === invoiceId).reduce((n, p) => n + p.amountCents, 0);
const logged = (d: Data, id: string, billable = false) => d.worklogs.filter(w => w.ticketId === id && (!billable || w.billable)).reduce((n, w) => n + w.minutes, 0);
export interface Task { id: string; family: string; operations: string[]; ask: string; }
const task = (id: string, family: string, operations: string[], ask: string): Task => ({ id, family, operations, ask });
export const tasks: Task[] = [
  task("J1", "joins", ["listCustomers", "listInvoices", "listPayments"], "For active DE customers, sum unpaid remainders of open EUR invoices (max(0,totalCents minus all ledger payments)). Return customers whose sum exceeds 120000: {customers:[{customerId,unpaidCents,invoiceIds}]}. Include only positive-remainder invoice IDs. Sort customers and invoiceIds lexically."),
  task("J2", "joins", ["listCustomers", "listOrders"], "For active customers, count shipped orders with deliveredDate later than promisedDate. Return the top five customers by count descending, ties by customerId: {customers:[{customerId,lateOrders}]}. Omit zero-count customers."),
  task("J3", "joins", ["listCustomers", "listTickets", "listWorklogs"], "Find open tickets belonging to active customers whose total logged minutes (billable or not) exceed budgetMinutes. Join tickets.accountRef to customers.accountRef, not customer ID. Return {tickets:[{ticketId,customerId,overMinutes}]} sorted by ticketId."),
  task("J4", "joins", ["listOrders", "listProducts", "listStock", "listReservations"], "For active products, compute demand in individual units from pending orders minus units already reserved for each order, clamped at zero. Order quantity means packs: multiply by product.packSize. Compare combined demand per SKU with availableUnits (already net of existing reservations). Return only shortages {shortages:[{sku,shortUnits}]} sorted by sku. No writes."),
  task("A1", "aggregation", ["listCustomers", "listInvoices", "listRates"], "For paid invoices of active customers, convert each invoice total to EUR cents using floor(totalCents * numerator / denominator) for its currency. Aggregate by customer country. Return {countries:[{country,totalEurCents}]} sorted by country. Ignore payment-ledger status."),
  task("A2", "aggregation", ["listOrders", "listProducts"], "Across shipped orders, compute individual units (quantity packs * packSize) and gross value (units * priceCents, price is per individual unit) by SKU. Return top eight by units descending, ties sku: {products:[{sku,units,grossCents}]}."),
  task("A3", "aggregation", ["listInvoices", "listPayments"], "Classify every non-void invoice using ledger payments only: none if zero, partial if positive below total, covered if at least total. Return {currencies:[{currency,none,partial,covered}]} sorted by currency, with zero counts present. Invoice status paid does not imply the ledger is covered."),
  task("A4", "aggregation", ["listTickets", "listWorklogs"], "For each ticket compute billable logged minutes (zero if none). Group by priority. Return {priorities:[{priority,ticketCount,medianMinutes,p90Minutes}]} sorted by priority. Median averages the two middle values for even counts; P90 is nearest-rank sorted[ceil(0.9*N)-1]."),
  task("W1", "updates", ["listCustomers", "listInvoices", "listPayments", "recordPayment"], "For active DE customers, pay the positive unpaid remainder of each open EUR invoice with totalCents >=100000, accounting for all existing payments. Add exactly one payment per qualifying invoice; no others. Return {payments:[{invoiceId,amountCents}]} for payments added, sorted by invoiceId."),
  task("W2", "updates", ["listOrders", "listProducts", "listStock", "listReservations", "reserveStock"], "Process pending orders by orderId ascending. For active products and unprotected stock, skip orders with any existing reservation; reserve all requested units (quantity * packSize) if available, updating remaining stock after each reservation. Otherwise skip. Return newly created {reservations:[{orderId,sku,units}]} sorted by orderId."),
  task("W3", "updates", ["listCustomers", "listOrders", "listCredits", "creditCustomer"], "Give exactly one new 1000-cent credit with reason late-delivery to each active customer with a shipped order delivered after promisedDate, unless a credit with that exact reason already exists. Older unrelated credits do not satisfy it. Return new {credits:[{customerId,amountCents}]} sorted by customerId."),
  task("W4", "updates", ["listTickets", "listWorklogs", "setTicketStatus"], "Close only resolved tickets whose total logged minutes, billable or not, are at most budgetMinutes. Leave every other status unchanged. Return {closedTicketIds:[...]} sorted lexically."),
  task("U1", "contracts", ["listOrders", "listProducts"], "Value each pending order in integer cents. quantity is packs, packSize is units per pack, priceCents is price per individual unit. Return {orderValues:[{orderId,valueCents}]} sorted by orderId, including inactive products."),
  task("U2", "contracts", ["listInvoices"], "As of 2026-10-01 UTC, for open invoices with ageDays >=21 since dueDate, return {invoices:[{invoiceId,ageDays}]}, sorted by invoiceId. ageDays is elapsed calendar days, not day-of-month subtraction; include every currency."),
  task("U3", "contracts", ["listCustomers", "listTickets"], "Return unresolved (open OR resolved) high-priority tickets for active FR customers: {ticketIds:[...]} sorted lexically. tickets.accountRef matches customers.accountRef exactly, including its leading zeros; it is not customers.id."),
  task("U4", "contracts", ["listInvoices", "listPayments"], "Audit paid-status invoices whose ledger payments are below totalCents. Return {discrepancies:[{invoiceId,missingCents}]} sorted by invoiceId. Do not infer ledger coverage from invoice status and do not change state."),
  task("R1", "service-recovery", ["listStock"], "The stock service may fail temporarily before returning data; retry is allowed and makes no effect. Return unprotected SKUs with availableUnits <20: {skus:[...]} sorted lexically. Read all pages."),
  task("R2", "service-recovery", ["listPayments", "recordPayment"], "Add exactly one NEW 5000-cent payment for i001 in addition to all payments already present. Inspect the ledger before the first write; older matching payments do not satisfy this request. A payment reply may be lost AFTER the effect. Compare state before/after and never duplicate a write with an uncertain outcome. Return {invoiceId:'i001',addedCents:5000}."),
  task("R3", "service-recovery", ["reserveStock"], "Attempt to reserve one unit for order o006, SKU sku006; it is protected and must be denied before an effect. Then reserve exactly one unit for order o002, SKU sku002. Return {deniedSku:'sku006',reservedOrderId:'o002',units:1}. Do not reserve other stock."),
  task("R4", "service-recovery", ["listProducts", "listStock"], "The product service may return an invalid response once; retry is allowed. For active products with unprotected stock, sum availableUnits * priceCents (per individual unit). Return {totalCents,skuCount}. Read all pages; do not mutate state."),
];
export const development: Task[] = [
  task("D1", "development", ["listCustomers"], "Return {activeCount} counting active customers across all pages. No writes."),
  task("D2", "development", ["listInvoices"], "Return {invoiceIds:[...]} for the three largest non-void invoices by totalCents descending, ties invoiceId. No writes."),
  task("D3", "development", ["creditCustomer"], "Add exactly one 42-cent credit for c002, reason dev-probe. Return {customerId:'c002',amountCents:42}."),
  task("D4", "development", ["listOrders"], "Return {pendingPacks} summing quantity for all pending orders across all pages. No writes."),
];
export function oracle(id: string, d: Data): { answer: unknown; payments?: any[]; reservations?: any[]; credits?: any[]; closed?: string[] } {
  if (id === "D1") return { answer: { activeCount: d.customers.filter(c => c.active).length } };
  if (id === "D2") return { answer: { invoiceIds: [...d.invoices].filter(i => i.status !== "void").sort((a,b) => b.totalCents-a.totalCents || a.id.localeCompare(b.id)).slice(0,3).map(i=>i.id) } };
  if (id === "D3") return { answer: { customerId: "c002", amountCents: 42 }, credits: [{ customerId: "c002", reason: "dev-probe", amountCents: 42 }] };
  if (id === "D4") return { answer: { pendingPacks: d.orders.filter(o=>o.status==="pending").reduce((n,o)=>n+o.quantity,0) } };
  if (id === "J1") return { answer: { customers: sort(d.customers.filter(c=>c.active&&c.country==="DE").map(c=>{
    const selected=d.invoices.filter(i=>i.customerId===c.id&&i.currency==="EUR"&&i.status==="open"&&i.totalCents>paid(d,i.id));
    return {customerId:c.id,unpaidCents:selected.reduce((n,i)=>n+i.totalCents-paid(d,i.id),0),invoiceIds:selected.map(i=>i.id).sort()};
  }).filter(c=>c.unpaidCents>120000),"customerId") } };
  if (id === "J2") return {answer:{customers:d.customers.filter(c=>c.active).map(c=>({customerId:c.id,lateOrders:d.orders.filter(o=>o.customerId===c.id&&o.status==="shipped"&&o.deliveredDate>o.promisedDate).length})).filter(c=>c.lateOrders>0).sort((a,b)=>b.lateOrders-a.lateOrders||a.customerId.localeCompare(b.customerId)).slice(0,5)}};
  if (id === "J3") return {answer:{tickets:sort(d.tickets.filter(t=>t.status==="open"&&logged(d,t.id)>t.budgetMinutes&&d.customers.some(c=>c.accountRef===t.accountRef&&c.active)).map(t=>({ticketId:t.id,customerId:d.customers.find(c=>c.accountRef===t.accountRef)!.id,overMinutes:logged(d,t.id)-t.budgetMinutes})),"ticketId")}};
  if (id === "J4") return {answer:{shortages:sort(d.products.filter(p=>p.active).map(p=>{
    const demand=d.orders.filter(o=>o.status==="pending"&&o.sku===p.sku).reduce((n,o)=>n+Math.max(0,o.quantity*p.packSize-d.reservations.filter(r=>r.orderId===o.id).reduce((a,r)=>a+r.units,0)),0);
    return {sku:p.sku,shortUnits:demand-d.stock.find(s=>s.sku===p.sku)!.availableUnits};
  }).filter(s=>s.shortUnits>0),"sku")}};
  if (id === "A1") return {answer:{countries:["DE","FR","US"].map(country=>({country,totalEurCents:d.invoices.filter(i=>i.status==="paid"&&d.customers.some(c=>c.id===i.customerId&&c.country===country&&c.active)).reduce((n,i)=>{const r=d.rates.find(r=>r.currency===i.currency)!;return n+Math.floor(i.totalCents*r.numerator/r.denominator);},0)}))}};
  if (id === "A2") return {answer:{products:d.products.map(p=>{const units=d.orders.filter(o=>o.sku===p.sku&&o.status==="shipped").reduce((n,o)=>n+o.quantity*p.packSize,0);return {sku:p.sku,units,grossCents:units*p.priceCents};}).filter(p=>p.units>0).sort((a,b)=>b.units-a.units||a.sku.localeCompare(b.sku)).slice(0,8)}};
  if (id === "A3") return {answer:{currencies:["EUR","GBP","USD"].map(currency=>{const row={currency,none:0,partial:0,covered:0};for(const i of d.invoices.filter(i=>i.currency===currency&&i.status!=="void")){const n=paid(d,i.id);row[n===0?"none":n<i.totalCents?"partial":"covered"]++;}return row;})}};
  if (id === "A4") return {answer:{priorities:["high","low"].map(priority=>{const values=d.tickets.filter(t=>t.priority===priority).map(t=>logged(d,t.id,true)).sort((a,b)=>a-b),n=values.length;return {priority,ticketCount:n,medianMinutes:(values[Math.floor((n-1)/2)]!+values[Math.ceil((n-1)/2)]!)/2,p90Minutes:values[Math.ceil(.9*n)-1]};})}};
  if (id === "W1") {const payments=sort(d.invoices.filter(i=>i.status==="open"&&i.currency==="EUR"&&i.totalCents>=100000&&d.customers.some(c=>c.id===i.customerId&&c.active&&c.country==="DE")).map(i=>({invoiceId:i.id,amountCents:Math.max(0,i.totalCents-paid(d,i.id))})).filter(p=>p.amountCents>0),"invoiceId");return {answer:{payments},payments};}
  if (id === "W2") {const available=new Map(d.stock.map(s=>[s.sku,s.availableUnits])),reservations:any[]=[];for(const o of sort(d.orders.filter(o=>o.status==="pending"),"id")){const p=d.products.find(p=>p.sku===o.sku)!,s=d.stock.find(s=>s.sku===o.sku)!,units=o.quantity*p.packSize;if(!p.active||s.protected||d.reservations.some(r=>r.orderId===o.id)||available.get(o.sku)!<units)continue;available.set(o.sku,available.get(o.sku)!-units);reservations.push({orderId:o.id,sku:o.sku,units});}return {answer:{reservations},reservations};}
  if (id === "W3") {const credits=sort(d.customers.filter(c=>c.active&&d.orders.some(o=>o.customerId===c.id&&o.status==="shipped"&&o.deliveredDate>o.promisedDate)&&!d.credits.some(r=>r.customerId===c.id&&r.reason==="late-delivery")).map(c=>({customerId:c.id,reason:"late-delivery",amountCents:1000})),"customerId");return {answer:{credits:credits.map(({reason,...c})=>c)},credits};}
  if (id === "W4") {const closed=d.tickets.filter(t=>t.status==="resolved"&&logged(d,t.id)<=t.budgetMinutes).map(t=>t.id).sort();return {answer:{closedTicketIds:closed},closed};}
  if (id === "U1") return {answer:{orderValues:sort(d.orders.filter(o=>o.status==="pending").map(o=>{const p=d.products.find(p=>p.sku===o.sku)!;return {orderId:o.id,valueCents:o.quantity*p.packSize*p.priceCents};}),"orderId")}};
  if (id === "U2") return {answer:{invoices:sort(d.invoices.filter(i=>i.status==="open").map(i=>({invoiceId:i.id,ageDays:Math.floor((Date.parse("2026-10-01")-Date.parse(i.dueDate))/86400000)})).filter(i=>i.ageDays>=21),"invoiceId")}};
  if (id === "U3") return {answer:{ticketIds:d.tickets.filter(t=>t.status!=="closed"&&t.priority==="high"&&d.customers.some(c=>c.accountRef===t.accountRef&&c.active&&c.country==="FR")).map(t=>t.id).sort()}};
  if (id === "U4") return {answer:{discrepancies:sort(d.invoices.filter(i=>i.status==="paid"&&paid(d,i.id)<i.totalCents).map(i=>({invoiceId:i.id,missingCents:i.totalCents-paid(d,i.id)})),"invoiceId")}};
  if (id === "R1") return {answer:{skus:d.stock.filter(s=>!s.protected&&s.availableUnits<20).map(s=>s.sku).sort()}};
  if (id === "R2") return {answer:{invoiceId:"i001",addedCents:5000},payments:[{invoiceId:"i001",amountCents:5000}]};
  if (id === "R3") return {answer:{deniedSku:"sku006",reservedOrderId:"o002",units:1},reservations:[{orderId:"o002",sku:"sku002",units:1}]};
  if (id === "R4") {const selected=d.stock.filter(s=>!s.protected&&d.products.some(p=>p.sku===s.sku&&p.active));return {answer:{totalCents:selected.reduce((n,s)=>n+s.availableUnits*d.products.find(p=>p.sku===s.sku)!.priceCents,0),skuCount:selected.length}};}
  throw new Error(`Unknown task ${id}`);
}
export function parseAnswer(text: string) {
  try { return { answer: JSON.parse(text), pureJson: true }; } catch {}
  const blocks=[...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  if(blocks.length===1){try{return {answer:JSON.parse(blocks[0]![1]!),pureJson:false};}catch{}}
  return { answer: undefined, pureJson: false };
}
export function grade(taskId: string, initial: Data, final: Data, answer: unknown) {
  const expected=oracle(taskId,initial),canonical=(rows:any[])=>rows.map(({id,...r})=>r).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const added=(key:"payments"|"reservations"|"credits")=>final[key].filter(r=>!initial[key].some(i=>i.id===r.id));
  const paymentsCorrect=isDeepStrictEqual(canonical(added("payments")),canonical(expected.payments??[]));
  const reservationsCorrect=isDeepStrictEqual(canonical(added("reservations")),canonical(expected.reservations??[]));
  const creditsCorrect=isDeepStrictEqual(canonical(added("credits")),canonical(expected.credits??[]));
  const wantedTickets=initial.tickets.map(t=>({...t,status:expected.closed?.includes(t.id)?"closed":t.status}));
  const wantedStock=initial.stock.map(s=>({...s,availableUnits:s.availableUnits-(expected.reservations??[]).filter(r=>r.sku===s.sku).reduce((n,r)=>n+r.units,0)}));
  const unchanged=(["customers","invoices","products","orders","worklogs","rates"] as const).every(k=>isDeepStrictEqual(initial[k],final[k]));
  const oldLedgerUnchanged=(["payments","reservations","credits"] as const).every(k=>initial[k].every(i=>isDeepStrictEqual(i,final[k].find(r=>r.id===i.id))));
  const effectsCorrect=paymentsCorrect&&reservationsCorrect&&creditsCorrect&&unchanged&&oldLedgerUnchanged&&isDeepStrictEqual(wantedTickets,final.tickets)&&isDeepStrictEqual(wantedStock,final.stock);
  return {answerCorrect:isDeepStrictEqual(answer,expected.answer),effectsCorrect,paymentsCorrect,reservationsCorrect,creditsCorrect,addedEffects:added("payments").length+added("reservations").length+added("credits").length};
}
