import type { CapabilityConnector, CapabilityModule } from "../manifest.ts";
import { bytes } from "../manifest.ts";

export interface CliOperation {
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** Map validated input to an argument array. Never a shell string. */
  toArgs: (input: Record<string, unknown>) => string[];
}

export interface CliParameters {
  command: string;
  args?: string[];
}

/** Build a protocol-independent manifest from CLI operation definitions. */
export function cliManifest(
  id: string,
  operations: Record<string, CliOperation>,
): CapabilityModule {
  return {
    id,
    operations: Object.entries(operations).map(
      ([name, op]) => ({
        name,
        ...(op.description ? { description: op.description } : {}),
        inputSchema: op.inputSchema,
        ...(op.outputSchema ? { outputSchema: op.outputSchema } : {}),
      }),
    ),
  };
}

/**
 * Process-based connector: typed input becomes an argv array, stdout must be
 * pure JSON, diagnostics go to stderr. Like the MCP connector, stdout is
 * materialized in host memory before delivery (see issue 005/007).
 */
export async function connectCli(
  id: string,
  parameters: CliParameters,
  operations: Record<string, CliOperation>,
) {
  const manifest = cliManifest(id, operations);
  let spawned = 0;
  const connector: CapabilityConnector = {
    async invoke(operation, input, signal) {
      const op = operations[operation];
      if (!op) throw new Error(`unknown CLI operation ${operation}`);
      let argv: string[];
      try {
        argv = op.toArgs(input);
      } catch (error) {
        throw new Error(
          `argument mapping failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      let child;
      try {
        child = Bun.spawn(
          [parameters.command, ...(parameters.args ?? []), ...argv],
          { stdout: "pipe", stderr: "pipe" },
        );
      } catch (error) {
        throw new Error(
          `spawn failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      spawned++;
      const kill = () => {
        try {
          child.kill();
        } catch {
          // Already exited; nothing to do.
        }
      };
      if (signal.aborted) kill();
      signal.addEventListener("abort", kill, { once: true });
      try {
        const [out, err, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        signal.throwIfAborted();
        if (code !== 0)
          throw new Error(`exit ${code}: ${(err || "no stderr").slice(0, 500)}`);
        const rawBytes = bytes(out);
        let parsed: unknown;
        try {
          parsed = JSON.parse(out);
        } catch {
          throw new Error(`invalid JSON output (${rawBytes} bytes)`);
        }
        return {
          structured: parsed,
          untyped: { stdout: out },
          rawBytes,
        };
      } finally {
        signal.removeEventListener("abort", kill);
      }
    },
    close: async () => {},
  };
  return { manifest, connector, spawned: () => spawned };
}
