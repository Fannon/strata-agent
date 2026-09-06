import { rewriteCapabilityImports } from "./capability-imports.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Direct-Bun program runner (issue 027). One disposable worker per run:
 * a fresh JS realm with no retained state, but WITH ambient host authority
 * (Bun, process, fetch, file/network access). Capability calls route through
 * the shared broker (validation, grants, instrumentation), so cooperative
 * programs observe identical contracts; ambient access can bypass the
 * wrappers, so this mode measures API adherence, not enforced exclusivity.
 * See docs/executors.md.
 */
const pending = new Map<
  number,
  { resolve: (value: string) => void; reject: (error: unknown) => void }
>();
let nextId = 0;

self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === "response") {
    const waiter = pending.get(event.data.id);
    if (!waiter) return;
    pending.delete(event.data.id);
    if (event.data.error) waiter.reject(new Error(event.data.error));
    else waiter.resolve(JSON.stringify(event.data.value) ?? "null");
    return;
  }
  if (event.data.type !== "run") return;
  const { code, surfaces, timeoutMs } = event.data as {
    code: string;
    surfaces: Array<{ capability: string; operations: string[] }>;
    timeoutMs: number;
  };
  const logs: string[] = [];
  let logBytes = 0;
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    const line = JSON.stringify(args);
    if (
      logBytes + Buffer.byteLength(line) <= 2048 &&
      logs.length < 20
    ) {
      logs.push(line);
      logBytes += Buffer.byteLength(line);
    }
  };
  const invoke = (
    capability: string,
    operation: string,
    input: string,
  ): Promise<unknown> => {
    const id = nextId++;
    const text = new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    self.postMessage({ type: "invoke", id, capability, operation, input: JSON.parse(input) });
    // Explicit JSON round-trip so values match QuickJS string transport
    // (e.g. undefined properties are dropped, not preserved).
    return text.then((result) => JSON.parse(result));
  };
  try {
    const caps: Record<string, { api: Record<string, (input: unknown) => Promise<unknown>> }> = {};
    for (const surface of surfaces) {
      const capability = surface.capability;
      const api: Record<string, (input: unknown) => Promise<unknown>> = {};
      for (const operation of surface.operations) {
        api[operation] = async (input: unknown) =>
          invoke(capability, operation, JSON.stringify(input));
      }
      caps[capability] = { api: Object.freeze(api) };
    }
    (globalThis as Record<string, unknown>).__strataCaps = caps;
    void timeoutMs;
    const rewritten = rewriteCapabilityImports(
      code,
      surfaces.map((surface) => surface.capability),
    );
    // Bun does not evaluate data: JavaScript URLs as modules, so stage the
    // rewritten program as a unique temp file per run and import it by path.
    // The file is unlinked before the run resolves; a worker terminated
    // mid-run may leave one behind, which is bounded temp noise, not state.
    const staged = join(
      tmpdir(),
      `strata-bun-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}.mjs`,
    );
    await Bun.write(staged, rewritten);
    let module: { main?: unknown };
    try {
      module = await import(pathToFileURL(staged).href);
    } finally {
      await unlink(staged).catch(() => {});
    }
    if (typeof module.main !== "function")
      throw new Error("export a zero-argument main() function returning your result");
    const value = await (module.main as () => unknown)();
    const json = JSON.stringify(value);
    if (json === undefined)
      throw new Error("main() must return a JSON result");
    if (json.length > 8192)
      throw new Error("Result exceeds 8192 characters; aggregate or select fewer records");
    self.postMessage({ type: "done", result: JSON.parse(json), logs });
  } catch (error) {
    self.postMessage({
      type: "done",
      error: error instanceof Error ? error.message : String(error),
      logs,
    });
  } finally {
    console.log = originalLog;
    delete (globalThis as Record<string, unknown>).__strataCaps;
    pending.clear();
  }
};
