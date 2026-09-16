/** AppWorld direct-tool reference arm (issue 042, gate 3 offline preparation).
 *
 * Launched by examples/appworld/controller.py with --config <path> when
 * --direct-script is given. Connects to the SAME upstream AppWorld MCP
 * server over stdio (identical discovery: listTools -> manifest), then
 * executes a canned call script with the SAME input/output validation and
 * allowlist policy as the typed broker:
 * - validators come from the same `validator()` factory with the same
 *   `acceptNaiveDateTime` boundary setting (040; recorded in the summary);
 * - failure categories mirror the broker: policy / input / output /
 *   transport (isError included); no validation is bypassed;
 * - per-call metrics mirror broker CallMetrics (callId, backend, rawBytes,
 *   durationMs, failure) without program/trace correlation.
 *
 * This is the harness-level reference for parity checks and the later
 * model pilot. Model-facing direct tools and ordinary scripting rules for
 * the pilot are predeclared in 042, not implemented here.
 */

import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectMcp } from "../../src/capabilities/mcp/connector.ts";
import { validator, type ValidatorOptions } from "../../src/capabilities/schemas.ts";
import type {
  CapabilityConnector,
  CapabilityModule,
  JsonSchema,
} from "../../src/capabilities/manifest.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APPWORLD_BASE = resolve(REPO_ROOT, ".work", "appworld");

type Failure = "policy" | "input" | "output" | "transport";

interface DirectCall {
  op: string;
  input: Record<string, unknown>;
}

interface CallRecord {
  callId: string;
  operation: string;
  backend: string;
  invoked: boolean;
  rawBytes: number;
  durationMs: number;
  failure?: Failure;
  ok: boolean;
}

function matchesWhere(row: unknown, where: Record<string, unknown>): boolean {
  if (row === null || typeof row !== "object") return false;
  const rec = row as Record<string, unknown>;
  return Object.entries(where).every(([key, want]) => {
    const got = rec[key];
    if (typeof want === "string" && want.startsWith("~")) {
      return typeof got === "string" && got.toLowerCase().includes(want.slice(1).toLowerCase());
    }
    return got === want;
  });
}

function select(spec: Record<string, unknown>, results: unknown[]): unknown {
  const { call, path, where, get } = spec as {
    call?: unknown;
    path?: unknown;
    where?: unknown;
    get?: unknown;
  };
  if (typeof call !== "number" || typeof path !== "string" || typeof get !== "string") {
    throw new Error("$select needs {call: number, path: string, get: string}");
  }
  const list = dig(call, path, results);
  if (!Array.isArray(list)) throw new Error(`$select path "${path}" is not a list`);
  const predicate =
    where === undefined ? {} : (where as Record<string, unknown>);
  if (predicate === null || typeof predicate !== "object" || Array.isArray(predicate)) {
    throw new Error("$select where must be an object");
  }
  const row = list.find((item) => matchesWhere(item, predicate));
  if (row === undefined) throw new Error("$select found no matching element");
  let node: unknown = row;
  for (const part of get.split(".")) {
    if (node !== null && typeof node === "object" && part in node) {
      node = Reflect.get(node, part);
    } else {
      throw new Error(`$select get "${get}" not found`);
    }
  }
  return node;
}

/** Follow a dotted path from an earlier call result. */
function dig(call: number, path: string, results: unknown[]): unknown {  const base: unknown = results[call];
  if (base === undefined) throw new Error(`$call ${call} has no result yet`);
  let node: unknown = base;
  for (const part of path.split(".")) {
    if (node !== null && typeof node === "object" && part in node) {
      node = Reflect.get(node, part);
    } else {
      throw new Error(`$path "${path}" not found in call ${call} result`);
    }
  }
  return node;
}

/** Resolve value references against earlier call results:
 * - `{"$call": N, "$path": "a.b.0.c"}`: dotted lookup (arrays by index).
 * - `{"$select": {call, path, where, get}}`: first array element under
 *   `path` matching all `where` predicates; `get` is dotted within it.
 *   A `where` value `"~x"` means case-insensitive substring, else equality.
 * Both are task-independent plumbing so scripts stay declarative while
 * credentials stay runtime-discovered (never hardcoded into scripts). */
export function resolveRefs(value: unknown, results: unknown[]): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, results));
  if (value !== null && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.$call === "number" && typeof rec.$path === "string") {
      return dig(rec.$call, rec.$path, results);
    }
    if (rec.$select !== null && typeof rec.$select === "object") {
      return select(rec.$select as Record<string, unknown>, results);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = resolveRefs(v, results);
    return out;
  }
  return value;
}

export interface DirectOptions {
  outputFormats?: ValidatorOptions;
  backend?: string;
  /** Operations callable through this runner; defaults to the manifest set.
   * The live harnesses pass the full manifest set in both arms. */
  allowed?: ReadonlySet<string>;
}

/** Pure call core shared by main() and parity tests: allowlist gate,
 * $ref resolution, input validation, dispatch, isError check, output
 * validation — the same order and categories as the typed broker. */
