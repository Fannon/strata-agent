import type { CapabilityBroker, Metrics } from '../capabilities/broker.ts';

/** Bun worker hosts an interpreter with no ambient host APIs. */
export function execute(code: string, broker: CapabilityBroker, metrics: Metrics, signal: AbortSignal, timeoutMs = 5000): Promise<{ result?: unknown; error?: string; logs: string[] }> {
  return new Promise(resolve => {
    const controller = new AbortController();
    const worker = new Worker(new URL('./worker.ts', import.meta.url).href);
    let finished = false;
    const finish = (result: { result?: unknown; error?: string; logs: string[] }) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      controller.abort();
      worker.terminate();
      resolve(result);
    };
    const abort = () => finish({ error: 'Execution cancelled', logs: [] });
    const timer = setTimeout(() => finish({ error: `Execution timeout (${timeoutMs}ms)`, logs: [] }), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { event.preventDefault(); finish({ error: event.message, logs: [] }); };
    worker.onmessage = async event => {
      const message = event.data;
      if (finished) return;
      if (message.type === 'done') { finish(message); return; }
      if (message.type === 'invoke') {
        try {
          const value = await broker.invoke(message.capability, message.operation, message.input, controller.signal, metrics);
          if (!finished) worker.postMessage({ type: 'response', id: message.id, value });
        } catch (error) {
          if (!finished) worker.postMessage({ type: 'response', id: message.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    };
    if (signal.aborted) { abort(); return; }
    worker.postMessage({ type: 'run', code, capability: broker.manifest.id, operations: broker.manifest.operations.map(op => op.name), timeoutMs });
  });
}
