/** Model-free fixture: additive payments, including one invalid reply after an effect. */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
const object = (properties:Record<string,object>) => ({type:"object" as const,properties,required:Object.keys(properties),additionalProperties:false});
const payment = object({id:{type:"string"},invoiceId:{type:"string"},amountCents:{type:"integer"}});
const tools:Tool[]=[
  {name:"recordPayment",description:"Add one non-idempotent payment. Amount 456 gives an invalid reply after adding it.",inputSchema:object({invoiceId:{type:"string"},amountCents:{type:"integer",minimum:1}}),outputSchema:object({payment}),annotations:{readOnlyHint:false,idempotentHint:false}},
  {name:"listPayments",description:"Read the ledger to verify completed/uncertain effects.",inputSchema:object({}),outputSchema:object({payments:{type:"array",items:payment}}),annotations:{readOnlyHint:true}},
];
const payments=[{id:"old",invoiceId:"i1",amountCents:123}];
const server=new Server({name:"recovery-fixture",version:"1"},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
  let value:unknown;
  if(request.params.name==="recordPayment"){
    const input=request.params.arguments as {invoiceId:string;amountCents:number};
    const row={id:`p${payments.length}`,...input};payments.push(row);
    value=input.amountCents===456?{payment:{bad:true}}:{payment:row};
  }else if(request.params.name==="listPayments") value={payments};
  else throw Error("Unknown operation");
  return {content:[{type:"text",text:JSON.stringify(value)}],structuredContent:value};
});
await server.connect(new StdioServerTransport());
