import { test, expect } from "bun:test";
import { discoverAndLoadExtensions } from "@mariozechner/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureSession } from "../../examples/fixture.ts";
import type {
  CapabilityConnector,
  CapabilityModule,
} from "../../src/capabilities/manifest.ts";

function stub(id = "stub"): {
  module: CapabilityModule;
  connector: CapabilityConnector;
  closed: () => boolean;
  closeCalls: () => number;
} {
  let calls = 0;
  let isClosed = false;
  const module: CapabilityModule = {
    id,
    operations: [
      {
        name: "op",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    ],
  };
  const connector: CapabilityConnector = {
    backend: "test",
    async invoke() {
      return { structured: {}, untyped: {}, rawBytes: 2 };
    },
    async close() {
      calls++;
      isClosed = true;
    },
  };
  return {
    module,
    connector,
    closed: () => isClosed,
    closeCalls: () => calls,
  };
}

test("load after close throws and leaves ownership with the caller", async () => {
  const session = await fixtureSession();
  const before = session.declarations;
  await session.close();
  const s = stub("after-close");
  await expect(session.load(s.module, s.connector, new Set(["op"]))).rejects.toThrow(
    "Session is closed",
  );
  // Session never took ownership: its (already-run) close did not close the stub.
  expect(s.closed()).toBe(false);
  // Caller ownership: caller closes exactly once.
  await s.connector.close();
  expect(s.closeCalls()).toBe(1);
  // Broker state unchanged: the module was not registered.
  expect(session.declarations).toBe(before);
});

test("pre-aborted load throws and does not register", async () => {
  const session = await fixtureSession();
  try {
    const before = session.declarations;
    const s = stub("pre-aborted");
    await expect(
      session.load(s.module, s.connector, new Set(["op"]), {
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow();
    expect(s.closed()).toBe(false);
    await s.connector.close();
    expect(session.declarations).toBe(before);
    const probe = await session.run(
      "import { api } from '@c/pre-aborted'; export async function main() { return 1; }",
    );
    expect(probe.error).toContain("compilation failed");
  } finally {
    await session.close();
  }
});

test("close during a pending load aborts registration without a leak", async () => {
  const session = await fixtureSession();
  try {
    const before = session.declarations;
    const s = stub("racing");
    // load() yields inside declarations(); close() runs before it resumes,
    // deterministically exercising the post-await shutdown guard. Start the
    // close first, then await the rejection inline: attach the rejection
    // handler before awaiting other work.
    const pending = session.load(s.module, s.connector, new Set(["op"]));
    const closing = session.close();
    await expect(pending).rejects.toThrow("Session is closed");
    await closing;
    // Session did not take ownership, so the racing connector is still open
    // for the caller to close.
    expect(s.closed()).toBe(false);
    await s.connector.close();
    expect(s.closeCalls()).toBe(1);
    expect(session.declarations).toBe(before);
  } finally {
    await session.close();
  }
});

test("successful load transfers ownership to session close", async () => {
  const session = await fixtureSession();
  const s = stub("owned");
  const text = await session.load(s.module, s.connector, new Set(["op"]));
  expect(text).toContain("@cap/owned");
  expect(session.declarations).toContain("@cap/owned");
  expect(s.closed()).toBe(false);
  await session.close();
  expect(s.closed()).toBe(true);
});

test("mid-load abort rejects without registering", async () => {
  const session = await fixtureSession();
  try {
    const before = session.declarations;
    const s = stub("mid-abort");
    const controller = new AbortController();
    // Abort after load() passed its synchronous pre-checks but before the
    // declarations await resumes, deterministically exercising the
    // post-await abort guard (not just the pre-abort fast path).
    const pending = session.load(s.module, s.connector, new Set(["op"]), {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(s.closed()).toBe(false);
    await s.connector.close();
    expect(s.closeCalls()).toBe(1);
    expect(session.declarations).toBe(before);
  } finally {
    await session.close();
  }
});

test("close is idempotent: concurrent and repeated closes close each connector once", async () => {
  const session = await fixtureSession();
  const s = stub("idempotent");
  await session.load(s.module, s.connector, new Set(["op"]));
  await Promise.all([session.close(), session.close()]);
  await session.close();
  expect(s.closeCalls()).toBe(1);
  expect(s.closed()).toBe(true);
});

test("close attempts every connector and preserves the error", async () => {
  const session = await fixtureSession();
  const ok = stub("close-ok");
  let failCalls = 0;
  const failing: CapabilityConnector = {
    backend: "test",
    async invoke() {
      return { structured: {}, untyped: {}, rawBytes: 1 };
    },
    async close() {
      failCalls++;
      throw new Error("boom-close");
    },
  };
  const failingModule: CapabilityModule = {
    id: "close-fail",
    operations: [
      {
        name: "op",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    ],
  };
  await session.load(failingModule, failing, new Set(["op"]));
  await session.load(ok.module, ok.connector, new Set(["op"]));
  // One connector rejects, yet the other is still attempted and the error
  // is preserved for the caller.
  await expect(session.close()).rejects.toThrow("boom-close");
  expect(failCalls).toBe(1);
  expect(ok.closeCalls()).toBe(1);
  expect(ok.closed()).toBe(true);
  // The cached close outcome is reused: no connector is closed twice.
  await expect(session.close()).rejects.toThrow("boom-close");
  expect(failCalls).toBe(1);
  expect(ok.closeCalls()).toBe(1);
});

test("close attempts every connector when one throws synchronously", async () => {
  const session = await fixtureSession();
  const ok = stub("sync-close-ok");
  let syncCalls = 0;
  // A Promise-returning close that throws synchronously (before returning
  // a promise) must not skip the remaining closes.
  const syncThrowing: CapabilityConnector = {
    backend: "test",
    async invoke() {
      return { structured: {}, untyped: {}, rawBytes: 1 };
    },
    close(): Promise<void> {
      syncCalls++;
      throw new Error("boom-sync-close");
    },
  };
  const syncModule: CapabilityModule = {
    id: "sync-close-fail",
    operations: [
      {
        name: "op",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    ],
  };
  await session.load(syncModule, syncThrowing, new Set(["op"]));
  await session.load(ok.module, ok.connector, new Set(["op"]));
  await expect(session.close()).rejects.toThrow("boom-sync-close");
  expect(syncCalls).toBe(1);
  expect(ok.closeCalls()).toBe(1);
  expect(ok.closed()).toBe(true);
});

const extensionPath = fileURLToPath(
  new URL("../../src/pi/extension.ts", import.meta.url),
);

/** Start the real Pi extension on a fixture session (STRATA_CONFIG unset). */
async function startExtension() {
  const previousConfig = process.env.STRATA_CONFIG;
  const hadConfig = "STRATA_CONFIG" in process.env;
  delete process.env.STRATA_CONFIG;
  const directory = await mkdtemp(join(tmpdir(), "strata-load-shutdown-"));
  const discovered = await discoverAndLoadExtensions(
    [extensionPath],
    directory,
    directory,
  );
  expect(discovered.errors).toEqual([]);
  const extension = discovered.extensions.find((e) =>
    e.tools.has("load_capability"),
  )!;
  const start = async () => {
    for (const handler of extension.handlers.get("session_start") ?? [])
      await handler({ type: "session_start", reason: "startup" }, {});
  };
  const shutdown = async () => {
    for (const handler of extension.handlers.get("session_shutdown") ?? [])
      await handler({ type: "session_shutdown" }, {});
  };
  const stop = async () => {
    await shutdown();
    await rm(directory, { recursive: true, force: true });
    if (hadConfig) process.env.STRATA_CONFIG = previousConfig!;
    else delete process.env.STRATA_CONFIG;
  };
  await start();
  return { extension, start, shutdown, stop };
}

type TextContent = { type: string; text: string };

test("real Pi shutdown during load rejects and the session reloads cleanly", async () => {
  const ctx = await startExtension();
  try {
    const load = ctx.extension.tools.get("load_capability")!;
    const search = ctx.extension.tools.get("search_capabilities")!;
    // Start a load, then run the real session_shutdown handlers while the
    // connector build / session.load await is still in flight. Shutdown
    // closes the captured session first, so load() rejects with its
    // shutdown guard and the tool closes the built connector instead of
    // leaking it or registering on the discarded session. Await the rejects
    // assertion immediately: attach rejection handlers before awaiting
    // other work so a rejection in the shutdown window is observed.
    const pending = load.definition.execute(
      "test",
      { id: "cli-records" },
      undefined,
      undefined,
      {} as never,
    );
    const shutting = ctx.shutdown();
    await expect(pending).rejects.toThrow("Session is closed");
    await shutting;
    // Restart: no stale bookkeeping leaked — cli-records is not marked
    // loaded for the fresh session, and loading it works.
    await ctx.start();
    const found = await search.definition.execute(
      "test",
      { query: "bulk records" },
      undefined,
      undefined,
      {} as never,
    );
    const results = JSON.parse((found.content[0] as TextContent).text)
      .results as Array<{ id: string; loaded: boolean }>;
    expect(results.find((r) => r.id === "cli-records")?.loaded).toBe(false);
    const reloaded = await load.definition.execute(
      "test",
      { id: "cli-records" },
      undefined,
      undefined,
      {} as never,
    );
    expect(
      JSON.parse((reloaded.content[0] as TextContent).text).module,
    ).toBe("@c/cli-records");
  } finally {
    await ctx.stop();
  }
}, 30000);

test("extension load aborted in flight rejects and leaves the session usable", async () => {
  const ctx = await startExtension();
  try {
    const load = ctx.extension.tools.get("load_capability")!;
    const search = ctx.extension.tools.get("search_capabilities")!;
    const controller = new AbortController();
    const pending = load.definition.execute(
      "test",
      { id: "cli-records" },
      controller.signal,
      undefined,
      {} as never,
    );
    controller.abort();
    await expect(pending).rejects.toThrow();
    // The aborted load registered nothing: not marked loaded, and a retry
    // on the still-live session succeeds.
    const found = await search.definition.execute(
      "test",
      { query: "bulk records" },
      undefined,
      undefined,
      {} as never,
    );
    const results = JSON.parse((found.content[0] as TextContent).text)
      .results as Array<{ id: string; loaded: boolean }>;
    expect(results.find((r) => r.id === "cli-records")?.loaded).toBe(false);
    const retry = await load.definition.execute(
      "test",
      { id: "cli-records" },
      undefined,
      undefined,
      {} as never,
    );
    expect(JSON.parse((retry.content[0] as TextContent).text).module).toBe(
      "@c/cli-records",
    );
  } finally {
    await ctx.stop();
  }
}, 30000);
