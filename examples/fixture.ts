import { fileURLToPath } from 'node:url';
import { connectMcp } from '../src/capabilities/mcp/connector.ts';
import { createSession } from '../src/session.ts';

export const fixtureAllowed = new Set(['customers', 'invoices', 'untyped', 'records', 'broken', 'stats', 'slow']);
export async function fixtureConnection() {
  return connectMcp('fixture', { command: process.execPath, args: [fileURLToPath(new URL('../test/fixture-mcp/server.ts', import.meta.url))] });
}
export async function fixtureSession() {
  const { manifest, connector } = await fixtureConnection();
  try { return await createSession(manifest, connector, fixtureAllowed); }
  catch (error) { await connector.close(); throw error; }
}
