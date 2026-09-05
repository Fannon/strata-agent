import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFile } from "node:fs/promises";
import { connectMcp } from "../capabilities/mcp/connector.ts";
import { createSession } from "../session.ts";
import { fixtureSession } from "../../examples/fixture.ts";
import { cliTwinConnection } from "../../examples/cli-twin.ts";

/** Build a session from parsed STRATA_CONFIG. Exported for testing.
 * An object with `transport: "cli-twin"` selects the benchmark CLI twin
 * (command/args are fixed to the twin script; only `allow` is operator input).
 * Any other object uses the MCP shape: `id, command, args: string[], allow: string[]`. */
export async function sessionFromConfig(config: unknown) {
  if (!config || typeof config !== "object")
    throw new Error("STRATA_CONFIG must contain an object");
  const record = config as Record<string, unknown>;
  if (record.transport === "cli-twin") {
    if (
      !Array.isArray(record.allow) ||
      !record.allow.every((a) => typeof a === "string")
    )
      throw new Error('STRATA_CONFIG cli-twin requires allow: string[]');
    const { manifest, connector } = await cliTwinConnection();
    try {
      return await createSession(
        manifest,
        connector,
        new Set(record.allow),
      );
    } catch (error) {
      await connector.close();
      throw error;
    }
  }
  const { id, command, args, allow } = record;
  if (
    typeof id !== "string" ||
    typeof command !== "string" ||
    !Array.isArray(args) ||
    !args.every((a) => typeof a === "string") ||
    !Array.isArray(allow) ||
    !allow.every((a) => typeof a === "string")
  )
    throw new Error(
      "STRATA_CONFIG requires id, command, args: string[], allow: string[]",
    );
  const { manifest, connector } = await connectMcp(id, { command, args });
  try {
    return await createSession(manifest, connector, new Set(allow));
  } catch (error) {
    await connector.close();
    throw error;
  }
}

/** Trusted operator configuration, read once at session startup.
 * An unset, empty or whitespace-only STRATA_CONFIG selects the deterministic fixture. */
async function configuredSession() {
  const raw = (process.env.STRATA_CONFIG ?? "").trim();
  if (!raw) return fixtureSession();
  return sessionFromConfig(JSON.parse(await readFile(raw, "utf8")));
}

export default function strata(pi: ExtensionAPI) {
  let session: Awaited<ReturnType<typeof createSession>> | undefined;
  let startupError: string | undefined;
  pi.on("session_start", async () => {
    try {
      if (typeof Bun === "undefined")
        throw new Error("Strata requires Bun. Start with bun run pi.");
      session = await configuredSession();
      startupError = undefined;
    } catch (error) {
      startupError = error instanceof Error ? error.message : String(error);
    }
  });
  pi.on("session_shutdown", async () => {
    const previous = session;
    session = undefined;
    await previous?.close();
  });
  pi.on("before_agent_start", async (event) => ({
    systemPrompt:
      event.systemPrompt +
      "\n\nStrata typed_program accepts a complete TypeScript module. Import { api } from the capability module below and export async function main() returning a JSON-serializable result. Only capability imports and pure computation are available. console.log is bounded. All capability calls pass through local policy and schema validation. Type errors execute no code. Aggregate large results before returning.\n" +
      (session?.declarations ??
        `Unavailable: ${startupError ?? "not initialized"}`),
  }));
  pi.registerTool({
    name: "typed_program",
    label: "Typed program",
    description:
      "Typecheck and run a complete TypeScript module exporting main(). Compose typed capabilities and return a small JSON result. Fresh execution state; 5-second execution deadline; output limited to 24 KB including diagnostics and metrics.",
    promptSnippet:
      "Compose typed capability calls and process structured data in TypeScript",
    parameters: Type.Object({
      source: Type.String({
        description:
          "Complete TypeScript module with exported zero-argument main()",
        maxLength: 32768,
      }),
    }),
    async execute(_id, { source }, signal) {
      if (!session)
        throw new Error(
          `Typed runtime unavailable: ${startupError ?? "session not started"}`,
        );
      const report = await session.run(source, { signal });
      if (report.error) throw new Error(report.text);
      return {
        content: [{ type: "text" as const, text: report.text }],
        details: {},
      };
    },
  });
}
