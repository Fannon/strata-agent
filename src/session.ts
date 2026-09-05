import { Workspace } from "./compiler/workspace.ts";
import { CapabilityBroker, type Metrics } from "./capabilities/broker.ts";
import { declarations, declarationsPreamble } from "./capabilities/schemas.ts";
import {
  bytes,
  type CapabilityModule,
  type CapabilityConnector,
} from "./capabilities/manifest.ts";
import { execute } from "./runtime/executor.ts";

export async function createSession(
  manifest: CapabilityModule,
  connector: CapabilityConnector,
  allowed: ReadonlySet<string>,
) {
  const texts = [await declarations(manifest)];
  const joined = () => `${declarationsPreamble}\n${texts.join("\n")}`;
  const workspace = new Workspace(joined());
  const broker = new CapabilityBroker(manifest, connector, allowed);
  const connectors = [connector];
  const shutdown = new AbortController();
  const active = new Set<Promise<unknown>>();
  return {
    get declarations() {
      return joined();
    },
    /** Register another capability module in this live session (discovery load).
     * Returns the new module's declarations so the caller can hand the model
     * its import block without a prompt reload. Loading never grants
     * invocation: the given allowlist gates every call through the broker. */
    async load(
      module: CapabilityModule,
      moduleConnector: CapabilityConnector,
      moduleAllowed: ReadonlySet<string>,
    ) {
      // Declarations first: they can throw, and the broker must never gain
      // a module whose types failed. The caller closes moduleConnector on error.
      const text = await declarations(module);
      broker.addModule(module, moduleConnector, moduleAllowed);
      connectors.push(moduleConnector);
      texts.push(text);
      workspace.setDeclarations(joined());
      return text;
    },
    run(
      source: string,
      options: { signal?: AbortSignal; timeoutMs?: number } = {},
    ) {
      const task = (async () => {
        const metrics: Metrics = {
          sourceBytes: Buffer.byteLength(source),
          compileMs: 0,
          diagnostics: [],
          executionMs: 0,
          capabilityCalls: 0,
          calls: [],
          rawCapabilityBytes: 0,
          bytesExposedToPi: 0,
          validationFailures: 0,
          policyFailures: 0,
        };
        let payload: { result?: unknown; error?: string; logs: string[] } = {
          logs: [],
        };
        const signal = AbortSignal.any([
          shutdown.signal,
          ...(options.signal ? [options.signal] : []),
        ]);
        const start = performance.now();
        try {
          signal.throwIfAborted();
          if (metrics.sourceBytes > 32_768)
            throw new Error("Source exceeds 32768 bytes");
          const compiled = workspace.compile(source);
          metrics.compileMs = performance.now() - start;
          metrics.diagnostics = compiled.diagnostics
            .slice(0, 12)
            .map((d) => d.slice(0, 1500));
          if (compiled.diagnostics.length)
            payload.error =
              "TypeScript compilation failed. No capability calls were executed.";
          else {
            const executionStart = performance.now();
            payload = await execute(
              compiled.code!,
              broker,
              metrics,
              signal,
              options.timeoutMs,
            );
            metrics.executionMs = performance.now() - executionStart;
          }
        } catch (error) {
          payload.error =
            error instanceof Error ? error.message : String(error);
        }
        if (payload.error) payload.error = payload.error.slice(0, 1500);
        // Only this bounded text becomes tool content. Metrics never contain raw payloads.
        const report = { ...payload, metrics: structuredClone(metrics) };
        const finalMetrics = report.metrics;
        let text = JSON.stringify(report);
        if (Buffer.byteLength(text) > 23_900) {
          delete report.result;
          report.logs = [];
          report.error =
            "Response exceeded 24000-byte budget; return a smaller result";
          finalMetrics.diagnostics = finalMetrics.diagnostics.slice(0, 3);
          finalMetrics.calls = finalMetrics.calls.slice(0, 10);
        }
        if (bytes(report) > 23_900) {
          finalMetrics.calls = [];
          finalMetrics.diagnostics = [
            "Diagnostics omitted to fit tool output budget",
          ];
        }
        do {
          finalMetrics.bytesExposedToPi = bytes(report);
          text = JSON.stringify(report);
        } while (finalMetrics.bytesExposedToPi !== Buffer.byteLength(text));
        return { ...report, text };
      })();
      active.add(task);
      void task.finally(() => active.delete(task));
      return task;
    },
    async close() {
      shutdown.abort();
      await Promise.allSettled(active);
      workspace.close();
      for (const connector of connectors) await connector.close();
    },
  };
}
