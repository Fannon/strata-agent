/**
 * Deterministic QuickJS vs direct-Bun executor comparison (issue 027).
 *
 * Offline and model-free: the same checked programs run on both engines
 * through the shared compiler, broker validation, grants and instrumentation.
 * Covers startup, trivial/sequential/parallel calls, payload scaling,
 * in-engine computation, cancellation, timeout recovery, error parity,
 * ambient-authority probes and tracing overhead.
 *
 * Usage: bun examples/executor-compare.ts [--repeats N] [--out results.json]
 *
 * Prints a Markdown table plus JSON. Timing is wall-clock on this machine;
 * treat it as this checkout's evidence, not a general runtime claim.
 * Honest labeling: identical contracts measure API adherence; only the
 * ambient probes speak to containment, and they show Bun is NOT contained.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureConnection } from "./fixture.ts";
import { connectRepo } from "../src/capabilities/repo/connector.ts";
import { createSession } from "../src/session.ts";
import type { ExecutorKind } from "../src/runtime/executor.ts";

const args = process.argv.slice(2);
const repeatsArg = args.indexOf("--repeats");
const repeats = repeatsArg === -1 ? 3 : Number(args[repeatsArg + 1] ?? 3);
const outArg = args.indexOf("--out");
const outFile = outArg === -1 ? undefined : args[outArg + 1];

interface CaseResult {
  case: string;
  engine: ExecutorKind;
  compileMs: number[];
  execMs: number[];
  outcome: string;
  detail: string;
}
const results: CaseResult[] = [];
const record = (c: string, e: ExecutorKind) => {
  const r: CaseResult = { case: c, engine: e, compileMs: [], execMs: [], outcome: "", detail: "" };
  results.push(r);
  return r;
};

const engines: ExecutorKind[] = ["quickjs", "bun"];
const dir = await mkdtemp(join(tmpdir(), "strata-compare-"));
await writeFile(join(dir, "package.json"), JSON.stringify({ name: "demo", version: "1.2.3" }));

const timings = async (
  name: string,
  source: string,
  make: (engine: ExecutorKind) => Promise<{ session: Awaited<ReturnType<typeof createSession>> }>,
) => {
  // Alternate engine order per repeat so cold-start/warmup noise does not
  // systematically favor one engine (the compiler itself is shared).
  const byEngine = new Map<ExecutorKind, CaseResult>(engines.map((e) => [e, record(name, e)]));
  for (let i = 0; i < repeats; i++) {
    const order = i % 2 === 0 ? engines : [...engines].reverse();
    for (const engine of order) {
      const r = byEngine.get(engine)!;
      const { session } = await make(engine);
      try {
        const out = await session.run(source, { timeoutMs: 15_000 });
        r.compileMs.push(Math.round(out.metrics.compileMs * 10) / 10);
        r.execMs.push(Math.round(out.metrics.executionMs * 10) / 10);
        r.outcome = out.metrics.outcome;
        if (out.error) r.detail = out.error.slice(0, 160);
        else if (typeof out.result === "object")
          r.detail = JSON.stringify(out.result).slice(0, 160);
        else r.detail = String(out.result).slice(0, 160);
      } finally {
        await session.close();
      }
    }
  }
};

const fixtureMake = () => async (engine: ExecutorKind) => {
  const { manifest, connector } = await fixtureConnection();
  const session = await createSession(manifest, connector, new Set([
    "customers", "invoices", "untyped", "records", "broken", "stats", "slow",
  ]), { executor: engine });
  return { session };
};
const prog = (body: string) =>
  `import { api } from '@c/fixture';\nexport async function main() { ${body} }`;

// Unrecorded warmup: the first compile in a process pays language-service
// init, which would otherwise systematically penalize whichever engine runs first.
{
  const { session } = await fixtureMake()("quickjs");
  try {
    await session.run(prog("return await api.stats({});"), { timeoutMs: 15_000 });
  } finally {
    await session.close();
  }
}

// Cold sessions per repeat: startup includes worker spawn (and QuickJS WASM init).
await timings("startup: no-op", "export async function main() { return 1; }", fixtureMake());
await timings("trivial call: stats", prog("return await api.stats({});"), fixtureMake());
await timings(
  "sequential: 5x stats",
  prog("let n = 0; for (let i = 0; i < 5; i++) n += (await api.stats({})).invocations; return n;"),
  fixtureMake(),
);
await timings(
  "parallel: 5x stats",
  prog("const rs = await Promise.all([api.stats({}), api.stats({}), api.stats({}), api.stats({}), api.stats({})]); return rs.length;"),
  fixtureMake(),
);
for (const count of [100, 1000, 10000]) {
  await timings(
    `payload: records(${count}) filter`,
    prog(`const r = await api.records({ count: ${count} }); return r.records.filter(r => r.score > 0.98).slice(0, 3).map(r => r.id);`),
    fixtureMake(),
  );
}
await timings(
  "compute: fib(22)",
  "export async function main() { const fib = (n: number): number => n < 2 ? n : fib(n-1) + fib(n-2); return fib(22); }",
  fixtureMake(),
);

// Cancellation, timeout recovery and error parity use one warm session per engine.
for (const engine of engines) {
  const { session } = await fixtureMake()(engine);
  try {
    const abort = new AbortController();
    const running = session.run(prog("return await api.slow({});"), { signal: abort.signal });
    setTimeout(() => abort.abort(), 100);
    const cancelled = await running;
    const cancelRec = record("cancel: slow + abort", engine);
    cancelRec.outcome = cancelled.metrics.outcome;
    cancelRec.execMs = [Math.round(cancelled.metrics.executionMs * 10) / 10];
    cancelRec.detail = (cancelled.error ?? "").slice(0, 120);

    const timed = await session.run("export function main() { while(true) {} }", { timeoutMs: 200 });
    const timeoutRec = record("timeout: infinite loop + recovery", engine);
    timeoutRec.outcome = timed.metrics.outcome;
    timeoutRec.execMs = [Math.round(timed.metrics.executionMs * 10) / 10];
    const recovered = await session.run(prog("return await api.stats({});"));
    timeoutRec.detail = `timeout=${(timed.error ?? "").slice(0, 60)} recovery=${recovered.metrics.outcome}`;

    const cases: Array<[string, string]> = [
      ["policy", prog("return await api.deleteAll({});")],
      ["input", prog("return await api.records({ count: -1 });")],
      ["output", prog("return await api.broken({});")],
      ["compile", prog("return await api.customers({ county: 'DE' });")],
    ];
    for (const [name, source] of cases) {
      const out = await session.run(source);
      const rec = record(`parity: ${name}`, engine);
      rec.outcome = out.metrics.outcome;
      rec.detail = `${out.metrics.calls[0]?.failure ?? "compile"}: ${(out.error ?? "").slice(0, 100)}`;
    }
  } finally {
    await session.close();
  }
}

// Repository slice parity on both engines.
for (const engine of engines) {
  const { manifest, connector } = await connectRepo({ root: dir });
  const session = await createSession(manifest, connector, new Set(["readText"]), { executor: engine });
  try {
    const ok = await session.run(
      `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "package.json" }); }`,
    );
    const rec = record("repo: read + denial", engine);
    rec.outcome = ok.metrics.outcome;
    const denied = await session.run(
      `import { api } from '@c/repo';\nexport async function main() { return await api.readText({ path: "../x" }); }`,
    );
    rec.detail = `read=${ok.metrics.outcome} denial=${denied.metrics.calls[0]?.failure}`;
  } finally {
    await session.close();
  }
}

// Ambient-authority probes with an independent effect counter (a canary file).
for (const engine of engines) {
  const canary = join(dir, `canary-${engine}.txt`);
  await rm(canary, { force: true });
  const { session } = await fixtureMake()(engine);
  try {
    const probe = await session.run(
      `import { api } from '@c/fixture';\nexport async function main() { await api.stats({}); const g = globalThis as any; const seen = [typeof g.process, typeof g.Bun, typeof g.fetch]; const B = g.Bun; if (B && typeof B.write === "function") { await B.write(${JSON.stringify(canary)}, "effect"); return { seen, wrote: true }; } return { seen, wrote: false }; }`,
    );
    const rec = record("ambient: globals + canary write", engine);
    rec.outcome = probe.metrics.outcome;
    let effect = "absent";
    try {
      effect = await Bun.file(canary).text();
    } catch { /* absent */ }
    rec.detail = `result=${JSON.stringify(probe.result).slice(0, 120)} canary=${effect}`;
  } finally {
    await session.close();
  }
}

