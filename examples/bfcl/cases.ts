// BFCL invocation-diagnostic case loading (issue 037).
//
// Reads pinned upstream BFCL v4 JSONL (local only, never committed) and
// normalizes function definitions to JSON Schema for MCP serving. The
// normalizer maps BFCL's Python-isms explicitly and throws on anything
// unrecognized, so schema gaps fail visibly instead of silently changing
// what the model sees. No model calls here; see bench.ts for the runner.
import { readFile } from "node:fs/promises";

export const BFCL_PIN = "6ea5797";
export const BFCL_FILES = [
  "BFCL_v4_simple_python.json",
  "BFCL_v4_multiple.json",
  "BFCL_v4_irrelevance.json",
] as const;

/** Pinned development subset: first 10 case ids of each file, in file order. */
export const SUBSET: { file: (typeof BFCL_FILES)[number]; count: number }[] = [
  { file: "BFCL_v4_simple_python.json", count: 10 },
  { file: "BFCL_v4_multiple.json", count: 10 },
  { file: "BFCL_v4_irrelevance.json", count: 10 },
];

export interface BfclFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface BfclCase {
  id: string;
  file: string;
  question: string;
  functions: BfclFunction[];
}

export interface BfclGroundTruth {
  id: string;
  /** Acceptable alternatives; each maps func name -> param -> allowed values. */
  alternatives: Record<string, Record<string, unknown[]>>[];
}

/** Map BFCL's Python-flavored type names to JSON Schema. Throws otherwise. */
export function normalizeType(type: unknown): string {
  if (type === "dict") return "object";
  if (type === "tuple") return "array";
  if (type === "float") return "number";
  if (type === "any") return "anything";
  if (
    type === "string" ||
    type === "integer" ||
    type === "number" ||
    type === "boolean" ||
    type === "array" ||
    type === "object" ||
    type === "null"
  )
    return type;
  throw new Error(`BFCL schema uses unsupported type: ${JSON.stringify(type)}`);
}

function normalizeNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeNode);
  if (typeof node === "object" && node !== null) {
    const record = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "type" && typeof value === "string") {
        const mapped = normalizeType(value);
        if (mapped === "anything") return {};
        out[key] = mapped;
      } else {
        out[key] = normalizeNode(value);
      }
    }
    return out;
  }
  return node;
}

/** Normalize one BFCL function definition to a JSON-Schema-typed tool. */
export function normalizeFunction(fn: BfclFunction): {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
} {
  if (typeof fn.name !== "string" || !fn.name)
    throw new Error("BFCL function without a name");
  if (typeof fn.parameters !== "object" || fn.parameters === null)
    throw new Error(`BFCL function ${fn.name} without parameters object`);
  const inputSchema = normalizeNode(fn.parameters) as Record<string, unknown>;
  if (inputSchema["type"] !== "object")
    throw new Error(`BFCL function ${fn.name} has non-object top-level schema`);
  return {
    name: fn.name,
    ...(typeof fn.description === "string" ? { description: fn.description } : {}),
    inputSchema,
  };
}

function userQuestion(entry: unknown): string {
  const question = (entry as Record<string, unknown>).question;
  if (
    !Array.isArray(question) ||
    !Array.isArray(question[0]) ||
    question[0].length !== 1 ||
    (question[0][0] as Record<string, unknown>).role !== "user" ||
    typeof (question[0][0] as Record<string, unknown>).content !== "string"
  )
    throw new Error(
      `BFCL case ${(entry as Record<string, unknown>).id} is not single-turn user-question shape`,
    );
  return (question[0][0] as Record<string, unknown>).content as string;
}

export async function loadCases(
  dataDir: string,
  subset: { file: string; count: number }[] = SUBSET,
): Promise<BfclCase[]> {
  const cases: BfclCase[] = [];
  for (const { file, count } of subset) {
    const raw = await readFile(`${dataDir}/${file}`, "utf8");
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    for (const line of lines.slice(0, count)) {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const functions = entry.function as BfclFunction[];
      if (typeof entry.id !== "string" || !Array.isArray(functions) || !functions.length)
        throw new Error(`BFCL entry in ${file} missing id/functions`);
      cases.push({
        id: entry.id,
        file,
        question: userQuestion(entry),
        functions,
      });
    }
  }
  return cases;
}

export async function loadGroundTruth(
  dataDir: string,
  category: string,
): Promise<Map<string, BfclGroundTruth>> {
  const raw = await readFile(`${dataDir}/possible_answer/${category}.json`, "utf8");
  const out = new Map<string, BfclGroundTruth>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as Record<string, unknown>;
    if (typeof entry.id !== "string" || !Array.isArray(entry.ground_truth))
      throw new Error(`BFCL ground truth entry missing id/ground_truth`);
    out.set(entry.id, { id: entry.id, alternatives: entry.ground_truth as Record<string, Record<string, unknown[]>>[] });
  }
  return out;
}
