// Deterministic CLI twin of the MCP fixture (see test/fixture-mcp/server.ts).
// Data formulas are intentionally identical; test/integration/cli-connector.test.ts
// asserts twin parity so the two backends cannot drift apart silently.
//
// Contract: stdout is pure JSON, diagnostics go to stderr.
// Exit 0 on success, 2 on usage/argument errors.
type Customer = { id: string; country: string };
const customers: Customer[] = [
  { id: "c1", country: "DE" },
  { id: "c2", country: "US" },
];

function fail(message: string): never {
  console.error(`fixture-cli: ${message}`);
  process.exit(2);
}

const [op, ...rest] = Bun.argv.slice(2);
function flag(name: string): string {
  const index = rest.indexOf(name);
  if (index === -1 || index + 1 >= rest.length) fail(`missing ${name}`);
  return rest[index + 1]!;
}

switch (op) {
  case "customers": {
    const country = flag("--country");
    if (country !== "DE" && country !== "US") fail(`bad country ${country}`);
    console.log(
      JSON.stringify({
        customers: customers.filter((c) => c.country === country),
      }),
    );
    break;
  }
  case "invoices": {
    const ids = flag("--customer-ids")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log(
      JSON.stringify({
        invoices: ids.map((id, index) => ({
          id: `i${index}`,
          customerId: id,
          amount: 12000,
        })),
      }),
    );
    break;
  }
  case "records": {
    const raw = flag("--count");
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 1 || count > 10000)
      fail(`bad count ${raw}`);
    console.log(
      JSON.stringify({
        records: Array.from({ length: count }, (_, id) => ({
          id,
          score: (id % 100) / 100,
          text: "deterministic intermediate data ".repeat(5),
        })),
      }),
    );
    break;
  }
  default:
    fail(`unknown operation ${op ?? "(none)"}`);
}
