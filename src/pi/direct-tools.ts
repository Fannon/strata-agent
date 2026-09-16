/** Direct-tool reference arm for the 042 matched comparison (gate 4 pilot).
 *
 * Pi extension that exposes one Pi tool per allowed MCP operation from the
 * same STRATA_CONFIG backend (id/command/args/allow) the typed arm uses.
 * Validation parity is structural, not coincidental:
 * - input validated with the same `validator()` factory, always strict;
 * - output validated with the same factory + the shared 040 boundary
 *   setting (`compat.acceptNaiveDateTime` in STRATA_CONFIG; default
 *   strict; recorded per cell by the driver);
 * - failure categories mirror the broker (policy/input/output/transport,
 *   isError included) and nothing bypasses validation;
 * - per-call records (op, ok/failure, rawBytes, ms, destructive hint)
 *   append to STRATA_DIRECT_LOG (JSONL) for pilot accounting.
 *
 * Tool parameters are TypeBox converted from the operation input schemas
 * (closed converter below: the pinned manifest uses only these keywords).
 * Unconvertible subtrees fall back to Type.Unsafe; the execute path still
 * enforces the original schema, so the fallback only affects prompting.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { readFile, appendFile } from "node:fs/promises";
import { connectMcp } from "../capabilities/mcp/connector.ts";
import { validator } from "../capabilities/schemas.ts";
import type {
  CapabilityConnector,
  CapabilityModule,
  JsonSchema,
} from "../capabilities/manifest.ts";

type Schema = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Closed JSON-Schema -> TypeBox converter for manifest shapes. */
export function toTypeBox(schema: Schema): TSchema {
  const annotate = (t: TSchema): TSchema => {
    const description = str(schema.description);
    return description ? Type.Unsafe({ ...t, description }) : t;
  };
  if (Array.isArray(schema.enum)) {
    const values = schema.enum as unknown[];
    if (values.every((v) => typeof v === "string")) {
      const literal = Type.Union(values.map((v) => Type.Literal(v as string)));
      return annotate(literal);
    }
    return Type.Unsafe({});
  }
  if (Array.isArray(schema.anyOf)) {
    const opts = (schema.anyOf as Schema[]).map(toTypeBox);
    return annotate(opts.length === 1 ? opts[0] : Type.Union(opts));
  }
  const type = str(schema.type);
  if (type === undefined) return Type.Unsafe({});
  switch (type) {
    case "object": {
      const props = (schema.properties ?? {}) as Record<string, Schema>;
      const required = new Set(
        Array.isArray(schema.required) ? (schema.required as string[]) : [],
      );
      const out: Record<string, TSchema> = {};
      for (const [key, sub] of Object.entries(props)) {
        const converted = toTypeBox(sub);
        out[key] = required.has(key) ? converted : Type.Optional(converted);
      }
      return annotate(Type.Object(out));
    }
    case "array": {
      const items = schema.items as Schema | undefined;
      return annotate(items ? Type.Array(toTypeBox(items)) : Type.Array(Type.Unknown()));
    }
    case "string":
      return annotate(Type.String());
    case "integer":
      return annotate(Type.Integer());
    case "number":
      return annotate(Type.Number());
    case "boolean":
      return annotate(Type.Boolean());
    case "null":
      return annotate(Type.Null());
    default:
      return Type.Unsafe({});
  }
}

interface Compat {
  acceptNaiveDateTime?: boolean;
}

export default function directTools(pi: ExtensionAPI) {
  let connector: CapabilityConnector | undefined;
  let startupError: string | undefined;
  const logPath = (): string | undefined => {
    const p = process.env.STRATA_DIRECT_LOG;
    return p && p.length > 0 ? p : undefined;
  };
  pi.on("session_start", async () => {
    try {
      const file = process.env.STRATA_CONFIG;
      if (!file) throw new Error("STRATA_CONFIG is not set");
      const config = JSON.parse(await readFile(file, "utf8")) as {
        id?: unknown;
        command?: unknown;
        args?: unknown;
        allow?: unknown;
        compat?: Compat;
      };
      if (typeof config.id !== "string" || typeof config.command !== "string" ||
        !Array.isArray(config.args) || !Array.isArray(config.allow)) {
        throw new Error("STRATA_CONFIG must contain id/command/args/allow");
      }
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
      const connected = await connectMcp(config.id, {
        command: config.command,
        args: config.args as string[],
        env,
      });
      const manifest: CapabilityModule = connected.manifest;
      connector = connected.connector;
      const compat = config.compat?.acceptNaiveDateTime === true
        ? { acceptNaiveDateTime: true as const }
        : {};
      const allowed = new Set(config.allow as string[]);
      let calls = 0;
      for (const op of manifest.operations) {
        if (!allowed.has(op.name)) continue;
        const inputCheck = validator(op.inputSchema);
        const outputCheck = op.outputSchema
          ? validator(op.outputSchema as JsonSchema, compat)
          : undefined;
        const destructive = op.metadata?.destructive === true;
        pi.registerTool({
          name: op.name,
          label: op.name,
          description:
            `${op.description ?? op.name} Direct backend call (042 reference arm). ` +
            `Input and output are schema-validated like typed programs.` +
            (destructive ? ` DESTRUCTIVE operation.` : ``),
          promptSnippet: `Call ${op.name} directly`,
          parameters: toTypeBox(op.inputSchema as Schema),
          async execute(_id, params, signal) {
            const started = performance.now();
            const fail = async (failure: string, message: string): Promise<never> => {
              const record = {
                op: op.name, ok: false, failure,
                rawBytes: 0, ms: Math.round(performance.now() - started), destructive,
              };
              const lp = logPath();
              if (lp) await appendFile(lp, JSON.stringify(record) + "\n");
              throw new Error(`${manifest.id}.${op.name}: ${failure}: ${message}`);
            };
            if (calls >= 100) return fail("policy", "call limit exceeded (100)");
            calls++;
            const inputError = inputCheck(params as Record<string, unknown>);
            if (inputError) return fail("input", inputError);
            signal?.throwIfAborted();
            let result;
            try {
              result = await connector!.invoke(
                op.name, params as Record<string, unknown>, signal ?? AbortSignal.timeout(60000),
              );
            } catch (error) {
              return fail("transport", error instanceof Error ? error.message : String(error));
            }
            if (result.isError) return fail("transport", "capability returned isError");
            if (outputCheck) {
              const outputError = outputCheck(result.structured);
              if (outputError) return fail("output", outputError);
            }
            const record = {
              op: op.name, ok: true, rawBytes: result.rawBytes,
              ms: Math.round(performance.now() - started), destructive,
            };
            const lp = logPath();
            if (lp) await appendFile(lp, JSON.stringify(record) + "\n");
            return {
              content: [{ type: "text" as const, text: JSON.stringify(result.structured) }],
              details: record,
            };
          },
        });
      }
      startupError = undefined;
    } catch (error) {
      startupError = error instanceof Error ? error.message : String(error);
    }
  });
  pi.on("session_shutdown", async () => {
    const c = connector;
    connector = undefined;
    if (c) await c.close();
  });
  pi.on("before_agent_start", (event) => {
    if (startupError !== undefined) {
      return {
        systemPrompt: event.systemPrompt +
          `\n\nDirect backend unavailable: ${startupError}`,
      };
    }
    return undefined;
  });
}
