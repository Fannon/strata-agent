import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteCapabilityImports } from "../../src/runtime/capability-imports.ts";
import { parseExecutor } from "../../src/runtime/executor.ts";
import { fixtureSession } from "../../examples/fixture.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-bunexec-"));
});
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const program = (body: string) =>
  `import { api } from '@c/fixture';\nexport async function main() { ${body} }`;
const bun = () => fixtureSession("bun");

test("import rewrite keeps bindings, aliases and both prefixes", () => {
  expect(
    rewriteCapabilityImports(`import { api } from "@c/fixture";\nexport async function main(){ return 1; }`, ["fixture"]),
  ).toContain('const { api } = globalThis.__strataCaps["fixture"];');
  expect(
    rewriteCapabilityImports(`import { api as fs } from '@cap/repo';`, ["repo"]),
  ).toContain('const { api: fs } = globalThis.__strataCaps["repo"];');
  expect(
    rewriteCapabilityImports(`import * as fix from "@c/fixture";`, ["fixture"]),
  ).toContain('const fix = globalThis.__strataCaps["fixture"];');
});

test("import rewrite rejects unknown modules and non-named forms", () => {
  expect(() =>
    rewriteCapabilityImports(`import { api } from "@c/nope";`, ["fixture"]),
  ).toThrow("Module unavailable: @c/nope");
  for (const source of [
    `import api from "@c/fixture";`,
    `import "@c/fixture";`,
    `export { api } from "@c/fixture";`,
  ])
    expect(() => rewriteCapabilityImports(source, ["fixture"])).toThrow();
});

test("parseExecutor defaults and rejects", () => {
  expect(parseExecutor(undefined)).toBe("quickjs");
  expect(parseExecutor("bun")).toBe("bun");
  expect(() => parseExecutor("deno")).toThrow('Unknown STRATA_EXECUTOR "deno"');
});

test("bun: typed invocation and composition match QuickJS results", async () => {
  for (const engine of [undefined, "bun"] as const) {
    const session = await fixtureSession(engine);
    try {
      const one = await session.run(program("return await api.stats({});"));
      expect(one.error).toBeUndefined();
      expect(one.metrics.engine).toBe(engine ?? "quickjs");
      const composed = await session.run(
        program(
          "const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.filter(i => i.amount > 10000).map(i => i.id);",
        ),
      );
      expect(composed.error).toBeUndefined();
      expect(composed.result).toEqual(["i0"]);
      expect(composed.metrics.capabilityCalls).toBe(2);
    } finally {
      await session.close();
    }
  }
});

test("bun: compile rejection, denials and violations match categories", async () => {
  const session = await bun();
  try {
    const badProp = await session.run(
      program("return await api.customers({ county: 'DE' });"),
    );
    expect(badProp.error).toContain("compilation failed");
    expect(badProp.metrics.outcome).toBe("compile-error");
    expect(badProp.metrics.capabilityCalls).toBe(0);
    const policy = await session.run(program("return await api.deleteAll({});"));
    expect(policy.error).toContain("fixture.deleteAll: policy:");
    expect(policy.metrics.calls[0]?.failure).toBe("policy");
    const input = await session.run(program("return await api.records({ count: -1 });"));
    expect(input.error).toContain("fixture.records: input:");
    expect(input.metrics.calls[0]?.failure).toBe("input");
    const output = await session.run(program("return await api.broken({});"));
    expect(output.error).toContain("fixture.broken: output:");
    expect(output.metrics.calls[0]?.failure).toBe("output");
    const cast = await session.run(
      program("return await api.customers({country:123} as any);"),
    );
    expect(cast.error).toContain("fixture.customers: input:");
  } finally {
    await session.close();
  }
});

test("bun: sequential and parallel composition, alias and namespace imports", async () => {
  const session = await bun();
  try {
    const seq = await session.run(
      program(
        "const a = await api.stats({}); const b = await api.stats({}); const c = await api.stats({}); return [a.invocations, b.invocations, c.invocations];",
      ),
    );
    expect(seq.error).toBeUndefined();
    expect(seq.metrics.capabilityCalls).toBe(3);
    const par = await session.run(
      program(
        "const [a, b] = await Promise.all([api.stats({}), api.stats({})]); return a.invocations <= b.invocations;",
      ),
    );
    expect(par.error).toBeUndefined();
    expect(par.result).toBe(true);
    const alias = await session.run(
      "import { api as f } from '@c/fixture';\nexport async function main() { return await f.stats({}); }",
    );
    expect(alias.error).toBeUndefined();
    const ns = await session.run(
      "import * as fix from '@c/fixture';\nexport async function main() { return await fix.api.stats({}); }",
    );
    expect(ns.error).toBeUndefined();
  } finally {
    await session.close();
  }
});

