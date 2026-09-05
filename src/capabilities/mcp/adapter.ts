import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CapabilityModule } from '../manifest.ts';

export function adaptTools(id: string, tools: Tool[]): CapabilityModule {
  if (!/^[a-z][a-z0-9_-]*$/.test(id)) throw new Error('Capability id must match [a-z][a-z0-9_-]*');
  const names = new Set<string>();
  return { id, operations: [...tools].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(tool => {
    if (names.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`);
    names.add(tool.name);
    return {
      name: tool.name, description: tool.description,
      inputSchema: tool.inputSchema, outputSchema: tool.outputSchema,
      metadata: tool.annotations && {
        readOnly: tool.annotations.readOnlyHint, destructive: tool.annotations.destructiveHint,
        idempotent: tool.annotations.idempotentHint, openWorld: tool.annotations.openWorldHint,
      },
    };
  }) };
}
