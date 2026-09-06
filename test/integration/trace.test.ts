import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureSession } from "../../examples/fixture.ts";
import { connectRepo } from "../../src/capabilities/repo/connector.ts";
import { createSession } from "../../src/session.ts";
import {
  summarizeTrace,
  type TraceEvent,
} from "../../src/trace.ts";

let dir = "";
let traceFile = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "strata-trace-"));
  traceFile = join(dir, "trace.jsonl");
  await writeFile(join(dir, "secret-note.txt"), "TOP-SECRET-CONTENT-7f3a\n");
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const readEvents = async (): Promise<TraceEvent[]> =>
  (await readFile(traceFile, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

test("calls carry correlated IDs, durations, backend and engine", async () => {
  const session = await fixtureSession();
  try {
    const result = await session.run(
      "import { api } from '@c/fixture';\nexport async function main() { const c = await api.customers({ country: 'DE' }); const i = await api.invoices({ customerIds: c.customers.map(c => c.id) }); return i.invoices.length; }",
    );
    expect(result.error).toBeUndefined();
    expect(result.metrics.outcome).toBe("ok");
    expect(result.metrics.engine).toBe("quickjs");
    expect(result.metrics.programId).toBe(`${session.sessionId}:p1`);
    expect(result.metrics.calls.map((c) => c.callId)).toEqual([
      `${result.metrics.programId}.1`,
      `${result.metrics.programId}.2`,
    ]);
    for (const call of result.metrics.calls) {
      expect(call.backend).toBe("mcp");
      expect(call.durationMs).toBeGreaterThanOrEqual(0);
      expect(call.failure).toBeUndefined();
    }
  } finally {
    await session.close();
  }
});

test("policy denial and resource denial keep distinct structured categories", async () => {
  const fixture = await fixtureSession();
  try {
    const denied = await fixture.run(
      "import { api } from '@c/fixture';\nexport async function main() { return await api.deleteAll({}); }",
    );
    expect(denied.metrics.outcome).toBe("error");
    expect(denied.metrics.calls[0]?.failure).toBe("policy");
  } finally {
    await fixture.close();
  }
  const { manifest, connector } = await connectRepo({ root: dir });
  const repo = await createSession(manifest, connector, new Set(["readText"]));
  try {
    const escaped = await repo.run(
      `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "../outside.txt" }); }`,
    );
    expect(escaped.error ?? "").toContain("denied");
    expect(escaped.metrics.calls[0]?.failure).toBe("denied");
    expect(escaped.metrics.calls[0]?.backend).toBe("bun-native");
  } finally {
    await repo.close();
  }
});

test("cancellation marks the run and in-flight calls without prose parsing", async () => {
  const session = await fixtureSession();
  try {
    const abort = new AbortController();
    const running = session.run(
      "import { api } from '@c/fixture';\nexport async function main() { return await api.slow({}); }",
      { signal: abort.signal },
    );
    setTimeout(() => abort.abort(), 100);
    const result = await running;
    expect(result.error ?? "").toContain("cancelled");
    expect(result.metrics.outcome).toBe("cancelled");
    expect(result.metrics.calls.length).toBe(1);
    expect(result.metrics.calls[0]?.invoked).toBe(true);
    // Terminal category even though the worker is gone: the late broker
    // completion records the same category, so accept either order.
    expect(["cancelled", undefined]).toContain(result.metrics.calls[0]?.failure);
  } finally {
    await session.close();
  }
});

test("concurrent runs keep distinct correlated call IDs", async () => {
  const session = await fixtureSession();
  try {
    const body = "import { api } from '@c/fixture';\nexport async function main() { return await api.stats({}); }";
    const [a, b] = await Promise.all([session.run(body), session.run(body)]);
    expect(a.error).toBeUndefined();
    expect(b.error).toBeUndefined();
    expect(a.metrics.programId).not.toBe(b.metrics.programId);
    expect(a.metrics.calls[0]?.callId).toBe(`${a.metrics.programId}.1`);
    expect(b.metrics.calls[0]?.callId).toBe(`${b.metrics.programId}.1`);
  } finally {
    await session.close();
  }
});

test("sink records every attempt without arguments, source or file content", async () => {
  const file = join(dir, "redacted.jsonl");
  const { manifest, connector } = await connectRepo({ root: dir });
  const repo = await createSession(manifest, connector, new Set(["readText", "searchText"]), {
    traceFile: file,
  });
  try {
    const ok = await repo.run(
      `import { api } from '@c/repo';\nexport async function main() { const f = await api.readText({ path: "secret-note.txt" }); const s = await api.searchText({ pattern: "TOP-SECRET" }); return f.totalBytes + s.filesScanned; }`,
    );
    expect(ok.error).toBeUndefined();
    const denied = await repo.run(
      `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "../x" }); }`,
    );
    expect(denied.metrics.calls[0]?.failure).toBe("denied");
  } finally {
    await repo.close();
  }
  const raw = await readFile(file, "utf8");
  expect(raw).not.toContain("TOP-SECRET-CONTENT-7f3a");
  expect(raw).not.toContain("secret-note");
  const events = raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  expect(events.length).toBeGreaterThan(0);
  const allowed = new Set([
    "v", "kind", "phase", "session", "program", "call", "engine",
    "capability", "operation", "backend", "wallMs", "durationMs",
    "outcome", "bytes", "detail",
  ]);
  for (const event of events) {
    expect(event.v).toBe(1);
    for (const key of Object.keys(event)) expect(allowed.has(key)).toBe(true);
  }
  const calls = events.filter((e) => e.kind === "call" && e.phase === "outcome");
  expect(calls.map((c) => c.outcome).sort()).toEqual(["denied", "ok", "ok"]);
  const summary = summarizeTrace(events);
  expect(summary.calls).toBe(3);
  expect(summary.outcomes).toEqual({ ok: 2, denied: 1 });
  expect(summary.engines).toEqual({ quickjs: 3 });
});

test("discovery loads emit timed trace events", async () => {
  const file = join(dir, "loads.jsonl");
  // Load a second module under a session with an explicit sink: the MCP
  // server serves the same tools under a second capability id.
  const { connectMcp } = await import("../../src/capabilities/mcp/connector.ts");
  const { fileURLToPath } = await import("node:url");
  const server = fileURLToPath(new URL("../../test/fixture-mcp/server.ts", import.meta.url));
  const first = await connectMcp("fixture", { command: process.execPath, args: [server] });
  const traced = await createSession(first.manifest, first.connector, new Set(["stats"]), {
    traceFile: file,
  });
  try {
    const second = await connectMcp("fixture2", { command: process.execPath, args: [server] });
    try {
      await traced.load(second.manifest, second.connector, new Set(["stats"]));
    } catch (error) {
      await second.connector.close();
      throw error;
    }
    const r = await traced.run(
      "import { api } from '@c/fixture2';\nexport async function main() { return await api.stats({}); }",
    );
    expect(r.error).toBeUndefined();
  } finally {
    await traced.close();
  }
  const events = (await readFile(file, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const loadOutcome = events.find((e) => e.kind === "load" && e.phase === "outcome");
  expect(loadOutcome?.outcome).toBe("ok");
  expect(loadOutcome?.durationMs).toBeGreaterThanOrEqual(0);
});

test("sink failure counts dropped events instead of failing the run", async () => {
  // Point the sink at an unwritable location: the run must still succeed.
  const { fixtureConnection } = await import("../../examples/fixture.ts");
  const { manifest, connector } = await fixtureConnection();
  const traced = await createSession(manifest, connector, new Set(["stats"]), {
    traceFile: join(dir, "no-such-dir", "trace.jsonl"),
  });
  try {
    const r = await traced.run(
      "import { api } from '@c/fixture';\nexport async function main() { return await api.stats({}); }",
    );
    expect(r.error).toBeUndefined();
    expect(r.metrics.traceDropped).toBeGreaterThan(0);
    expect(traced.traceStats().dropped).toBeGreaterThan(0);
  } finally {
    await traced.close();
  }
});
