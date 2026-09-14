/** AppWorld replay harness (issue037 spike).
 *
 * Launched by examples/appworld/controller.py with --config <path>.
 * Spawns the upstream AppWorld MCP server over stdio, builds a live
 * session, and either inspects schemas (--inspect) or runs a LOCAL
 * user-supplied TS program against them. All artifacts stay local.
 */

import { parseArgs } from "node:util";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectMcp } from "../../src/capabilities/mcp/connector.ts";
import { createSession } from "../../src/session.ts";
import { declarations } from "../../src/capabilities/schemas.ts";

interface ReplayConfig {
  root: string;
  python: string;
  remoteApisUrl: string;
  apps: string[];
  artifactDir: string;
  program?: string;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APPWORLD_BASE = resolve(REPO_ROOT, ".work", "appworld");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isWithin(child: string, parent: string): boolean {
  const rel = resolve(child);
  return rel === parent || rel.startsWith(parent + "/");
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function validateConfig(raw: unknown): ReplayConfig {
  if (!isRecord(raw)) throw new Error("config must be a JSON object");
  const root = nonEmptyString(raw.root);
  const python = nonEmptyString(raw.python);
  const remoteApisUrl = nonEmptyString(raw.remoteApisUrl);
  const artifactDir = nonEmptyString(raw.artifactDir);
  if (!root || !python || !remoteApisUrl || !artifactDir) {
    throw new Error("config missing required string fields (root, python, remoteApisUrl, artifactDir)");
  }
  if (!Array.isArray(raw.apps) || raw.apps.length === 0 || !raw.apps.every((a) => nonEmptyString(a))) {
    throw new Error("config.apps must be a non-empty array of non-empty strings");
  }
  for (const field of [root, python, artifactDir] as const) {
    if (!isAbsolute(field)) throw new Error(`config path must be absolute: ${field}`);
  }
  if (!isWithin(artifactDir, APPWORLD_BASE)) {
    throw new Error(`artifactDir must resolve under ${APPWORLD_BASE}`);
  }
  if (!isWithin(root, APPWORLD_BASE)) {
    throw new Error(`root must resolve under ${APPWORLD_BASE}`);
  }
  let url: URL;
  try {
    url = new URL(remoteApisUrl);
  } catch {
    throw new Error("config.remoteApisUrl is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("config.remoteApisUrl must be http(s)");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("config.remoteApisUrl must be loopback");
  }
  const programRaw = raw.program;
  let program: string | undefined;
  if (programRaw !== undefined) {
    program = nonEmptyString(programRaw);
    if (!program) throw new Error("config.program must be a non-empty string when present");
    if (!isAbsolute(program)) throw new Error("config.program must be absolute");
    if (!isWithin(program, REPO_ROOT)) throw new Error("config.program must resolve under the repo");
    if (!program.endsWith(".ts")) throw new Error("config.program must be a .ts module");
  }
  return { root, python, remoteApisUrl, apps: raw.apps as string[], artifactDir, program };
}

async function writeJson(path: string, payload: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      inspect: { type: "boolean", default: false },
    },
  });
  if (!values.config) {
    console.error("missing required --config <path>");
    return 2;
  }
  const inspect = values.inspect === true;

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(values.config, "utf8")) as unknown;
  } catch (error) {
    console.error(`cannot read config: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  // All validation happens before any subprocess starts.
  const config = validateConfig(raw);
  if (!await isDirectory(config.root)) throw new Error(`root is not a directory: ${config.root}`);
  if (!await isFile(config.python)) throw new Error(`python not found: ${config.python}`);
  if (!await isDirectory(config.artifactDir)) {
    throw new Error(`artifactDir is not a directory: ${config.artifactDir}`);
  }
  if (!inspect) {
    if (!config.program) throw new Error("run mode requires config.program");
    if (!await isFile(config.program)) throw new Error(`program not found: ${config.program}`);
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.APPWORLD_ROOT = config.root;
  env.APPWORLD_CACHE = `${config.root}/cache`;

  const connected = await connectMcp("appworld", {
    command: config.python,
    args: [
      "-m", "appworld.cli", "serve", "mcp", "stdio",
      "--app-names", config.apps.join(","),
      "--output-type", "both",
      "--remote-apis-url", config.remoteApisUrl,
      "--root", config.root,
    ],
    env,
  });
  const manifest = connected.manifest;
  const connector = connected.connector;

  let session: Awaited<ReturnType<typeof createSession>> | undefined;
  try {
    const allowed = new Set<string>(manifest.operations.map((op) => op.name));
    try {
      session = await createSession(manifest, connector, allowed, {
        executor: "quickjs",
        declarations: "full",
      });
    } catch (error) {
      await connector.close();
      throw error;
    }

    const operationCount = manifest.operations.length;
    let missingOutputSchemas = 0;
    for (const op of manifest.operations) {
      if (op.outputSchema === undefined) missingOutputSchemas += 1;
    }
    const operationNames = manifest.operations.map((op) => op.name).sort();
    const manifestText = JSON.stringify(manifest, null, 2);
    await writeFile(resolve(config.artifactDir, "manifest.json"), manifestText, "utf8");

    // Real schema errors are recorded, never papered over with a fallback.
    let declarationText = "";
    let schemaError: string | undefined;
    try {
      declarationText = await declarations(manifest, "full");
    } catch (error) {
      schemaError = error instanceof Error ? error.message : String(error);
    }
    if (schemaError !== undefined) {
      await writeJson(resolve(config.artifactDir, "summary.json"), {
        mode: inspect ? "inspect" : "run",
        operationCount,
        operationNames,
        missingOutputSchemas,
        manifestBytes: Buffer.byteLength(manifestText),
        schemaError: schemaError.slice(0, 1500),
      });
      console.error(`declaration generation failed: ${schemaError.slice(0, 300)}`);
      return 1;
    }
    await writeFile(resolve(config.artifactDir, "declarations.d.ts"), declarationText, "utf8");
    if (session === undefined) throw new Error("session was not constructed");

    if (inspect) {
      await writeJson(resolve(config.artifactDir, "summary.json"), {
        mode: "inspect",
        operationCount,
        operationNames,
        missingOutputSchemas,
        manifestBytes: Buffer.byteLength(manifestText),
        declarationBytes: Buffer.byteLength(declarationText),
        declarationsLength: session.declarations.length,
      });
      console.log(`inspect ok: ${operationCount} operations, ${missingOutputSchemas} missing output schemas`);
      return 0;
    }

    const programPath = config.program as string;
    const programSource = await readFile(programPath, "utf8");
    if (Buffer.byteLength(programSource) > 32_768)
      throw new Error(`program exceeds the 32768-byte session source limit: ${programPath}`);
    // Normal session path: the module goes to session.run unchanged, exactly
    // as typed_program executes it (checker validates imports/exports).
    const result = await session.run(programSource);
    await writeFile(resolve(config.artifactDir, "report.txt"), result.text, "utf8");
    await writeJson(resolve(config.artifactDir, "metrics.json"), result.metrics);
    const outcome: unknown = (result.metrics as { outcome?: unknown }).outcome;
    const calls: unknown = (result.metrics as { capabilityCalls?: unknown }).capabilityCalls;
    await writeJson(resolve(config.artifactDir, "summary.json"), {
      mode: "run",
      operationCount,
      operationNames,
      missingOutputSchemas,
      manifestBytes: Buffer.byteLength(manifestText),
      declarationBytes: Buffer.byteLength(declarationText),
      outcome,
      capabilityCalls: calls,
      reportBytes: Buffer.byteLength(result.text),
    });
    console.log(`run ${String(outcome)}: calls=${String(calls)} reportBytes=${Buffer.byteLength(result.text)}`);
    return outcome === "ok" ? 0 : 1;
  } finally {
    if (session !== undefined) await session.close();
  }
}

try {
  process.exit(await main());
} catch (error) {
  console.error(`replay failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
