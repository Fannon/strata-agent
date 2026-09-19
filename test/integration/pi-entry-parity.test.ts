/** 045 — Actual-entry validation parity regression (synthetic, no network).
 *
 * Exercises the REAL model-facing entry points with the same synthetic
 * timezone-free `date-time` response over a real MCP subprocess:
 * - typed arm: `sessionFromConfig` (src/pi/extension.ts) + `session.run`;
 * - direct arm: `directTools` Pi extension (src/pi/direct-tools.ts)
 *   registered tool `execute`.
 * Config parsing, transport, validator wiring and tool dispatch are all
 * real; only the backend payload is synthetic. Both arms must agree across
 * compat states, malformed values stay rejected, and agent-supplied inputs
 * stay strict.
 */
import { test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sessionFromConfig } from "../../src/pi/extension.ts";
import directTools from "../../src/pi/direct-tools.ts";
import { Workspace } from "../../src/compiler/workspace.ts";

const NAIVE = "2020-01-01T00:00:00";
const STRICT = "2020-01-01T00:00:00+00:00";
const MALFORMED = "not-a-date";

const server = fileURLToPath(
  new URL("../../test/fixture-mcp/datetime-server.ts", import.meta.url),
);

/** Environment probe (041): Workspace cannot resolve stdlib on Windows. */
function compilerWorks(): boolean {
  const workspace = new Workspace(
    "declare const console: { log(...values: unknown[]): void };",
  );
  try {
    const result = workspace.compile(
      "export async function main() { return 1; }",
    );
    return !result.diagnostics.some((d) => d.includes("TS6053"));
  } catch {
    return false;
  } finally {
    workspace.close();
  }
}

function typedConfig(compat: unknown, payload: unknown): Record<string, unknown> {
  const config: Record<string, unknown> = {
    id: "probe",
    command: process.execPath,
    args: [server, JSON.stringify(payload)],
    allow: ["read"],
  };
  if (compat !== undefined) config.compat = { acceptNaiveDateTime: compat };
  return config;
}

async function typedOutcome(
  compat: unknown,
  payload: unknown,
  input: Record<string, unknown>,
): Promise<{ outcome: string; error?: string }> {
  const { session } = await sessionFromConfig(typedConfig(compat, payload));
    try {
      const source =
        `import { api } from "@cap/probe";\nexport async function main() { return await api.read(${JSON.stringify(input)}); }`;
      const report = await session.run(source);
      return { outcome: report.metrics.outcome, error: report.error };
    } finally {
      await session.close();
    }
}

async function directOutcome(
  compat: unknown,
  payload: unknown,
  input: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const dir = await mkdtemp(join(tmpdir(), "strata-045-"));
  const hooks = new Map<string, () => Promise<void>>();
  const registered = new Map<
    string,
    { execute: (id: string, params: unknown, signal: AbortSignal) => Promise<unknown> }
  >();
  const config: Record<string, unknown> = {
    id: "probe",
    command: process.execPath,
    args: [server, JSON.stringify(payload)],
    allow: ["read"],
  };
  if (compat !== undefined) config.compat = { acceptNaiveDateTime: compat };
  const file = join(dir, "config.json");
  await writeFile(file, JSON.stringify(config));
  const prevConfig = process.env.STRATA_CONFIG;
  const prevLog = process.env.STRATA_DIRECT_LOG;
  const prevPayload = process.env.PROBE_PAYLOAD;
  process.env.STRATA_CONFIG = file;
  process.env.PROBE_PAYLOAD = JSON.stringify(payload);
  delete process.env.STRATA_DIRECT_LOG;
  try {
    directTools({
      on: (name: string, handler: never) => {
        hooks.set(name, handler as never);
      },
      registerTool: (tool: never) => {
        registered.set(
          (tool as { name: string }).name,
          tool as never,
        );
      },
    } as never);
    await hooks.get("session_start")!();
    try {
      const tool = registered.get("read");
      expect(tool).toBeDefined();
      await tool!.execute("probe", input, AbortSignal.timeout(10000));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await hooks.get("session_shutdown")!();
    }
  } finally {
    if (prevConfig === undefined) delete process.env.STRATA_CONFIG;
    else process.env.STRATA_CONFIG = prevConfig;
    if (prevLog !== undefined) process.env.STRATA_DIRECT_LOG = prevLog;
    if (prevPayload === undefined) delete process.env.PROBE_PAYLOAD;
    else process.env.PROBE_PAYLOAD = prevPayload;
    await rm(dir, { recursive: true, force: true });
  }
}

