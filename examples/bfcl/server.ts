// BFCL record-all MCP server (issue 037).
//
// Serves one case's normalized tools over stdio, appends every invocation
// (name + arguments) as JSONL to a record file, and returns a canned
// `{ok: true}` payload. There is deliberately no backend: BFCL grades the
// CALL, so the server is a typed recording fixture, not a simulation.
// Usage: bun examples/bfcl/server.ts --tools <tools.json> --record <calls.jsonl>
import { parseArgs } from "node:util";
import { appendFile, readFile } from "node:fs/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const { values } = parseArgs({
  options: {
    tools: { type: "string" },
    record: { type: "string" },
  },
});
if (!values.tools || !values.record) {
  console.error("usage: server.ts --tools <tools.json> --record <calls.jsonl>");
  process.exit(2);
}
const toolsPath: string = values.tools;
const recordPath: string = values.record;

const raw = JSON.parse(await readFile(toolsPath, "utf8")) as unknown;
if (!Array.isArray(raw) || !raw.every((t) => typeof (t as Tool).name === "string"))
  throw new Error(`tools file must be an array of named tools: ${toolsPath}`);
const tools = raw as Tool[];
const names = new Set(tools.map((t) => t.name));
if (names.size !== tools.length) throw new Error("duplicate tool names in tools file");

const server = new Server({ name: "strata-bfcl", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  if (!names.has(name)) throw new Error(`Unknown BFCL tool: ${name}`);
  await appendFile(recordPath, JSON.stringify({ name, arguments: input }) + "\n", "utf8");
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    structuredContent: { ok: true },
  };
});
await server.connect(new StdioServerTransport());
