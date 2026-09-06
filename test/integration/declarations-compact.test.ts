import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace } from "../../src/compiler/workspace.ts";
import {
  declarations,
  declarationsPreamble,
  compactSchemaForDeclarations,
} from "../../src/capabilities/schemas.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import { fixtureSession } from "../../examples/fixture.ts";

// Compact must preserve every operation, type and semantic constraint while
// shrinking presentation. Length caps move prose-side; runtime validation
// still enforces them pre-dispatch (zero-effect input failures).

test("compact saves most bytes without dropping operations or constraints", async () => {
  const { manifest, connector } = await connectRepo({ root: tmpdir() });
  try {
    const full = await declarations(manifest);
    const compact = await declarations(manifest, "compact");
    expect(Buffer.byteLength(compact)).toBeLessThan(Buffer.byteLength(full) * 0.45);
    for (const op of manifest.operations) {
      expect(compact).toContain(`"${op.name}"`);
      expect(compact).toContain(op.description!.slice(0, 40));
    }
    // One alias binding instead of a second full copy.
    expect(compact).toContain('import { api } from "@cap/repo"');
    // Tuple-union expansions are gone; caps survive as prose.
    expect(compact).not.toMatch(/\|\s*\[/);
    expect(compact).toContain("Max 32 items.");
    // The transform never touches broker schemas: no maxItems loss there.
    const schemas = JSON.stringify(manifest.operations.map((o) => o.inputSchema));
    expect(schemas).toContain('"maxItems"');
  } finally {
    await connector.close();
  }
});

test("compactSchemaForDeclarations only relaxes array length caps", async () => {
  const { manifest, connector } = await connectRepo({ root: tmpdir() });
  try {
    const prune = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(prune);
      if (value === null || typeof value !== "object") return value;
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (key === "maxItems" || key === "minItems" || key === "description") continue;
        out[key] = prune(entry);
      }
      return out;
    };
    for (const op of manifest.operations) {
      const relaxed = compactSchemaForDeclarations(op.inputSchema);
      // Same shape modulo caps and prose.
      expect(prune(relaxed)).toEqual(prune(op.inputSchema));
      // Every relaxed cap survives as prose.
      const quantities = JSON.stringify(op.inputSchema).match(/"maxItems":(\d+)/g) ?? [];
      for (const q of quantities) {
        const n = q.split(":")[1];
        expect(JSON.stringify(relaxed)).toContain(`Max ${n} items.`);
      }
    }
  } finally {
    await connector.close();
  }
});

const corpus: Array<{ name: string; source: string; compiles: boolean }> = [
  {
    name: "valid read",
    source: `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "a.txt" }); }`,
    compiles: true,
  },
  {
    name: "valid aliased cap prefix",
    source: `import { api } from '@cap/repo';\nexport async function main() { return await api.gitStatus({}); }`,
    compiles: true,
  },
  {
    name: "valid composition",
    source: `import { api } from '@c/repo';\nexport async function main() { const f = await api.listFiles({}); return (await api.searchText({ pattern: "x", paths: ["docs"] })).matches.length + f.entries.length; }`,
    compiles: true,
  },
  {
    name: "valid git history with files",
    source: `import { api } from '@c/repo';\nexport async function main() { const log = await api.gitLog({ withFiles: true, limit: 5 }); return log.commits.map((c) => c.message); }`,
    compiles: true,
  },
  {
    name: "valid diff and show",
    source: `import { api } from '@c/repo';\nexport async function main() { const d = await api.gitDiff({ staged: true }); const s = await api.gitShow({ revision: "HEAD", path: "a.txt" }); return d.truncated || s.truncated; }`,
    compiles: true,
  },
  {
    name: "bad revision",
    source: `import { api } from '@c/repo';\nexport async function main() { return await api.gitShow({ revision: 42, path: "a.txt" }); }`,
    compiles: false,
  },
  {
    name: "bad property",
    source: `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ pathh: "a.txt" }); }`,
    compiles: false,
  },
  {
    name: "wrong scalar type",
    source: `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: 42 }); }`,
    compiles: false,
  },
  {
    name: "unknown operation",
    source: `import { api } from '@c/repo';\nexport async function main() { return await (api as any).nope({}); }`,
    compiles: true, // any-cast compiles; broker policy rejects before dispatch.
  },
  {
    name: "suppression comment",
    source: `// @ts-nocheck\nexport function main() { return 1; }`,
    compiles: false,
  },
  {
    name: "missing main",
    source: `import { api } from '@c/repo';\nexport async function helper() { return 1; }`,
    compiles: false,
  },
];