test("entry points agree: compat accepts naive, strict default rejects it", async () => {
  // Direct arm runs everywhere (no compiler needed).
  const directCompat = await directOutcome(true, { at: NAIVE }, {});
  expect(directCompat.ok).toBe(true);
  const directStrict = await directOutcome(undefined, { at: NAIVE }, {});
  expect(directStrict.ok).toBe(false);
  expect(directStrict.error ?? "").toContain("output");
  const directFalse = await directOutcome(false, { at: NAIVE }, {});
  expect(directFalse.ok).toBe(false);
  expect(directFalse.error ?? "").toContain("output");
}, 30000);

test.if(compilerWorks())("typed entry forwards compat: naive accepted only with opt-in", async () => {
  const compat = await typedOutcome(true, { at: NAIVE }, {});
  expect(compat.outcome).toBe("ok");
  const strict = await typedOutcome(undefined, { at: NAIVE }, {});
  expect(strict.outcome).not.toBe("ok");
  expect(strict.error ?? "").toContain("output");
  const explicitFalse = await typedOutcome(false, { at: NAIVE }, {});
  expect(explicitFalse.outcome).not.toBe("ok");
  expect(explicitFalse.error ?? "").toContain("output");
}, 30000);

test.if(compilerWorks())("both entries agree across the matrix", async () => {
  const cases: Array<{
    name: string;
    payload: unknown;
    input: Record<string, unknown>;
    compat: unknown;
    expectOk: boolean;
    expectStage?: string;
  }> = [
    { name: "strict output passes", payload: { at: STRICT }, input: {}, compat: undefined, expectOk: true },
    { name: "strict output passes with opt-in", payload: { at: STRICT }, input: {}, compat: true, expectOk: true },
    { name: "malformed stays rejected strict", payload: { at: MALFORMED }, input: {}, compat: undefined, expectOk: false, expectStage: "output" },
    { name: "malformed stays rejected with opt-in", payload: { at: MALFORMED }, input: {}, compat: true, expectOk: false, expectStage: "output" },
    { name: "naive input stays strict with opt-in", payload: { at: STRICT }, input: { since: NAIVE }, compat: true, expectOk: false, expectStage: "input" },
    { name: "strict input passes with naive output opt-in", payload: { at: NAIVE }, input: { since: STRICT }, compat: true, expectOk: true },
  ];
  for (const c of cases) {
    const typed = await typedOutcome(c.compat, c.payload, c.input);
    const direct = await directOutcome(c.compat, c.payload, c.input);
    expect({ case: c.name, typedOk: typed.outcome === "ok" }).toEqual({
      case: c.name,
      typedOk: c.expectOk,
    });
    expect({ case: c.name, directOk: direct.ok }).toEqual({
      case: c.name,
      directOk: c.expectOk,
    });
    if (!c.expectOk && c.expectStage) {
      expect(typed.error ?? "").toContain(c.expectStage);
      expect(direct.error ?? "").toContain(c.expectStage);
    }
  }
}, 60000);

test("direct entry keeps inputs strict with the opt-in", async () => {
  const direct = await directOutcome(true, { at: STRICT }, { since: NAIVE });
  expect(direct.ok).toBe(false);
  expect(direct.error ?? "").toContain("input");
}, 30000);
