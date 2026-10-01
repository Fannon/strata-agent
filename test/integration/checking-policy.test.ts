import { test, expect } from "bun:test";
import { makeWorld } from "../../examples/checking/fixture.ts";
import { makeRuntime, policies } from "../../examples/checking/runtime.ts";
import { moduleSource, tasks, grade } from "../../examples/checking/protocol.ts";

test("checking policies share valid results and authoritative input validation", async () => {
  for (const policy of policies) {
    const world = makeWorld(), runtime = await makeRuntime(world, policy);
    try {
      const good = await runtime.run(moduleSource("return (await api.listCustomers({country:'DE'})).customers.map(c=>c.id);"));
      expect(good.result).toEqual(["c1", "c2", "c3", "c5"]);
      const invalid = await runtime.run(moduleSource("return api.recordPayment({invoiceId:'i1',amountCents:-1});"));
      expect(invalid.metrics.calls[0]?.failure).toBe("input");
      expect(world.payments).toHaveLength(1);
      const imports = await runtime.run("import fs from 'node:fs'; export function main(){return fs;}");
      expect(imports.error).toContain("capability imports");
      expect(imports.metrics.capabilityCalls).toBe(0);
    } finally { runtime.close(); }
  }
});
test("early checking prevents a simulated partial effect; delayed checking diagnoses without replay", async () => {
  for (const policy of policies) {
    const world = makeWorld(), runtime = await makeRuntime(world, policy);
    try {
      const r = await runtime.run(tasks["repair-partial"].seed!);
      expect(r.error).toBeDefined();
      expect(world.payments).toHaveLength(policy === "always" ? 1 : 2);
      expect(r.metrics.diagnostics.length > 0).toBe(policy !== "never");
      expect(world.invocations.filter(c => c.operation === "recordPayment")).toHaveLength(policy === "always" ? 0 : 1);
    } finally { runtime.close(); }
  }
});
test("successful-looking wrong results do not trigger delayed checking", async () => {
  for (const policy of policies) {
    const world = makeWorld(), runtime = await makeRuntime(world, policy);
    try {
      const r = await runtime.run(tasks["repair-silent"].seed!);
      if (policy === "always") expect(r.metrics.outcome).toBe("compile-error");
      else { expect(r.metrics.outcome).toBe("ok"); expect(r.result).toEqual({ invoiceIds: [] }); expect(r.metrics.diagnostics).toEqual([]); }
      expect(grade("repair-silent", makeWorld(), r.result, world.payments).answerCorrect).toBe(false);
    } finally { runtime.close(); }
  }
});
test("runtime-only bad output and type-correct business mistakes are negative controls", async () => {
  for (const policy of policies) {
    const runtime = await makeRuntime(makeWorld(), policy);
    try {
      const response = await runtime.run(moduleSource("return api.brokenResponse({});"));
      expect(response.metrics.calls[0]?.failure).toBe("output");
      expect(response.metrics.diagnostics).toEqual([]);
      const wrong = await runtime.run(moduleSource("return {customers:[]};"));
      expect(wrong.metrics.outcome).toBe("ok"); expect(wrong.metrics.diagnostics).toEqual([]);
    } finally { runtime.close(); }
  }
});
