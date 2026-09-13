import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { connectMcp } from "../capabilities/mcp/connector.ts";
import { connectCli, type CliOperation } from "../capabilities/cli/connector.ts";
import {
  loadIndex,
  searchCatalog,
  type CatalogEntry,
} from "../capabilities/catalog.ts";
import { parseDeclarationStyle, type DeclarationStyle } from "../capabilities/schemas.ts";
import { parseExecutor, type ExecutorKind } from "../runtime/executor.ts";
import { createSession } from "../session.ts";
import { connectRepo } from "../capabilities/repo/connector.ts";
import { fixtureSession, fixtureAllowed } from "../../examples/fixture.ts";
import { cliTwinConnection } from "../../examples/cli-twin.ts";

/**
 * Strict profile: direct-effect Pi tools blocked at the `tool_call` hook so a
 * typed-only arm cannot quietly fall back to shell/filesystem tools.
 * Exported for unit testing; the hook itself fires in the agent loop.
 */
export const strictBlockedTools = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "find",
  "grep",
  "ls",
]);
export function isStrictBlocked(toolName: string): boolean {
  return strictBlockedTools.has(toolName);
}
export function strictMode(): boolean {
  return process.env.STRATA_STRICT === "1";
}

type Session = Awaited<ReturnType<typeof createSession>>;
type AllowFor = (id: string) => ReadonlySet<string> | undefined;

const catalogDir = () =>
  fileURLToPath(new URL("../../catalog/", import.meta.url));
const twinScript = () =>
  fileURLToPath(new URL("../../test/fixture-cli/cli.ts", import.meta.url));

/** Build a live connector for a catalog entry (the sanctioned execution point).\n * Only cli-twin-backed entries are supported; anything else fails clearly. */
async function buildEntryConnector(entry: CatalogEntry) {
  if (entry.meta.transport?.kind !== "cli-twin")
    throw new Error(
      `Capability \"${entry.meta.id}\" uses unsupported transport ` +
        `\"${entry.meta.transport?.kind ?? "(none)"}\"; only cli-twin is supported`,
    );
  const module = (await import(pathToFileURL(entry.file).href)) as {
    bindings?: Record<string, (input: Record<string, unknown>) => string[]>;
  };
  const operations: Record<string, CliOperation> = {};
  for (const op of entry.meta.operations) {
    const toArgs = module.bindings?.[op.name];
    if (typeof toArgs !== "function")
      throw new Error(
        `Catalog entry \"${entry.meta.id}\" has no binding for operation \"${op.name}\"`,
      );
    operations[op.name] = {
      ...(op.description ? { description: op.description } : {}),
      inputSchema: op.inputSchema,
      ...(op.outputSchema ? { outputSchema: op.outputSchema } : {}),
      toArgs,
    };
  }
  return connectCli(
    entry.meta.id,
    { command: process.execPath, args: [twinScript()] },
    operations,
  );
}

function refuse(id: string): never {
  throw new Error(
    `Capability \"${id}\" is not in the configured allowlist; loading it would grant nothing.`,
  );
}

