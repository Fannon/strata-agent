import { fileURLToPath } from "node:url";
import { connectCli } from "../src/capabilities/cli/connector.ts";
import type { CliOperation } from "../src/capabilities/cli/connector.ts";
import { createSession } from "../src/session.ts";
import { meta, bindings } from "../catalog/cli-twin.ts";

/**
 * CLI twin session helpers. Operation schemas come from the catalog file's
 * statically-extractable `meta`; only the `bindings` (argv mappers) execute.
 * Twin parity with the MCP fixture is asserted in cli-connector.test.ts.
 */
export const cliTwinOperations: Record<string, CliOperation> = Object.fromEntries(
  meta.operations.map((op) => [
    op.name,
    {
      ...(op.description ? { description: op.description } : {}),
      inputSchema: op.inputSchema as Record<string, unknown>,
      ...(op.outputSchema ? { outputSchema: op.outputSchema as Record<string, unknown> } : {}),
      toArgs: bindings[op.name]!,
    },
  ]),
);

export const cliTwinAllowed = new Set(["customers", "invoices", "records"]);

export const cliTwinScript = fileURLToPath(
  new URL("../test/fixture-cli/cli.ts", import.meta.url),
);

export async function cliTwinConnection() {
  return connectCli(
    meta.id,
    { command: process.execPath, args: [cliTwinScript] },
    cliTwinOperations,
  );
}

export async function cliTwinSession(
  allowed: ReadonlySet<string> = cliTwinAllowed,
) {
  const { manifest, connector, spawned } = await cliTwinConnection();
  try {
    return {
      session: await createSession(manifest, connector, allowed),
      spawned,
    };
  } catch (error) {
    await connector.close();
    throw error;
  }
}
