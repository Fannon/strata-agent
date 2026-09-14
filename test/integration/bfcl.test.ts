// BFCL harness deterministic tests (issue 037): schema normalization,
// tolerance grading, and record-all server round-trip. No network, no model
// calls, no paid services. Paid-cell behavior is covered by dry-run only.
import { test, expect } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeFunction,
  normalizeType,
  loadCases,
  loadGroundTruth,
} from "../../examples/bfcl/cases.ts";
import { gradeCase } from "../../examples/bfcl/grade.ts";
import { connectMcp } from "../../src/capabilities/mcp/connector.ts";

const DATA = new URL("../../.work/bfcl/upstream/berkeley-function-call-leaderboard/bfcl_eval/data", import.meta.url).pathname;

test("normalizer maps BFCL python-isms and rejects the unknown", async () => {
  expect(normalizeType("dict")).toBe("object");
  expect(normalizeType("tuple")).toBe("array");
  expect(normalizeType("float")).toBe("number");
  expect(normalizeType("string")).toBe("string");
  expect(() => normalizeType("dataframe")).toThrow("unsupported type");
  const tool = normalizeFunction({
    name: "f",
    description: "d",
    parameters: {
      type: "dict",
      properties: {
        items: { type: "tuple", items: [{ type: "integer" }] },
        mode: { type: "any" },
        count: { type: "integer" },
      },
      required: ["count"],
    },
  });
  expect(tool.inputSchema).toEqual({
    type: "object",
    properties: {
      items: { type: "array", items: [{ type: "integer" }] },
      mode: {},
      count: { type: "integer" },
    },
    required: ["count"],
  });
  expect(() =>
    normalizeFunction({ name: "g", parameters: { type: "dict", properties: { x: { type: "weird" } } } }),
  ).toThrow("unsupported type");
  expect(() => normalizeFunction({ name: "", parameters: { type: "object" } })).toThrow("without a name");
});

test("pinned subset loads: 30 single-turn cases with functions", async () => {
  const cases = await loadCases(DATA);
  expect(cases.length).toBe(30);
  expect(cases.map((c) => c.file)).toEqual([
    ...Array<string>(10).fill("BFCL_v4_simple_python.json"),
    ...Array<string>(10).fill("BFCL_v4_multiple.json"),
    ...Array<string>(10).fill("BFCL_v4_irrelevance.json"),
  ]);
  expect(cases[0]!.id).toBe("simple_python_0");
  for (const c of cases) {
    expect(c.question.length).toBeGreaterThan(0);
    expect(c.functions.length).toBeGreaterThan(0);
    // Every case normalizes without gap errors.
    for (const fn of c.functions) normalizeFunction(fn);
  }
  const simple = await loadGroundTruth(DATA, "BFCL_v4_simple_python");
  expect(simple.get("simple_python_0")).toEqual({
    id: "simple_python_0",
    alternatives: [{ calculate_triangle_area: { base: [10], height: [5], unit: ["units", ""] } }],
  });
});

test("grader applies tolerance, alternatives, and abstention", async () => {
  // Exact match passes.
  expect(
    gradeCase(
      [{ name: "calculate_triangle_area", arguments: { base: 10, height: 5 } }],
      { id: "x", alternatives: [{ calculate_triangle_area: { base: [10], height: [5], unit: ["units", ""] } }] },
    ).pass,
  ).toBe(true);
  // Omitted droppable param ("" listed) passes; wrong value fails.
  expect(
    gradeCase(
      [{ name: "calculate_triangle_area", arguments: { base: 10, height: 5, unit: "units" } }],
      { id: "x", alternatives: [{ calculate_triangle_area: { base: [10], height: [5], unit: ["units", ""] } }] },
    ).pass,
  ).toBe(true);
  expect(
    gradeCase(
      [{ name: "calculate_triangle_area", arguments: { base: 10, height: 6 } }],
      { id: "x", alternatives: [{ calculate_triangle_area: { base: [10], height: [5], unit: ["units", ""] } }] },
    ).pass,
  ).toBe(false);
  // Wrong function and extra params fail; second alternative can still pass.
  expect(
    gradeCase(
      [
        { name: "wrong_fn", arguments: {} },
        { name: "f", arguments: { a: 1, b: 2 } },
      ],
      { id: "x", alternatives: [{ f: { a: [1] } }, { f: { a: [1], b: [2] } }] },
    ).pass,
  ).toBe(true);
  expect(
    gradeCase(
      [{ name: "f", arguments: { a: 1, surprise: true } }],
      { id: "x", alternatives: [{ f: { a: [1] } }] },
    ).pass,
  ).toBe(false);
  // Irrelevance: silence passes, any call fails.
  expect(gradeCase([], null).pass).toBe(true);
  expect(gradeCase([{ name: "f", arguments: {} }], null).pass).toBe(false);
  // No calls against a ground truth fails.
  expect(
    gradeCase([], { id: "x", alternatives: [{ f: { a: [1] } }] }).pass,
  ).toBe(false);
});

test("record-all server round-trip: tools served, calls recorded, canned reply", async () => {
  const dir = await mkdtemp(join(tmpdir(), "strata-bfcl-"));
  try {
    const toolsPath = join(dir, "tools.json");
    const recordPath = join(dir, "calls.jsonl");
    await writeFile(toolsPath, JSON.stringify([
      { name: "calculate_triangle_area",
        description: "d",
        inputSchema: { type: "object", properties: { base: { type: "integer" } }, required: ["base"] } },
    ]));
    await writeFile(recordPath, "");
    const { manifest, connector } = await connectMcp("bfcl", {
      command: process.execPath,
      args: [new URL("../../examples/bfcl/server.ts", import.meta.url).pathname,
        "--tools", toolsPath, "--record", recordPath],
    });
    try {
      expect(manifest.operations.map((op) => op.name)).toEqual(["calculate_triangle_area"]);
      const out = await connector.invoke(
        "calculate_triangle_area", { base: 10 }, new AbortController().signal);
      expect(out.structured).toEqual({ ok: true });
    } finally {
      await connector.close();
    }
    const recorded = (await readFile(recordPath, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(recorded).toEqual([{ name: "calculate_triangle_area", arguments: { base: 10 } }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
