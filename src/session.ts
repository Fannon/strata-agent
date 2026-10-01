import { Workspace } from "./compiler/workspace.ts";
import { RecoveryLedger } from "./recovery.ts";
import { CapabilityBroker, type BrokerOptions, type Metrics } from "./capabilities/broker.ts";
import { declarations, declarationsPreamble, parseDeclarationStyle, type DeclarationStyle } from "./capabilities/schemas.ts";
import {
  type CapabilityModule,
  type CapabilityConnector,
} from "./capabilities/manifest.ts";
import { executeWith, parseExecutor, type ExecutorKind } from "./runtime/executor.ts";
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
  /** Execution engine. Default "quickjs"; "bun" is opt-in (see docs/executors.md). */
  executor?: ExecutorKind;
  /** Declaration presentation. Default "full"; "compact" is opt-in for the 004 experiment. */
  declarations?: DeclarationStyle;
  /**
   * Boundary-scoped response validation compatibility (040). Passed to the
   * broker for output validators only; inputs stay strict. Default is
   * strict RFC 3339 everywhere. The AppWorld replay harness opts in for
   * its module; comparison arms must share the setting (042 parity).
   */
  validation?: BrokerOptions;
}

export async function createSession(
  manifest: CapabilityModule,
  connector: CapabilityConnector,
  allowed: ReadonlySet<string>,
  options: SessionOptions = {},
) {
  const style = parseDeclarationStyle(options.declarations);
  const texts = [await declarations(manifest, style)];
  const joined = () => `${declarationsPreamble}\n${texts.join("\n")}`;
  const workspace = new Workspace(joined());
  const broker = new CapabilityBroker(manifest, connector, allowed, options.validation ?? {});
  const connectors = [connector];
  const shutdown = new AbortController();
  let closed = false;
  let closePromise: Promise<void> | undefined;
  const active = new Set<Promise<unknown>>();
  const sessionId =
    options.sessionId ?? crypto.randomUUID().slice(0, 8);
  const sessionExecutor = parseExecutor(options.executor);
  const sink: TraceSink | undefined = createTraceSink(
    options.traceFile ?? (process.env.STRATA_TRACE_FILE || undefined),
  );
  broker.setTracer(sessionId, (event) => sink?.event(event));
  let programSeq = 0;
  let loadSeq = 0;
  let turnFloor = 0;
  let resultFloor = 0;
  let selected: { program: string; json: string } | undefined;
  const recovery = new RecoveryLedger();
  broker.setReceiptRecorder(receipt => recovery.record(receipt));
  const invalidateResults = () => { selected = undefined; resultFloor = programSeq; };

  // On-demand detail history for program_details (031). Bounded to the last
  // 20 programs; additionally retains bounded JSON for explicit finalization.
  const history = new Map<
    string,
    { sequence: number; json?: string; outcome: Metrics["outcome"]; error?: string; logs: string[]; metrics: Metrics }
  >();
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
    /** Start a user-request scope; prior results cannot be silently reused. */
    beginTurn() { turnFloor = programSeq; invalidateResults(); },
    invalidateResults,
    effects(program?: string, options: { offset?: number; limit?: number } = {}) {
      if (closed) throw new Error("Session is closed.");
      return { ...recovery.page(program, turnFloor, options.offset, options.limit), inspection: broker.inspectionOperations };
    },
    /** Explicitly choose the latest completed successful program of this request. */
    selectResult(program: string) {
      if (closed || active.size) throw new Error("Cannot finalize while the session is closed or work is still running.");
      const entry = history.get(program);
      if (!entry || entry.sequence <= resultFloor || entry.sequence !== programSeq || entry.outcome !== "ok" || entry.json === undefined)
        throw new Error("Select the latest successful program from this request; older, failed or expired results cannot be finalized.");
      selected = { program, json: entry.json };
      sink?.event({ v: TRACE_VERSION, kind: "finalize", phase: "start", session: sessionId, program, outcome: "selected", wallMs: Date.now() });
      return { ...selected };
    },
    /** One-shot host delivery; never fabricates an answer from an unselected result. */
    consumeSelection() {
      if (closed || active.size || !selected) return undefined;
      const value = { ...selected };
      selected = undefined;
      sink?.event({ v: TRACE_VERSION, kind: "finalize", phase: "outcome", session: sessionId, program: value.program, outcome: "delivered", wallMs: Date.now(), bytes: Buffer.byteLength(value.json) });
      return value;
    },
    /** Bounded on-demand details for program_details (031). Throws on unknown id. */
    details(programId: string) {
      const entry = history.get(programId);
      if (!entry) throw new Error(`Unknown program "${programId}".`);
      return {
        program: programId,
        outcome: entry.outcome,
        ...(entry.error ? { error: entry.error } : {}),
        logs: [...entry.logs],
        metrics: structuredClone(entry.metrics),
        recovery: recovery.has(programId) ? recovery.page(programId, turnFloor) : { expired: true, program: programId },
      };
    },
    /** Register another capability module in this live session (discovery load).
     * Returns the new module's declarations so the caller can hand the model
     * its import block without a prompt reload. Loading never grants
     * invocation: the given allowlist gates every call through the broker.
     * Ownership: on success the session owns moduleConnector (closed by
     * close()); on any throw — shutdown, abort, or declaration/broker error —
     * ownership stays with the caller, which must close moduleConnector. */
    async load(
      module: CapabilityModule,
      moduleConnector: CapabilityConnector,
      moduleAllowed: ReadonlySet<string>,
      options: { signal?: AbortSignal } = {},
    ) {
      if (closed) throw new Error("Session is closed; load aborted.");
      invalidateResults();
      options.signal?.throwIfAborted();
      shutdown.signal.throwIfAborted();
      const runLoad = async (): Promise<string> => {
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
          // a module whose types failed. Re-check shutdown/abort after the
          // await: close() may have interleaved, and registration below must
          // not run on a discarded session (connector leak). The caller closes
          // moduleConnector on any throw.
          const text = await declarations(module, style);
          if (closed) throw new Error("Session is closed; load aborted.");
          options.signal?.throwIfAborted();
          shutdown.signal.throwIfAborted();
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
      };
      const task = runLoad();
      active.add(task);
      try {
        return await task;
      } finally {
        active.delete(task);
      }
    },
    run(
      source: string,
      options: { signal?: AbortSignal; timeoutMs?: number; executor?: ExecutorKind } = {},
    ) {
      const task = (async () => {
        const sequence = ++programSeq;
        const programId = `${sessionId}:p${sequence}`;
        selected = undefined;
        recovery.start(programId, programSeq);
        const engine =
          options.executor === undefined ? sessionExecutor : parseExecutor(options.executor);
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
        metrics.engine = engine;
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
              "TypeScript compilation failed. No capability calls were executed by this program.";
            metrics.outcome = "compile-error";
          } else {
            const executionStart = performance.now();
            const executed = await executeWith(
              engine,
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
                if (call.invoked && !call.acknowledged && !call.failure) {
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
        recovery.finish(programId);
        if (payload.error) payload.error = payload.error.slice(0, 1500);
        // Quiet success, loud error (031): only this bounded `text` becomes
        // Pi tool content. Success carries just { result, program } so logs
        // and metrics stay out of model context. Errors stay loud: the full
        // envelope (error, logs, metrics with diagnostics/calls) plus the
        // program id, so the model can repair and the benchmark trace keeps
        // its measurement. Full logs + metrics also stay in host history +
        // trace, served on demand via details(). Metrics never contain raw payloads.
        const report = { ...payload, metrics: structuredClone(metrics) };
        const finalMetrics = report.metrics;
        const ok = finalMetrics.outcome === "ok";
        type Visible = Record<string, unknown>;
        let visible: Visible;
        if (ok) {
          visible = { result: report.result, program: programId };
        } else {
          visible = {
            error: report.error,
            logs: report.logs,
            program: programId,
            metrics: finalMetrics,
            recovery: recovery.summary(turnFloor),
          };
        }
        let text = JSON.stringify(visible);
        if (Buffer.byteLength(text) > 23_900) {
          if (ok) {
            // A multibyte result can fit the worker's character cap but exceed
            // this byte cap. It must not remain selectable as a success.
            finalMetrics.outcome = "error";
            report.result = undefined;
            report.logs = [];
            report.error =
              "Response exceeded 24000-byte budget; return a smaller result";
            visible = {
              error: report.error,
              program: programId,
              outcome: finalMetrics.outcome,
              recovery: recovery.summary(turnFloor),
            };
          } else {
            delete report.result;
            report.logs = [];
            report.error =
              "Response exceeded 24000-byte budget; return a smaller result";
            finalMetrics.diagnostics = finalMetrics.diagnostics.slice(0, 3);
            finalMetrics.calls = finalMetrics.calls.slice(0, 10);
            visible = {
              error: report.error,
              logs: report.logs,
              program: programId,
              metrics: finalMetrics,
              recovery: { ...recovery.summary(turnFloor), receipts: [] },
            };
          }
          text = JSON.stringify(visible);
        }
        if (Buffer.byteLength(text) > 23_900) {
          visible = { error: report.error, program: programId, outcome: finalMetrics.outcome,
            recovery: { ...recovery.summary(turnFloor), receipts: [] } };
          text = JSON.stringify(visible);
        }
        // Converge the self-counted byte metric with its serialized size.
        if (visible.metrics) {
          (visible.metrics as Record<string, unknown>).diagnostics = finalMetrics.diagnostics;
          (visible.metrics as Record<string, unknown>).calls = finalMetrics.calls;
        }
        do {
          finalMetrics.bytesExposedToPi = Buffer.byteLength(text);
          if (visible.metrics) {
            (visible.metrics as Record<string, unknown>).bytesExposedToPi =
              finalMetrics.bytesExposedToPi;
            text = JSON.stringify(visible);
          }
        } while (finalMetrics.bytesExposedToPi !== Buffer.byteLength(text));
        // The durable trace keeps every call event even when the model-facing
        // text omits them above; never treat the tool text as audit.
        metrics.bytesExposedToPi = finalMetrics.bytesExposedToPi;
        finishProgram(finalMetrics.outcome);
        finalMetrics.traceDropped = sink?.dropped ?? 0;
        // Bounded host history; details omit the retained finalization JSON.
        try {
          history.set(programId, {
            sequence,
            ...(finalMetrics.outcome === "ok" && !report.error ? { json: JSON.stringify(report.result) } : {}),
            outcome: finalMetrics.outcome,
            ...(report.error ? { error: report.error } : {}),
            logs: [...(report.logs ?? [])],
            metrics: structuredClone(finalMetrics),
          });
          while (history.size > 20) {
            const oldest = history.keys().next();
            if (oldest.done) break;
            history.delete(oldest.value);
          }
        } catch {
          // History is best-effort; never fail the run for it.
        }
        return { ...report, program: programId, text };
      })();
      active.add(task);
      void task.finally(() => active.delete(task));
      return task;
    },
    // Idempotent and concurrent-safe: concurrent callers share one close
    // pass, so every owned connector is closed exactly once. All connectors
    // and the sink are attempted even when one close rejects; the first
    // error (or an AggregateError for several) is rethrown to preserve
    // error reporting.
    async close() {
      closePromise ??= (async () => {
        closed = true;
        selected = undefined;
        history.clear();
        recovery.clear();
        shutdown.abort();
        await Promise.allSettled(active);
        history.clear();
        recovery.clear();
        let workspaceError: unknown;
        let hasWorkspaceError = false;
        try {
          workspace.close();
        } catch (error) {
          workspaceError = error;
          hasWorkspaceError = true;
        }
        const results = await Promise.allSettled([
          ...connectors.map((connector) =>
            Promise.resolve().then(() => connector.close()),
          ),
          ...(sink
            ? [Promise.resolve().then(() => (sink as TraceSink).close())]
            : []),
        ]);
        const errors: unknown[] = [
          ...(hasWorkspaceError ? [workspaceError] : []),
          ...results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        ];
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1)
          throw new AggregateError(errors, `${errors.length} errors during session close`);
      })();
      return closePromise;
    },
  };
}