/** Build a session from parsed STRATA_CONFIG. Exported for testing. */
export async function sessionFromConfig(
  config: unknown,
  index?: CatalogEntry[],
  executor: ExecutorKind = "quickjs",
  declarations: DeclarationStyle = "full",
): Promise<{ session: Session; allowFor: AllowFor; initialIds: string[] }> {
  if (!config || typeof config !== "object")
    throw new Error("STRATA_CONFIG must contain an object");
  const record = config as Record<string, unknown>;
  if (record.transport === "catalog") {
    const { preload, allow } = record;
    if (
      !Array.isArray(preload) ||
      !preload.length ||
      !preload.every((s) => typeof s === "string")
    )
      throw new Error(
        'STRATA_CONFIG catalog requires preload: string[] with at least one entry id',
      );
    if (
      !allow ||
      typeof allow !== "object" ||
      Array.isArray(allow) ||
      Object.values(allow).some(
        (ops) => !Array.isArray(ops) || !ops.every((s) => typeof s === "string"),
      )
    )
      throw new Error(
        "STRATA_CONFIG catalog requires allow: { [capabilityId]: string[] }",
      );
    const entries = index ?? (await loadIndex(catalogDir()));
    const byId = new Map(entries.map((entry) => [entry.meta.id, entry]));
    const allowMap = allow as Record<string, string[]>;
    const allowFor: AllowFor = (id) =>
      allowMap[id] ? new Set(allowMap[id]) : undefined;
    const ids = [...new Set(preload)];
    let session: Session | undefined;
    const loaded: string[] = [];
    for (const id of ids) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`Unknown catalog entry \"${id}\"`);
      const allowed = allowFor(id);
      if (!allowed) {
        refuse(id);
      }
      const built = await buildEntryConnector(entry);
      try {
        if (!session) {
          session = await createSession(built.manifest, built.connector, allowed!, { executor, declarations });
        } else {
          await session.load(built.manifest, built.connector, allowed!);
        }
        loaded.push(id);
      } catch (error) {
        await built.connector.close();
        throw error;
      }
    }
    return { session: session!, allowFor, initialIds: loaded };
  }
  if (record.transport === "cli-twin") {
    if (
      !Array.isArray(record.allow) ||
      !record.allow.every((a) => typeof a === "string")
    )
      throw new Error("STRATA_CONFIG cli-twin requires allow: string[]");
    const { manifest, connector } = await cliTwinConnection();
    try {
      const session = await createSession(
        manifest,
        connector,
        new Set(record.allow),
        { executor, declarations },
      );
      return {
        session,
        allowFor: () => new Set(record.allow as string[]),
        initialIds: ["cli"],
      };
    } catch (error) {
      await connector.close();
      throw error;
    }
  }
  if (record.transport === "repo") {
    const { root, allow, maxReadBytes, maxMatches, maxFilesScanned } =
      record as Record<string, unknown>;
    if (
      typeof root !== "string" ||
      !Array.isArray(allow) ||
      !allow.every((a) => typeof a === "string")
    )
      throw new Error(
        "STRATA_CONFIG repo requires root: string, allow: string[]",
      );
    const { manifest, connector } = await connectRepo({
      root: root as string,
      ...(typeof maxReadBytes === "number" ? { maxReadBytes } : {}),
      ...(typeof maxMatches === "number" ? { maxMatches } : {}),
      ...(typeof maxFilesScanned === "number" ? { maxFilesScanned } : {}),
    });
    try {
      const session = await createSession(
        manifest,
        connector,
        new Set(allow as string[]),
        { executor, declarations },
      );
      return {
        session,
        allowFor: () => new Set(allow as string[]),
        initialIds: ["repo"],
      };
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
    const session = await createSession(manifest, connector, new Set(allow), { executor, declarations });
    return {
      session,
      allowFor: () => new Set(allow as string[]),
      initialIds: [id as string],
    };
  } catch (error) {
    await connector.close();
    throw error;
  }
}

/** Trusted operator configuration, read once at session startup.
 * An unset, empty or whitespace-only STRATA_CONFIG selects the deterministic fixture. */
async function configuredSession(index: CatalogEntry[]) {
  // Opt-in engine selection; an invalid value fails session startup loudly.
  const executor = parseExecutor(process.env.STRATA_EXECUTOR);
  // Opt-in declaration presentation for the 004 experiment; same loud failure.
  const declarations = parseDeclarationStyle(process.env.STRATA_DECLARATIONS);
  const raw = (process.env.STRATA_CONFIG ?? "").trim();
  if (!raw)
    return {
      session: await fixtureSession(executor, declarations),
      allowFor: () => fixtureAllowed,
      initialIds: ["fixture"],
    };
  return sessionFromConfig(JSON.parse(await readFile(raw, "utf8")), index, executor, declarations);
}