export async function runDirectCalls(
  manifest: CapabilityModule,
  connector: CapabilityConnector,
  script: DirectCall[],
  options: DirectOptions = {},
): Promise<{ calls: CallRecord[]; results: unknown[]; failures: number }> {
  const allowed = options.allowed ?? new Set<string>(manifest.operations.map((o) => o.name));
  const inputs = new Map<string, (v: unknown) => string | undefined>();
  const outputs = new Map<string, ((v: unknown) => string | undefined) | undefined>();
  for (const op of manifest.operations) {
    inputs.set(op.name, validator(op.inputSchema));
    outputs.set(
      op.name,
      op.outputSchema ? validator(op.outputSchema as JsonSchema, options.outputFormats ?? {}) : undefined,
    );
  }
  const backend = options.backend ?? connector.backend ?? "unknown";
  const calls: CallRecord[] = [];
  const results: unknown[] = [];
  let failures = 0;
  for (let i = 0; i < script.length; i++) {
    const { op, input } = script[i];
    const started = performance.now();
    const record: CallRecord = {
      callId: `d${i + 1}`,
      operation: String(op).slice(0, 128),
      backend,
      invoked: false,
      rawBytes: 0,
      durationMs: 0,
      ok: false,
    };
    calls.push(record);
    const fail = (failure: Failure): void => {
      record.failure = failure;
      record.durationMs = performance.now() - started;
      failures++;
    };
    if (!allowed.has(op) || !inputs.has(op)) {
      fail("policy");
      results.push(undefined);
      continue;
    }
    let resolved: unknown;
    try {
      resolved = resolveRefs(input, results);
    } catch {
      fail("input");
      results.push(undefined);
      continue;
    }
    const inputError = inputs.get(op)!(resolved);
    if (inputError) {
      fail("input");
      results.push(undefined);
      continue;
    }
    record.invoked = true;
    let result;
    try {
      result = await connector.invoke(
        op,
        resolved as Record<string, unknown>,
        AbortSignal.timeout(60000),
      );
    } catch {
      fail("transport");
      results.push(undefined);
      continue;
    }
    record.rawBytes = result.rawBytes;
    if (result.isError) {
      fail("transport");
      results.push(undefined);
      continue;
    }
    const check = outputs.get(op);
    if (check) {
      const outputError = check(result.structured);
      if (outputError) {
        fail("output");
        results.push(undefined);
        continue;
      }
    }
    record.durationMs = performance.now() - started;
    record.ok = true;
    results.push(result.structured);
  }
  return { calls, results, failures };
}

function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { config: { type: "string" } } });
  if (!values.config) {
    console.error("missing required --config <path>");
    return 2;
  }
  const raw = JSON.parse(await readFile(values.config, "utf8")) as Record<string, unknown>;
  for (const f of ["root", "python", "remoteApisUrl", "artifactDir", "directScript"] as const) {
    if (typeof raw[f] !== "string" || !(raw[f] as string)) throw new Error(`config.${f} missing`);
  }
  const artifactDir = raw.artifactDir as string;
  const scriptPath = raw.directScript as string;
  if (!isWithin(artifactDir, APPWORLD_BASE)) throw new Error("artifactDir escapes .work/appworld");
  if (!isWithin(scriptPath, REPO_ROOT)) throw new Error("directScript escapes repo");
  await mkdir(artifactDir, { recursive: true });

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env.APPWORLD_ROOT = raw.root as string;
  env.APPWORLD_CACHE = `${raw.root as string}/cache`;

  const connected = await connectMcp("appworld", {
    command: raw.python as string,
    args: [
      "-m", "appworld.cli", "serve", "mcp", "stdio",
      "--app-names", (raw.apps as string[]).join(","),
      "--output-type", "both",
      "--remote-apis-url", raw.remoteApisUrl as string,
      "--root", raw.root as string,
    ],
    env,
  });
  const outputFormats: ValidatorOptions =
    (raw.outputCompatibility as { acceptNaiveDateTime?: boolean } | undefined)
      ?.acceptNaiveDateTime === true
      ? { acceptNaiveDateTime: true }
      : {};
  const outputCompatibility = {
    policy: outputFormats.acceptNaiveDateTime === true ? "accept-naive-date-time" : "strict-rfc3339",
    scope: "appworld module outputs only",
    globalDefault: "strict-rfc3339",
    provenance: "issue 040; shared by both 042 arms",
  };

  const script = JSON.parse(await readFile(scriptPath, "utf8")) as { calls: DirectCall[] };
  if (!Array.isArray(script.calls)) throw new Error("direct script needs a calls array");

  let calls: CallRecord[];
  let failures: number;
  let results: unknown[];
  try {
    ({ calls, failures, results } = await runDirectCalls(
      connected.manifest,
      connected.connector,
      script.calls,
      { outputFormats },
    ));
  } finally {
    await connected.connector.close();
  }
  // Parity debugging only: persists secrets (tokens) alongside results.
  // Local ignored artifacts exclusively; never enabled by default.
  if (raw.persistResults === true) {
    await writeFile(
      resolve(artifactDir, "results.json"),
      JSON.stringify({ note: "LOCAL ONLY: may contain world tokens", results }, null, 2) + "\n",
      "utf8",
    );
  }
  await writeFile(
    resolve(artifactDir, "summary.json"),
    JSON.stringify(
      {
        mode: "direct",
        operationCount: connected.manifest.operations.length,
        missingOutputSchemas: connected.manifest.operations.filter((o) => o.outputSchema === undefined).length,
        calls,
        failures,
        outputCompatibility,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`direct: ${calls.length} calls, ${failures} failures`);
  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    console.error(`direct failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
