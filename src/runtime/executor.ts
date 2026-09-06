import type {
  CapabilityBroker,
  CallTraceContext,
  Metrics,
} from "../capabilities/broker.ts";

/** Selectable execution engine. QuickJS is the contained baseline; direct Bun
 *  is opt-in and measures cooperative API adherence (see docs/executors.md). */
export type ExecutorKind = "quickjs" | "bun";

/** Terminal execution outcome, reported structurally (never parsed from prose). */
export type ExecutionOutcome = "ok" | "cancelled" | "timeout" | "error";
export interface ExecutionResult {
  result?: unknown;
  error?: string;
  logs: string[];
  outcome: ExecutionOutcome;
}

export function parseExecutor(value: string | undefined): ExecutorKind {
  if (!value || value === "quickjs") return "quickjs";
  if (value === "bun") return "bun";
  throw new Error(`Unknown STRATA_EXECUTOR "${value}"; expected "quickjs" or "bun"`);
}

/** Shared parent driver: worker lifecycle, cancellation, timeout and the
 *  broker invoke bridge. Both workers speak the same run/invoke/response/done
 *  protocol; only the in-worker evaluation differs. */
function drive(
  worker: Worker,
  code: string,
  broker: CapabilityBroker,
  metrics: Metrics,
  signal: AbortSignal,
  timeoutMs: number,
  trace: CallTraceContext | undefined,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    let finished = false;
    const finish = (result: ExecutionResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      controller.abort();
      worker.terminate();
      resolve(result);
    };
    const abort = () =>
      finish({ error: "Execution cancelled", logs: [], outcome: "cancelled" });
    const timer = setTimeout(
      () =>
        finish({
          error: `Execution timeout (${timeoutMs}ms)`,
          logs: [],
          outcome: "timeout",
        }),
      timeoutMs,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ error: event.message, logs: [], outcome: "error" });
    };
    worker.onmessage = async (event) => {
      const message = event.data;
      if (finished) return;
      if (message.type === "done") {
        finish({
          result: message.result,
          error: message.error,
          logs: message.logs,
          outcome: message.error ? "error" : "ok",
        });
        return;
      }
      if (message.type === "invoke") {
        try {
          const value = await broker.invoke(
            message.capability,
            message.operation,
            message.input,
            controller.signal,
            metrics,
            trace,
          );
          if (!finished)
            worker.postMessage({ type: "response", id: message.id, value });
        } catch (error) {
          if (!finished)
            worker.postMessage({
              type: "response",
              id: message.id,
              error: error instanceof Error ? error.message : String(error),
            });
        }
      }
    };
    if (signal.aborted) {
      abort();
      return;
    }
    worker.postMessage({
      type: "run",
      code,
      surfaces: broker.surfaces,
      timeoutMs,
    });
  });
}

/** QuickJS baseline: separate interpreter object world, explicit JSON
 *  bindings, module allowlist, heap/stack limits and interrupt handler. */
export function execute(
  code: string,
  broker: CapabilityBroker,
  metrics: Metrics,
  signal: AbortSignal,
  timeoutMs = 5000,
  trace?: CallTraceContext,
): Promise<ExecutionResult> {
  return drive(
    new Worker(new URL("./worker.ts", import.meta.url).href),
    code,
    broker,
    metrics,
    signal,
    timeoutMs,
    trace,
  );
}

/** Direct Bun: disposable worker per run with fresh JS state but ambient host
 *  authority. Shared checking, validation, grants and instrumentation;
 *  cooperative adherence only, not containment. */
export function executeBun(
  code: string,
  broker: CapabilityBroker,
  metrics: Metrics,
  signal: AbortSignal,
  timeoutMs = 5000,
  trace?: CallTraceContext,
): Promise<ExecutionResult> {
  return drive(
    new Worker(new URL("./bun-runner.ts", import.meta.url).href),
    code,
    broker,
    metrics,
    signal,
    timeoutMs,
    trace,
  );
}

/** Smallest executor contract: checked emitted code and capability bindings
 *  in; result, diagnostics, cancellation and trace events out. */
export function executeWith(
  engine: ExecutorKind,
  code: string,
  broker: CapabilityBroker,
  metrics: Metrics,
  signal: AbortSignal,
  timeoutMs = 5000,
  trace?: CallTraceContext,
): Promise<ExecutionResult> {
  return engine === "bun"
    ? executeBun(code, broker, metrics, signal, timeoutMs, trace)
    : execute(code, broker, metrics, signal, timeoutMs, trace);
}