// Tracing overhead: same trivial program with the JSONL sink on vs off.
for (const engine of engines) {
  for (const traced of [false, true]) {
    const { manifest, connector } = await fixtureConnection();
    const traceFile = traced ? join(dir, `trace-${engine}.jsonl`) : undefined;
    const session = await createSession(manifest, connector, new Set(["stats"]), {
      executor: engine,
      traceFile,
    });
    try {
      const rec = record(`overhead: trivial call trace=${traced ? "on" : "off"}`, engine);
      for (let i = 0; i < repeats; i++) {
        const out = await session.run(prog("return await api.stats({});"));
        rec.execMs.push(Math.round(out.metrics.executionMs * 10) / 10);
        rec.outcome = out.metrics.outcome;
      }
    } finally {
      await session.close();
    }
  }
}

await rm(dir, { recursive: true, force: true });

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log("| case | engine | compile ms (mean) | exec ms (mean) | outcome | detail |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const r of results) {
  console.log(
    `| ${r.case} | ${r.engine} | ${mean(r.compileMs).toFixed(1)} | ${mean(r.execMs).toFixed(1)} | ${r.outcome} | ${r.detail.replace(/\|/g, "/")} |`,
  );
}
if (outFile) {
  await Bun.write(outFile, JSON.stringify({ repeats, results }, null, 2));
  console.error(`Wrote ${outFile}`);
}