test("bun: fresh globals, bounded logs/results, timeout and recovery", async () => {
  const session = await bun();
  try {
    await session.run(
      "export function main() { (globalThis as any).secret = 42; return null; }",
    );
    expect(
      (
        await session.run(
          "export function main() { return typeof (globalThis as any).secret; }",
        )
      ).result,
    ).toBe("undefined");
    const large = await session.run(
      'export function main() { return "x".repeat(10000); }',
    );
    expect(large.error).toContain("Result exceeds");
    const timed = await session.run("export function main() { while(true) {} }", {
      timeoutMs: 150,
    });
    expect(timed.error).toContain("Execution timeout (150ms)");
    expect(timed.metrics.outcome).toBe("timeout");
    const after = await session.run(program("return await api.stats({});"));
    expect(after.error).toBeUndefined();
    expect(after.metrics.outcome).toBe("ok");
  } finally {
    await session.close();
  }
});

test("bun: cancellation terminates and the session recovers", async () => {
  const session = await bun();
  try {
    const abort = new AbortController();
    const running = session.run(program("return await api.slow({});"), {
      signal: abort.signal,
    });
    setTimeout(() => abort.abort(), 100);
    const cancelled = await running;
    expect(cancelled.error ?? "").toContain("cancelled");
    expect(cancelled.metrics.outcome).toBe("cancelled");
    const after = await session.run(program("return await api.stats({});"));
    expect(after.error).toBeUndefined();
  } finally {
    await session.close();
  }
});

test("bun: repo reads and denials match QuickJS contracts", async () => {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
  for (const engine of ["quickjs", "bun"] as const) {
    const { manifest, connector } = await connectRepo({ root: dir });
    const session = await createSession(manifest, connector, new Set(["readText"]), {
      executor: engine,
    });
    try {
      const ok = await session.run(
        `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "package.json" }); }`,
      );
      expect(ok.error).toBeUndefined();
      expect(ok.metrics.engine).toBe(engine);
      expect((ok.result as { content: string }).content).toContain("demo");
      const denied = await session.run(
        `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "../x" }); }`,
      );
      expect(denied.error ?? "").toContain("denied");
      expect(denied.metrics.calls[0]?.failure).toBe("denied");
    } finally {
      await session.close();
    }
  }
});

test("ambient authority differs: cooperative adherence, not containment", async () => {
  const probe =
    "export async function main() { return [typeof (globalThis as any).process, typeof (globalThis as any).Bun, typeof (globalThis as any).fetch]; }";
  const quick = await fixtureSession();
  try {
    expect((await quick.run(probe)).result).toEqual([
      "undefined",
      "undefined",
      "undefined",
    ]);
  } finally {
    await quick.close();
  }
  const direct = await bun();
  try {
    const seen = (await direct.run(probe)).result as string[];
    expect(seen).toContain("object");
    expect(seen).not.toEqual(["undefined", "undefined", "undefined"]);
  } finally {
    await direct.close();
  }
});

test("ambient bypass is real: Bun programs can effect host writes", async () => {
  const canary = join(dir, "canary.txt");
  const writer = (tag: string) =>
    `import { api } from '@c/fixture';\nexport async function main() { await api.stats({}); const B = (globalThis as any).Bun; if (B && typeof B.write === "function") { await B.write(${JSON.stringify(canary)}, ${JSON.stringify(tag)}); return "wrote"; } return "no-ambient"; }`;
  const quick = await fixtureSession();
  try {
    const r = await quick.run(writer("quickjs"));
    expect(r.result).toBe("no-ambient");
  } finally {
    await quick.close();
  }
  await rm(canary, { force: true });
  const direct = await bun();
  try {
    const r = await direct.run(writer("bun"));
    expect(r.result).toBe("wrote");
  } finally {
    await direct.close();
  }
  // Independent effect counter outside wrapper logs: the file exists.
  expect(await readFile(canary, "utf8")).toBe("bun");
  await rm(canary, { force: true });
});
