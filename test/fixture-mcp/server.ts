import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';

const object = (properties: Record<string, object>, required: string[] = Object.keys(properties)) => ({ type: 'object' as const, properties, required, additionalProperties: false });
const string = { type: 'string' };
const customer = object({ id: string, country: string });
const tools: Tool[] = [
  { name: 'customers', description: 'Search customers by country. Optional nested filters.', inputSchema: object({ country: { type: 'string', enum: ['DE', 'US'] }, filters: object({ status: { enum: ['active', 'inactive'] }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, []) }, ['country']), outputSchema: object({ customers: { type: 'array', items: customer } }), annotations: { readOnlyHint: true } },
  { name: 'invoices', inputSchema: object({ customerIds: { type: 'array', items: string } }), outputSchema: object({ invoices: { type: 'array', items: object({ id: string, customerId: string, amount: { type: 'number' } }) } }), annotations: { readOnlyHint: true } },
  { name: 'untyped', description: 'Legacy text result; no structured output guarantee.', inputSchema: object({}), annotations: { readOnlyHint: true } },
  { name: 'records', inputSchema: object({ count: { type: 'integer', minimum: 1, maximum: 10000 } }), outputSchema: object({ records: { type: 'array', items: object({ id: { type: 'integer' }, score: { type: 'number' }, text: string }) } }), annotations: { readOnlyHint: true } },
  { name: 'broken', inputSchema: object({}), outputSchema: object({ count: { type: 'integer' } }), annotations: { readOnlyHint: true } },
  { name: 'deleteAll', inputSchema: object({}), outputSchema: object({ deleted: { type: 'boolean' } }), annotations: { destructiveHint: true } },
  { name: 'stats', inputSchema: object({}), outputSchema: object({ invocations: { type: 'integer' } }), annotations: { readOnlyHint: true } },
  { name: 'slow', inputSchema: object({}), outputSchema: object({ done: { type: 'boolean' } }), annotations: { readOnlyHint: true } },
];
let invocations = 0;
const server = new Server({ name: 'strata-fixture', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: input = {} } = request.params;
  if (name !== 'stats') invocations++;
  let structuredContent: Record<string, unknown>;
  switch (name) {
    case 'customers': structuredContent = { customers: [{ id: 'c1', country: 'DE' }, { id: 'c2', country: 'US' }].filter(c => c.country === input.country) }; break;
    case 'invoices': structuredContent = { invoices: (input.customerIds as string[]).map((id, index) => ({ id: `i${index}`, customerId: id, amount: 12000 })) }; break;
    case 'records': structuredContent = { records: Array.from({ length: input.count as number }, (_, id) => ({ id, score: (id % 100) / 100, text: 'deterministic intermediate data '.repeat(5) })) }; break;
    case 'broken': structuredContent = { count: 'not an integer' }; break;
    case 'deleteAll': structuredContent = { deleted: true }; break;
    case 'stats': structuredContent = { invocations }; break;
    case 'untyped': return { content: [{ type: 'text', text: '{"untrusted":"text is not a typed object"}' }] };
    case 'slow':
      await new Promise<void>(resolve => { const timer = setTimeout(resolve, 10000); extra.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });
      structuredContent = { done: true }; break;
    default: throw new Error('Unknown fixture tool');
  }
  return { content: [], structuredContent };
});
await server.connect(new StdioServerTransport());
