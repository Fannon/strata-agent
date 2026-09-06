import type {
  CapabilityBroker,
  CallTraceContext,
  Metrics,
} from "../capabilities/broker.ts";

/** Terminal execution outcome, reported structurally (never parsed from prose). */
export type ExecutionOutcome = "ok" | "cancelled" | "timeout" | "error";
export interface ExecutionResult {
  result?: unknown;
  error?: string;
  logs: string[];
  outcome: ExecutionOutcome;
}

/** Bun worker hosts an interpreter with no ambient host APIs. */
export function execute(
  code: string,
  broker: CapabilityBroker,
  metrics: Metrics,
  signal: AbortSignal,
  timeoutMs = 5000,
  trace?: CallTraceContext,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const worker = new Worker(new URL("./worker.ts", import.meta.url).href);
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
