/** Synthetic datetime probe MCP server for 045 (no protected data).
 *
 * One `read` operation with an optional `since: date-time` input and a
 * required `at: date-time` output. The response payload is driven by the
 * `PROBE_PAYLOAD` environment variable (JSON), read per request so each
 * spawned session can pin its scenario. Defaults to the naive upstream
 * form `2020-01-01T00:00:00`.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "strata-datetime-probe", version: "0.1.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read",
      description: "Return the configured datetime payload.",
      inputSchema: {
        type: "object",
        properties: { since: { type: "string", format: "date-time" } },
        required: [],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: { at: { type: "string", format: "date-time" } },
        required: ["at"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
    },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "read") throw new Error("Unknown tool");
  // Payload driven per spawn via argv[2] (JSON), falling back to
  // PROBE_PAYLOAD then the naive default. Argv is used because the MCP
  // stdio transport only inherits a sanitized env allowlist, so arbitrary
  // parent env vars do not reach the child unless the caller forwards env
  // explicitly (direct-tools does; sessionFromConfig does not).
  const fromArgv = process.argv[2];
  const raw =
    fromArgv ?? process.env.PROBE_PAYLOAD ?? '{"at":"2020-01-01T00:00:00"}';
  const structuredContent = JSON.parse(raw) as Record<string, unknown>;
  return { content: [], structuredContent };
});
await server.connect(new StdioServerTransport());