test("compile/no-compile agreement across presentations (except documented arity move)", async () => {
  const { manifest, connector } = await connectRepo({ root: tmpdir() });
  try {
    const fullDecl = `${declarationsPreamble}\n${await declarations(manifest)}`;
    const compactDecl = `${declarationsPreamble}\n${await declarations(manifest, "compact")}`;
    const fullWs = new Workspace(fullDecl);
    const compactWs = new Workspace(compactDecl);
    try {
      for (const item of corpus) {
        const fullDiags = fullWs.compile(item.source).diagnostics;
        const compactDiags = compactWs.compile(item.source).diagnostics;
        expect([item.name, compactDiags.length === 0]).toEqual([item.name, fullDiags.length === 0]);
        if (!item.compiles) expect(fullDiags.length).toBeGreaterThan(0);
      }
      // Arity over the cap: full rejects statically, compact accepts and the
      // broker rejects pre-effect. Documented stage move, not a parity break.
      // (Only include/exclude carry static tuple unions; paths arrays accept
      // any length in both presentations and rely on runtime caps.)
      const many = `import { api } from '@c/repo';\nexport async function main() { return await api.searchText({ pattern: "x", include: ${JSON.stringify(Array.from({ length: 20 }, (_, i) => `f${i}.ts`))} }); }`;
      expect(fullWs.compile(many).diagnostics.length).toBeGreaterThan(0);
      expect(compactWs.compile(many).diagnostics.length).toBe(0);
    } finally {
      fullWs.close();
      compactWs.close();
    }
  } finally {
    await connector.close();
  }
});

test("compact sessions preserve behavior; over-cap arrays fail pre-effect", async () => {
  const dir = await mkdtemp(join(tmpdir(), "strata-compact-"));
  try {
    await mkdir(join(dir, "docs"), { recursive: true });
    await writeFile(join(dir, "a.txt"), "hello\n");
    await writeFile(join(dir, "docs", "b.txt"), "needle here\n");
    const { manifest, connector } = await connectRepo({ root: dir });
    const params = new Set(["readText", "searchText", "listFiles"]);
    const full = await createSession(manifest, connector, params);
    const compact = await createSession(manifest, connector, params, { declarations: "compact" });
    try {
      const program = (body: string) =>
        `import { api } from '@c/repo';\nexport async function main() { ${body} }`;
      const expected = "needle here";
      for (const session of [full, compact]) {
        const ok = await session.run(
          program(`const f = await api.searchText({ pattern: "needle" }); return (await api.readText({ path: f.matches[0]!.path })).content;`),
        );
        expect(ok.error).toBeUndefined();
        expect(ok.result).toBe(expected + "\n");
      }
      // 20 includes exceed maxItems 16: compact compiles, broker rejects with zero calls.
      const over = await compact.run(
        program(`return await api.searchText({ pattern: "x", include: ${JSON.stringify(Array.from({ length: 20 }, (_, i) => `f${i}.ts`))} });`),
      );
      expect(over.error ?? "").toContain("input:");
      expect(over.metrics.calls[0]?.failure).toBe("input");
      expect(over.metrics.capabilityCalls).toBe(0);
    } finally {
      await full.close();
      await compact.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("compact works through the fixture session factory", async () => {
  const session = await fixtureSession(undefined, "compact");
  try {
    const baseline = await fixtureSession();
    try {
      expect(session.declarations.length).toBeLessThan(baseline.declarations.length * 0.6);
    } finally {
      await baseline.close();
    }
    const r = await session.run(
      `import { api } from '@c/fixture';\nexport async function main() { return (await api.customers({ country: 'DE' })).customers.map(c => c.id); }`,
    );
    expect(r.error).toBeUndefined();
    expect(r.result).toEqual(["c1"]);
  } finally {
    await session.close();
  }
});
