import { writeFile } from "node:fs/promises";

export interface Captured {
  stdout: string; stderr: string; exitCode: number | null;
  termination: "timeout" | "output_limit" | "spawn_error" | null; ms: number;
}

/** POSIX process-group ownership keeps timed-out Pi/tool children from outliving a cell. */
export async function capture(command: string[], options: {
  cwd: string; env: Record<string, string | undefined>; timeoutMs: number;
  stdoutPath: string; stderrPath: string; maxBytes?: number;
}): Promise<Captured> {
  if (process.platform === "win32") throw new Error("Benchmark process supervision currently requires POSIX");
  const started = performance.now();
  let termination: "timeout" | "output_limit" | "spawn_error" | null = null;
  let child;
  try { child = Bun.spawn(command, { cwd: options.cwd, env: options.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true }); }
  catch (error) {
    const stderr = error instanceof Error ? error.message : String(error);
    await Promise.all([writeFile(options.stdoutPath, ""), writeFile(options.stderrPath, stderr)]);
    return { stdout: "", stderr, exitCode: null, termination: "spawn_error" as const, ms: performance.now() - started };
  }
  const kill = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* group already gone */ } };
  const timer = setTimeout(() => { termination = "timeout"; kill(); }, options.timeoutMs);
  const read = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    const cap = options.maxBytes ?? 16 * 1024 * 1024;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const remaining = cap - bytes;
      chunks.push(value.subarray(0, remaining));
      bytes += Math.min(remaining, value.byteLength);
      if (value.byteLength > remaining) { termination ??= "output_limit"; kill(); await reader.cancel(); break; }
    }
    return Buffer.concat(chunks).toString("utf8");
  };
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      read(child.stdout), read(child.stderr),
      child.exited.then((code) => { kill(); return code; }),
    ]);
    await Promise.all([writeFile(options.stdoutPath, stdout), writeFile(options.stderrPath, stderr)]);
    return { stdout, stderr, exitCode, termination, ms: performance.now() - started };
  } finally { clearTimeout(timer); kill(); }
}
