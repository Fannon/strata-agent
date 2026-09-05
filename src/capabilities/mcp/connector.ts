import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  type StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { bytes, type CapabilityConnector } from "../manifest.ts";
import { adaptTools } from "./adapter.ts";

export async function connectMcp(
  id: string,
  parameters: StdioServerParameters,
) {
  const client = new Client({ name: "strata-agent", version: "0.1.0" });
  const transport = new StdioClientTransport({
    ...parameters,
    stderr: "ignore",
  });
  try {
    await client.connect(transport);
    const tools: Tool[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await client.listTools({ cursor });
      tools.push(...page.tools);
      cursor = page.nextCursor;
      if (cursor && seen.has(cursor))
        throw new Error("MCP tools/list repeated cursor");
      if (cursor) seen.add(cursor);
    } while (cursor);
    const manifest = adaptTools(id, tools);
    const connector: CapabilityConnector = {
      async invoke(operation, input, signal) {
        // Use protocol request so the broker owns validation and byte accounting,
        // rather than Client.callTool's additional output-schema validation.
        const result = await client.request(
          {
            method: "tools/call",
            params: { name: operation, arguments: input },
          },
          CallToolResultSchema,
          { signal },
        );
        return {
          structured: result.structuredContent,
          untyped: result,
          isError: result.isError,
          rawBytes: bytes(result),
        };
      },
      close: () => client.close(),
    };
    return { manifest, connector };
  } catch (error) {
    await client.close();
    throw error;
  }
}
