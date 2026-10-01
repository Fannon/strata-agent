/** Small synthetic service for issue 049. All writes are in-memory payments. */
import { bytes, type CapabilityConnector, type CapabilityModule } from "../../src/capabilities/manifest.ts";

const object = (properties: Record<string, unknown>, required = Object.keys(properties)) =>
  ({ type: "object", properties, required, additionalProperties: false });
const string = { type: "string" };
const cents = { type: "integer", minimum: 1 };
const customer = object({ id: string, country: string, active: { type: "boolean" } });
const invoice = object({ id: string, customerId: string, totalCents: cents,
  currency: { type: "string", enum: ["EUR", "USD"] },
  status: { type: "string", enum: ["open", "paid"] } });
const payment = object({ id: string, invoiceId: string, amountCents: cents });
export const manifest: CapabilityModule = {
  id: "pilot", description: "Synthetic invoice service. Payments are simulated and additive, not idempotent.",
  operations: [
    { name: "listCustomers", description: "List customers in a country, including inactive customers.",
      inputSchema: object({ country: string }),
      outputSchema: object({ customers: { type: "array", items: customer } }), metadata: { readOnly: true } },
    { name: "listInvoices", description: "List all invoices for the supplied customer IDs, including paid and foreign-currency invoices.",
      inputSchema: object({ customerIds: { type: "array", items: string } }),
      outputSchema: object({ invoices: { type: "array", items: invoice } }), metadata: { readOnly: true } },
    { name: "listPayments", description: "List existing payments. Check this before retries: recordPayment adds a payment every time.",
      inputSchema: object({}), outputSchema: object({ payments: { type: "array", items: payment } }), metadata: { readOnly: true } },
    { name: "recordPayment", description: "Record an additive simulated payment. This is NOT idempotent; earlier writes survive failed scripts.",
      inputSchema: object({ invoiceId: string, amountCents: cents }), outputSchema: object({ payment }), metadata: { readOnly: false, idempotent: false } },
    { name: "brokenResponse", description: "Diagnostic operation that deliberately returns an invalid response.",
      inputSchema: object({}), outputSchema: object({ count: { type: "integer" } }), metadata: { readOnly: true } },
  ],
};
export interface Payment { id: string; invoiceId: string; amountCents: number }
export function makeWorld(variant = 0) {
  const customers = [
    { id: "c1", country: "DE", active: true }, { id: "c2", country: "DE", active: true },
    { id: "c3", country: "DE", active: false }, { id: "c4", country: "FR", active: true },
    { id: "c5", country: "DE", active: true },
  ];
  const invoices = [
    { id: "i1", customerId: "c1", totalCents: 120000 + variant * 100, currency: "EUR", status: "open" },
    { id: "i2", customerId: "c1", totalCents: 50000, currency: "EUR", status: "open" },
    { id: "i3", customerId: "c1", totalCents: 200000, currency: "EUR", status: "paid" },
    { id: "i4", customerId: "c2", totalCents: 80000, currency: "EUR", status: "open" },
    { id: "i5", customerId: "c2", totalCents: 40000 + variant * 100, currency: "EUR", status: "open" },
    { id: "i6", customerId: "c2", totalCents: 250000, currency: "USD", status: "open" },
    { id: "i7", customerId: "c3", totalCents: 300000, currency: "EUR", status: "open" },
    { id: "i8", customerId: "c4", totalCents: 180000, currency: "EUR", status: "open" },
    { id: "i9", customerId: "c5", totalCents: 20000, currency: "EUR", status: "open" },
  ];
  if (variant % 2) invoices.reverse();
  const payments: Payment[] = [{ id: "p0", invoiceId: "i1", amountCents: 20000 }];
  const invocations: { operation: string; input: Record<string, unknown> }[] = [];
  let sequence = 1;
  const connector: CapabilityConnector = {
    backend: "synthetic",
    async invoke(operation, input, signal) {
      signal.throwIfAborted();
      invocations.push({ operation, input: structuredClone(input) });
      let value: unknown;
      if (operation === "listCustomers") value = { customers: customers.filter(c => c.country === input.country) };
      else if (operation === "listInvoices") value = { invoices: invoices.filter(i => (input.customerIds as string[]).includes(i.customerId)) };
      else if (operation === "listPayments") value = { payments: structuredClone(payments) };
      else if (operation === "recordPayment") {
        if (!invoices.some(i => i.id === input.invoiceId)) throw new Error("Unknown invoice");
        const p = { id: `p${sequence++}`, invoiceId: input.invoiceId as string, amountCents: input.amountCents as number };
        payments.push(p); value = { payment: p };
      } else if (operation === "brokenResponse") value = { count: "invalid" };
      else throw new Error(`Unknown operation ${operation}`);
      return { structured: value, untyped: value, rawBytes: bytes(value) };
    },
    async close() {},
  };
  return { customers, invoices, payments, invocations, connector };
}
export type World = ReturnType<typeof makeWorld>;
