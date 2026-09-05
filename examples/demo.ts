import { fixtureSession } from "./fixture.ts";
const session = await fixtureSession();
try {
  const composition = await session.run(`import { api } from '@cap/fixture';
export async function main() {
  const { customers } = await api.customers({ country: 'DE' });
  const { invoices } = await api.invoices({ customerIds: customers.map(c => c.id) });
  return invoices.filter(i => i.amount > 10000).map(i => ({ id: i.id, amount: i.amount }));
}`);
  console.log("Composition:", composition.text);
  const reduction = await session.run(`import { api } from '@cap/fixture';
export async function main() {
  const { records } = await api.records({ count: 10000 });
  return { total: records.length, selected: records.filter(r => r.score > 0.98).slice(0, 5).map(r => r.id) };
}`);
  console.log("Context reduction:", reduction.text);
  console.log(
    `Capability bytes / Pi bytes: ${reduction.metrics.rawCapabilityBytes} / ${reduction.metrics.bytesExposedToPi}`,
  );
} finally {
  await session.close();
}
