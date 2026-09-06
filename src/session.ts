import { Workspace } from "./compiler/workspace.ts";
import { CapabilityBroker, type Metrics } from "./capabilities/broker.ts";
import { declarations, declarationsPreamble } from "./capabilities/schemas.ts";
import {
  bytes,
  type CapabilityModule,
  type CapabilityConnector,
} from "./capabilities/manifest.ts";
import { execute } from "./runtime/executor.ts";
import {
  TRACE_VERSION,
  createTraceSink,
  type TraceSink,
} from "./trace.ts";

export interface SessionOptions {
  /** Stable identifier for trace correlation; defaults to a random suffix. */
  sessionId?: string;
  /** JSONL developer trace file. Defaults to STRATA_TRACE_FILE when set. */
  traceFile?: string;
}

export async function createSession(
  manifest: CapabilityModule,
  connector: CapabilityConnector,
  allowed: ReadonlySet<string>,
  options: SessionOptions = {},
) {
  const texts = [await declarations(manifest)];
  const joined = () => `${declarationsPreamble}\n${texts.join("\n")}`;
  const workspace = new Workspace(joined());
  const broker = new CapabilityBroker(manifest, connector, allowed);
  const connectors = [connector];
  const shutdown = new AbortController();
  const active = new Set<Promise<unknown>>();
  const sessionId =
    options.sessionId ?? crypto.randomUUID().slice(0, 8);
  const sink: TraceSink | undefined = createTraceSink(
    options.traceFile ?? (process.env.STRATA_TRACE_FILE || undefined),
  );
  broker.setTracer(sessionId, (event) => sink?.event(event));
  let programSeq = 0;
  let loadSeq = 0;
  return {
    get sessionId() {
      return sessionId;
    },
    get declarations() {
      return joined();
    },
    traceStats() {
      return { events: sink?.events ?? 0, dropped: sink?.dropped ?? 0 };
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
      const loadId = `${sessionId}:load${++loadSeq}`;
      const started = performance.now();
      sink?.event({
        v: TRACE_VERSION,
        kind: "load",
        phase: "start",
        session: sessionId,
        program: loadId,
        capability: module.id,
        wallMs: Date.now(),
      });
      try {
        // Declarations first: they can throw, and the broker must never gain
        // a module whose types failed. The caller closes moduleConnector on error.
        const text = await declarations(module);
        broker.addModule(module, moduleConnector, moduleAllowed);
        connectors.push(moduleConnector);
        texts.push(text);
        workspace.setDeclarations(joined());
        sink?.event({
          v: TRACE_VERSION,
          kind: "load",
          phase: "outcome",
          session: sessionId,
          program: loadId,
          capability: module.id,
          wallMs: Date.now(),
          durationMs: performance.now() - started,
          outcome: "ok",
        });
        return text;
      } catch (error) {
        sink?.event({
          v: TRACE_VERSION,
          kind: "load",
          phase: "outcome",
          session: sessionId,
          program: loadId,
          capability: module.id,
          wallMs: Date.now(),
          durationMs: performance.now() - started,
          outcome: "error",
          detail: (error instanceof Error ? error.message : String(error)).slice(0, 300),
        });
        throw error;
      }
    },
    run(
      source: string,
      options: { signal?: AbortSignal; timeoutMs?: number } = {},
    ) {
      const task = (async () => {
        const programId = `${sessionId}:p${++programSeq}`;
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
          engine: "quickjs",
          programId,
          outcome: "error",
          traceDropped: 0,
        };
        let payload: { result?: unknown; error?: string; logs: string[] } = {
          logs: [],
        };
        const signal = AbortSignal.any([
          shutdown.signal,
          ...(options.signal ? [options.signal] : []),
        ]);
        const start = performance.now();
        sink?.event({
          v: TRACE_VERSION,
          kind: "program",
          phase: "start",
          session: sessionId,
          program: programId,
          engine: metrics.engine,
          wallMs: Date.now(),
        });
        const finishProgram = (outcome: Metrics["outcome"]) => {
          metrics.outcome = outcome;
          metrics.traceDropped = sink?.dropped ?? 0;
          sink?.event({
            v: TRACE_VERSION,
            kind: "program",
            phase: "outcome",
            session: sessionId,
            program: programId,
            engine: metrics.engine,
            wallMs: Date.now(),
            durationMs: performance.now() - start,
            outcome,
            bytes: metrics.bytesExposedToPi,
            detail: `calls=${metrics.capabilityCalls} rawBytes=${metrics.rawCapabilityBytes} compileMs=${Math.round(metrics.compileMs)} execMs=${Math.round(metrics.executionMs)}`,
          });
        };
        try {
          signal.throwIfAborted();
          if (metrics.sourceBytes > 32_768)
            throw new Error("Source exceeds 32768 bytes");
          const compiled = workspace.compile(source);
          metrics.compileMs = performance.now() - start;
          metrics.diagnostics = compiled.diagnostics
            .slice(0, 12)
            .map((d) => d.slice(0, 1500));
          if (compiled.diagnostics.length) {
            payload.error =
              "TypeScript compilation failed. No capability calls were executed.";
            metrics.outcome = "compile-error";
          } else {
            const executionStart = performance.now();
            const executed = await execute(
              compiled.code!,
              broker,
              metrics,
              signal,
              options.timeoutMs,
              { program: programId, engine: metrics.engine },
            );
            metrics.executionMs = performance.now() - executionStart;
            payload = executed;
            metrics.outcome = executed.outcome;
            if (executed.outcome === "cancelled" || executed.outcome === "timeout") {
              // The worker is gone and results are discarded. In-flight call
              // records without a terminal outcome belong to this run, so mark
              // them rather than leaving them implicitly incomplete. A late
              // connector completion records the same category via the broker.
              for (const call of metrics.calls) {
                if (call.invoked && !call.failure) {
                  call.failure = "cancelled";
                  if (!call.durationMs)
                    call.durationMs = performance.now() - start;
                }
              }
            }
          }
        } catch (error) {
          payload.error =
            error instanceof Error ? error.message : String(error);
          metrics.outcome = signal.aborted ? "cancelled" : "error";
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
        // The durable trace keeps every call event even when the model-facing
        // report truncates call detail above; never treat the report as audit.
        metrics.bytesExposedToPi = finalMetrics.bytesExposedToPi;
        finishProgram(finalMetrics.outcome);
        finalMetrics.traceDropped = sink?.dropped ?? 0;
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
      await sink?.close();
    },
  };
}