export default function strata(pi: ExtensionAPI) {
  let session: Session | undefined;
  let allowFor: AllowFor | undefined;
  let index: CatalogEntry[] = [];
  const loaded = new Set<string>();
  const loadedTexts = new Map<string, string>();
  let startupError: string | undefined;
  pi.on("tool_call", async (event) => {
    if (strictMode() && isStrictBlocked(event.toolName))
      return {
        block: true,
        reason: `STRATA_STRICT: ${event.toolName} is disabled; use typed_program with @c/repo instead.`,
      };
    return undefined;
  });
  pi.on("session_start", async () => {
    try {
      if (typeof Bun === "undefined")
        throw new Error("Strata requires Bun. Start with bun run pi.");
      index = await loadIndex(catalogDir());
      const configured = await configuredSession(index);
      session = configured.session;
      allowFor = configured.allowFor;
      loaded.clear();
      loadedTexts.clear();
      for (const id of configured.initialIds) loaded.add(id);
      startupError = undefined;
    } catch (error) {
      startupError = error instanceof Error ? error.message : String(error);
    }
  });
  pi.on("session_shutdown", async () => {
    const previous = session;
    session = undefined;
    allowFor = undefined;
    await previous?.close();
  });
  pi.on("before_agent_start", async (event) => ({
    systemPrompt:
      event.systemPrompt +
      "\n\nStrata typed_program accepts a complete TypeScript module. Import { api } from '@c/<capability>' (e.g. '@c/fixture'; '@cap/' works too) and export async function main() returning a JSON-serializable result. Only capability imports and pure computation are available in the default QuickJS executor. The opt-in direct-Bun executor (STRATA_EXECUTOR=bun) additionally leaves ambient host APIs reachable, so it measures cooperative API adherence rather than enforced containment. console.log is bounded. All capability calls pass through local policy and schema validation. Type errors execute no code. Aggregate large results before returning. Success returns only { result, program }; failures return repair fields (error, diagnostics, failed calls, logs). Fetch full logs/metrics with program_details(program) only when debugging. Further capabilities can be discovered with search_capabilities and added with load_capability; a loaded API appears as another @c/ module and its import block is returned by the load call.\n" +
      (session?.declarations ??
        `Unavailable: ${startupError ?? "not initialized"}`),
  }));
  const tool = (
    name: string,
    label: string,
    description: string,
    promptSnippet: string,
    parameters: Parameters<typeof pi.registerTool>[0]["parameters"],
    execute: (
      params: Record<string, unknown>,
      signal?: AbortSignal,
    ) => Promise<{ content: [{ type: "text"; text: string }]; details: object }>,
  ) =>
    pi.registerTool({
      name,
      label,
      description,
      promptSnippet,
      parameters,
      async execute(_id, params, signal) {
        return execute(params as Record<string, unknown>, signal);
      },
    });
  tool(
    "typed_program",
    "Typed program",
    "Typecheck and run a complete TypeScript module exporting main(). Success returns only { result, program }; failures return repair fields (error, diagnostics, failed calls, logs). Fetch full logs/metrics on demand with program_details. Fresh disposable worker per run; 5-second execution deadline. Engine is QuickJS by default, opt-in direct Bun via STRATA_EXECUTOR.",
    "Compose typed capability calls and process structured data in TypeScript",
    Type.Object({
      source: Type.String({
        description:
          "Complete TypeScript module with exported zero-argument main()",
        maxLength: 32768,
      }),
    }),
    async (params, signal) => {
      if (!session)
        throw new Error(
          `Typed runtime unavailable: ${startupError ?? "session not started"}`,
        );
      const report = await session.run(
        params.source as string,
        signal ? { signal } : {},
      );
      // Quiet success, loud error (031): content is result-only on ok so
      // logs/metrics stay out of model context; full metrics ride in details
      // for the benchmark trace without entering the prompt.
      const details = {
        program: report.program,
        outcome: report.metrics.outcome,
        metrics: report.metrics,
      };
      if (report.error) throw new Error(report.text);
      return {
        content: [{ type: "text" as const, text: report.text }],
        details,
      };
    },
  );
  tool(
    "program_details",
    "Program details",
    "Fetch logs and metrics for a finished typed_program by its program id (returned as `program` in every typed_program result). Use only when you need to debug a failure or inspect call counts; success results already contain the answer.",
    "Inspect logs and metrics for a finished program",
    Type.Object({
      program: Type.String({ description: "Program id, e.g. the 8-char session prefix plus :p1", maxLength: 64 }),
    }),
    async (params) => {
      if (!session)
        throw new Error(
          `Typed runtime unavailable: ${startupError ?? "session not started"}`,
        );
      const entry = session.details(params.program as string);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entry).slice(0, 23900) }],
        details: {},
      };
    },
  );
  tool(
    "search_capabilities",
    "Search capabilities",
    "Lexically search the local capability catalog (id, description, operations). Returns short descriptors; loading is separate. Use when the loaded @c/ modules lack an operation you need.",
    "Find a capability by keyword before loading it",
    Type.Object({
      query: Type.String({ description: "Keywords, e.g. bulk records", maxLength: 500 }),
      limit: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 10, default: 5 }),
      ),
    }),
    async (params) => {
      if (!index.length && !startupError)
        throw new Error("Capability catalog is not initialized");
      if (startupError && !session)
        throw new Error(`Typed runtime unavailable: ${startupError}`);
      const hits = searchCatalog(
        index,
        params.query as string,
        Math.min(10, Math.max(1, (params.limit as number | undefined) ?? 5)),
      ).map((hit) => ({
        id: hit.id,
        description: hit.description?.slice(0, 300),
        matchedOperations: hit.matchedOperations,
        loaded: loaded.has(hit.id),
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ results: hits }) }],
        details: {},
      };
    },
  );
  tool(
    "load_capability",
    "Load capability",
    "Load a catalog capability into this session by id (see search_capabilities). Returns its @c/ import block (@cap/ alias also works). Loading never grants invocation: calls still pass local policy and schema validation.",
    "Load a discovered capability into the typed session",
    Type.Object({
      id: Type.String({ description: "Catalog capability id", maxLength: 128 }),
    }),
    async (params, signal) => {
      // Capture the live session: shutdown may clear the outer binding while
      // buildEntryConnector awaits. Using the captured session lets load()
      // reject with its shutdown guard so the caller still closes the built
      // connector instead of leaking it on a discarded session.
      const current = session;
      const resolver = allowFor;
      if (!current || !resolver)
        throw new Error(
          `Typed runtime unavailable: ${startupError ?? "session not started"}`,
        );
      const id = params.id as string;
      const entry = index.find((candidate) => candidate.meta.id === id);
      if (!entry)
        throw new Error(
          `Unknown capability \"${id}\". Use search_capabilities to discover available capabilities.`,
        );
      const cached = loadedTexts.get(id);
      if (cached)
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                module: `@c/${id}`,
                operations: entry.meta.operations.map((op) => op.name),
                declarations: cached.slice(0, 4000),
              }),
            },
          ],
          details: {},
        };
      const allowed = resolver(id);
      if (!allowed) refuse(id);
      signal?.throwIfAborted();
      const built = await buildEntryConnector(entry);
      let text: string;
      try {
        signal?.throwIfAborted();
        text = await current.load(built.manifest, built.connector, allowed!, signal ? { signal } : undefined);
      } catch (error) {
        await built.connector.close();
        throw error;
      }
      // Ownership transferred to the captured session on success, so the
      // built connector must not be closed here. Skip stale bookkeeping when
      // shutdown/replacement cleared the outer binding mid-load: the text
      // belongs to the discarded session, not the live one.
      if (session !== current)
        throw new Error(
          `Session shut down or replaced during load of "${id}"; load discarded.`,
        );
      loaded.add(id);
      loadedTexts.set(id, text);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              module: `@c/${id}`,
              operations: entry.meta.operations.map((op) => op.name),
              declarations: text.slice(0, 4000),
            }),
          },
        ],
        details: {},
      };
    },
  );
}
