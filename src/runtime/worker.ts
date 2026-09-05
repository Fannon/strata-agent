import { getQuickJS, type QuickJSDeferredPromise } from "quickjs-emscripten";

let nextId = 0;
const pending = new Map<number, QuickJSDeferredPromise>();
let respond:
  | ((message: { id: number; value?: unknown; error?: string }) => void)
  | undefined;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === "response") {
    respond?.(event.data);
    return;
  }
  if (event.data.type !== "run") return;
  const { code, surfaces, timeoutMs } = event.data as {
    code: string;
    surfaces: Array<{ capability: string; operations: string[] }>;
    timeoutMs: number;
  };
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  const deadline = Date.now() + timeoutMs;
  runtime.setInterruptHandler(() => Date.now() >= deadline);
  const vm = runtime.newContext();
  const logs: string[] = [];
  let logBytes = 0;
  respond = (message) => {
    const deferred = pending.get(message.id);
    if (!deferred) return;
    pending.delete(message.id);
    const handle = message.error
      ? vm.newError(message.error)
      : vm.newString(JSON.stringify(message.value) ?? "null");
    if (message.error) deferred.reject(handle);
    else deferred.resolve(handle);
    handle.dispose();
    deferred.dispose();
  };
  vm.newFunction("__invoke", (cap, op, input) => {
    const deferred = vm.newPromise();
    const id = nextId++;
    pending.set(id, deferred);
    self.postMessage({
      type: "invoke",
      id,
      capability: vm.getString(cap),
      operation: vm.getString(op),
      input: JSON.parse(vm.getString(input)),
    });
    return deferred.handle;
  }).consume((fn) => vm.setProp(vm.global, "__invoke", fn));
  vm.newFunction("__log", (value) => {
    const line = vm.getString(value);
    if (
      logBytes + new TextEncoder().encode(line).length <= 2048 &&
      logs.length < 20
    ) {
      logs.push(line);
      logBytes += new TextEncoder().encode(line).length;
    }
  }).consume((fn) => vm.setProp(vm.global, "__log", fn));
  runtime.setModuleLoader((name) => {
    if (name === "program") return code;
    const surface = surfaces.find((s) => "@cap/" + s.capability === name || "@c/" + s.capability === name);
    if (!surface) throw new Error(`Module unavailable: ${name}`);
    const ops = JSON.stringify(surface.operations);
    const cap = JSON.stringify(surface.capability);
    return `const invoke = globalThis.__invoke; export const api = Object.freeze(Object.fromEntries(${ops}.map(name => [name, async input => JSON.parse(await invoke(${cap}, name, JSON.stringify(input)))])));`;
  });
  try {
    vm.unwrapResult(
      vm.evalCode(
        "globalThis.console = Object.freeze({log: (...args) => __log(JSON.stringify(args))});",
      ),
    ).dispose();
    vm.unwrapResult(
      vm.evalCode(
        `import { main } from 'program'; globalThis.__completion = Promise.resolve().then(() => main()).then(value => { const json = JSON.stringify(value); if (json === undefined) throw new Error('main() must return a JSON result'); if (json.length > 8192) throw new Error('Result exceeds 8192 characters; aggregate or select fewer records'); return json; });`,
        "entry",
        { type: "module" },
      ),
    ).dispose();
    const completion = vm.getProp(vm.global, "__completion");
    try {
      while (true) {
        if (Date.now() >= deadline) throw new Error("Execution timeout");
        const jobs = runtime.executePendingJobs();
        if (jobs.error) {
          const error = vm.dump(jobs.error);
          jobs.error.dispose();
          throw new Error(JSON.stringify(error));
        }
        const state = vm.getPromiseState(completion);
        if (state.type === "fulfilled") {
          const json = vm.getString(state.value);
          state.value.dispose();
          self.postMessage({ type: "done", result: JSON.parse(json), logs });
          break;
        }
        if (state.type === "rejected") {
          const error = vm.dump(state.error);
          state.error.dispose();
          throw new Error(error?.message ?? JSON.stringify(error));
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    } finally {
      completion.dispose();
    }
  } catch (error) {
    self.postMessage({
      type: "done",
      error: error instanceof Error ? error.message : String(error),
      logs,
    });
  } finally {
    respond = undefined;
    for (const deferred of pending.values()) deferred.dispose();
    pending.clear();
    vm.dispose();
    runtime.dispose();
  }
};
