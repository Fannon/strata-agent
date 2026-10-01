/** Resettable synthetic business services. No controller answers live here. */
import { bytes, DeniedError, type CapabilityModule, type CapabilityConnector } from "../../src/capabilities/manifest.ts";

const str = { type: "string" }, num = { type: "integer", minimum: 0 }, bool = { type: "boolean" };
const en = (...values: string[]) => ({ type: "string", enum: values });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const arr = (items: unknown) => ({ type: "array", items });
const schemas = {
  customers: obj({ id: str, accountRef: str, country: en("DE", "FR", "US"), active: bool }),
  invoices: obj({ id: str, customerId: str, totalCents: num, currency: en("EUR", "USD", "GBP"), status: en("open", "paid", "void"), dueDate: str }),
  payments: obj({ id: str, invoiceId: str, amountCents: num }),
  orders: obj({ id: str, customerId: str, sku: str, quantity: num, status: en("pending", "shipped", "cancelled"), promisedDate: str, deliveredDate: { anyOf: [str, { type: "null" }] } }),
  products: obj({ sku: str, active: bool, packSize: num, priceCents: num }),
  stock: obj({ sku: str, availableUnits: num, protected: bool }),
  reservations: obj({ id: str, orderId: str, sku: str, units: num }),
  tickets: obj({ id: str, accountRef: str, status: en("open", "resolved", "closed"), priority: en("low", "high"), openedDate: str, budgetMinutes: num }),
  worklogs: obj({ ticketId: str, minutes: num, billable: bool }),
  rates: obj({ currency: en("EUR", "USD", "GBP"), numerator: num, denominator: num }),
  credits: obj({ id: str, customerId: str, reason: str, amountCents: num }),
};
type Row = Record<string, any>;
export function makeWorld(taskId: string, variant: number, enabled?: string[]) {
  const id = (prefix: string, n: number) => `${prefix}${String(n).padStart(3, "0")}`;
  const customers: Row[] = Array.from({ length: 48 }, (_, n) => ({ id: id("c", n + 1), accountRef: `acct:${String(n + 1).padStart(4, "0")}`, country: ["DE", "FR", "US"][n % 3], active: n % 5 !== 4 }));
  const invoices: Row[] = Array.from({ length: 192 }, (_, n) => ({ id: id("i", n + 1), customerId: customers[n % 48]!.id, totalCents: 15000 + ((n * 7919 + variant * 331) % 140000), currency: ["EUR", "USD", "GBP"][Math.floor(n / 48) % 3], status: n % 7 === 6 ? "void" : n % 4 === 3 ? "paid" : "open", dueDate: `2026-09-${String(n % 28 + 1).padStart(2, "0")}` }));
  const payments: Row[] = invoices.filter((_, n) => n % 3 === 0).map((i, n) => ({ id: id("p", n + 1), invoiceId: i.id, amountCents: Math.floor(i.totalCents / 3) }));
  if (variant === 0) payments[0]!.amountCents = 5000;
  const products: Row[] = Array.from({ length: 16 }, (_, n) => ({ sku: id("sku", n + 1), active: n % 5 !== 4, packSize: n % 4 + 1, priceCents: 199 + n * 157 + variant }));
  const stock: Row[] = products.map((p, n) => ({ sku: p.sku, availableUnits: 12 + n * 3 + variant, protected: n % 6 === 5 }));
  const orders: Row[] = Array.from({ length: 80 }, (_, n) => ({ id: id("o", n + 1), customerId: customers[n % 48]!.id, sku: products[n % 16]!.sku, quantity: n % 5 + 1, status: n % 5 === 4 ? "cancelled" : n % 3 === 2 ? "shipped" : "pending", promisedDate: `2026-09-${String(n % 20 + 1).padStart(2, "0")}`, deliveredDate: n % 3 === 2 ? `2026-09-${String(n % 20 + (n % 2 ? 3 : 1)).padStart(2, "0")}` : null }));
  const reservations: Row[] = orders.filter((o, n) => o.status === "pending" && n % 4 === 0).map((o, n) => ({ id: id("r", n + 1), orderId: o.id, sku: o.sku, units: o.quantity * products.find(p => p.sku === o.sku)!.packSize }));
  const tickets: Row[] = Array.from({ length: 48 }, (_, n) => ({ id: id("t", n + 1), accountRef: customers[(n * 7) % 48]!.accountRef, status: ["open", "resolved", "closed"][n % 3], priority: n % 4 === 0 ? "high" : "low", openedDate: `2026-09-${String(n % 28 + 1).padStart(2, "0")}`, budgetMinutes: 30 + n % 4 * 15 }));
  const worklogs: Row[] = tickets.flatMap((t, n) => [0, 1].map(k => ({ ticketId: t.id, minutes: 10 + (n * 11 + k * 7 + variant) % 50, billable: (n + k) % 3 !== 0 })));
  const rates: Row[] = [{ currency: "EUR", numerator: 1, denominator: 1 }, { currency: "USD", numerator: 9, denominator: 10 }, { currency: "GBP", numerator: 6, denominator: 5 }];
  const credits: Row[] = [{ id: "cr000", customerId: "c001", reason: "older-adjustment", amountCents: 500 }];
  const data = { customers, invoices, payments, products, stock, orders, reservations, tickets, worklogs, rates, credits };
  if (variant % 2) for (const rows of Object.values(data)) rows.reverse();
  const initial = structuredClone(data);
  const calls: { operation: string; input: Record<string, unknown>; effect?: Row; failed?: boolean }[] = [];
  const faults = new Set<string>();
  let serial = 1000;
  const operations: CapabilityModule["operations"] = Object.entries(schemas).map(([table, schema]) => ({
    name: `list${table[0]!.toUpperCase()}${table.slice(1)}`,
    description: `List ${table}. All rows, including inactive/closed records. Pagination: pass the returned nextCursor until null. Empty input starts the first page.`,
    inputSchema: obj({ cursor: str }, []),
    outputSchema: obj({ [table]: arr(schema), nextCursor: { anyOf: [str, { type: "null" }] } }), metadata: { readOnly: true },
  }));
  operations.push(
    { name: "recordPayment", description: "Add a payment; NOT idempotent. A failed reply can occur after the effect; inspect the payment ledger before retrying.", inputSchema: obj({ invoiceId: str, amountCents: { type: "integer", minimum: 1 } }), outputSchema: obj({ payment: schemas.payments }), metadata: { readOnly: false, idempotent: false } },
    { name: "reserveStock", description: "Reserve units for an order, reducing availableUnits. NOT idempotent. Protected stock is denied before effects; insufficient stock fails before effects.", inputSchema: obj({ orderId: str, sku: str, units: { type: "integer", minimum: 1 } }), outputSchema: obj({ reservation: schemas.reservations }), metadata: { readOnly: false, idempotent: false } },
    { name: "setTicketStatus", description: "Set a ticket status. Repeating the same status is idempotent.", inputSchema: obj({ ticketId: str, status: en("open", "resolved", "closed") }), outputSchema: obj({ ticket: schemas.tickets }), metadata: { readOnly: false, idempotent: true } },
    { name: "creditCustomer", description: "Add a customer credit with a reason. NOT idempotent; inspect existing credits before retrying.", inputSchema: obj({ customerId: str, reason: str, amountCents: { type: "integer", minimum: 1 } }), outputSchema: obj({ credit: schemas.credits }), metadata: { readOnly: false, idempotent: false } },
  );
  const manifest: CapabilityModule = { id: "work", description: "Resettable business-service fixture. Integer cents; order quantity is packs, stock/reservation units are individual units. All lists paginate. Dates are ISO calendar dates. accountRef and customer id are different keys.", operations: operations.filter(o => !enabled || enabled.includes(o.name)) };
  const connector: CapabilityConnector = {
    backend: "synthetic",
    async invoke(operation, input, signal) {
      signal.throwIfAborted();
      const call: typeof calls[number] = { operation, input: structuredClone(input) }; calls.push(call);
      try {
        if (taskId === "R1" && operation === "listStock" && !faults.has("read")) { faults.add("read"); throw new Error("Temporary stock service unavailable; no effect occurred. Retry is allowed."); }
        let value: unknown;
        if (operation.startsWith("list")) {
          const table = operation.slice(4).replace(/^./, c => c.toLowerCase()) as keyof typeof data;
          const cursor = input.cursor === undefined ? 0 : Number(input.cursor);
          if (!Number.isInteger(cursor) || cursor < 0) throw new Error("Invalid cursor");
          const page = data[table].slice(cursor, cursor + 24);
          value = { [table]: structuredClone(page), nextCursor: cursor + 24 < data[table].length ? String(cursor + 24) : null };
          if (taskId === "R4" && operation === "listProducts" && !faults.has("shape")) { faults.add("shape"); value = { products: [{ sku: "invalid", priceCents: "not-an-integer" }], nextCursor: null }; }
        } else if (operation === "recordPayment") {
          if (!invoices.some(i => i.id === input.invoiceId)) throw new Error("Unknown invoice");
          const row = { id: `p${serial++}`, invoiceId: input.invoiceId, amountCents: input.amountCents }; payments.push(row); call.effect = row; value = { payment: row };
          if (taskId === "R2" && !faults.has("write")) { faults.add("write"); throw new Error("Payment reply lost; outcome uncertain. Query existing payments before retrying."); }
        } else if (operation === "reserveStock") {
          const item = stock.find(p => p.sku === input.sku);
          if (!item || !orders.some(o => o.id === input.orderId && o.sku === input.sku)) throw new Error("Unknown order/stock");
          if (item.protected) throw new DeniedError("Protected stock; no reservation created");
          if (item.availableUnits < Number(input.units)) throw new Error("Insufficient stock; no reservation created");
          item.availableUnits -= Number(input.units);
          const row = { id: `r${serial++}`, orderId: input.orderId, sku: input.sku, units: input.units }; reservations.push(row); call.effect = row; value = { reservation: row };
        } else if (operation === "setTicketStatus") {
          const row = tickets.find(t => t.id === input.ticketId); if (!row) throw new Error("Unknown ticket");
          row.status = input.status; call.effect = { ticketId: input.ticketId, status: input.status }; value = { ticket: structuredClone(row) };
        } else if (operation === "creditCustomer") {
          if (!customers.some(c => c.id === input.customerId)) throw new Error("Unknown customer");
          const row = { id: `cr${serial++}`, customerId: input.customerId, reason: input.reason, amountCents: input.amountCents }; credits.push(row); call.effect = row; value = { credit: row };
        } else throw new Error(`Unknown operation ${operation}`);
        return { structured: value, untyped: value, rawBytes: bytes(value) };
      } catch (e) { call.failed = true; throw e; }
    },
    async close() {},
  };
  return { data, initial, calls, faults, manifest, connector };
}
export type World = ReturnType<typeof makeWorld>;
