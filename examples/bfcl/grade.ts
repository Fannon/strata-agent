// BFCL tolerance grading (issue 037).
//
// Compares recorded tool calls against upstream ground truth using
// BFCL-style tolerance: exact function names, and every expected parameter
// satisfied by one of its listed acceptable values. Multiple ground-truth
// alternatives pass if ANY matches. Irrelevance passes only with zero calls.
// This is a BFCL-inspired diagnostic rule, not an official BFCL score:
// official evaluation runs their harness; ours checks the same tolerance
// shape over Strata-recorded calls. Pure functions, fully offline-tested.
import type { BfclGroundTruth } from "./cases.ts";

export interface RecordedCall {
  name: string;
  arguments: Record<string, unknown>;
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    // Tolerate int/float spelling of the same value (e.g. 10 vs 10.0).
    return actual === expected;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    if (actual.length !== expected.length) return false;
    return actual.every((item, i) => valuesEqual(item, expected[i]));
  }
  if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null) {
    const a = actual as Record<string, unknown>;
    const b = expected as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!(key in a) || !(key in b)) return false;
      if (!valuesEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return actual === expected;
}

function alternativeMatches(
  call: RecordedCall,
  alternative: Record<string, Record<string, unknown[]>>,
): boolean {
  const names = Object.keys(alternative);
  if (names.length !== 1) return false;
  const name = names[0]!;
  if (call.name !== name) return false;
  const expectedParams = alternative[name]!;
  for (const [param, allowed] of Object.entries(expectedParams)) {
    if (!(param in call.arguments)) {
      // An omitted param passes only when omission itself is acceptable
      // (upstream lists "" among the allowed values for droppable params).
      if (!allowed.some((value) => value === "")) return false;
      continue;
    }
    if (!allowed.some((value) => valuesEqual(call.arguments[param], value))) return false;
  }
  for (const param of Object.keys(call.arguments)) {
    if (!(param in expectedParams)) return false;
  }
  return true;
}

export interface GradeVerdict {
  pass: boolean;
  reason: string;
}

/** Grade one case: recorded calls (in order) against ground truth. */
export function gradeCase(
  calls: RecordedCall[],
  groundTruth: BfclGroundTruth | null,
): GradeVerdict {
  if (groundTruth === null) {
    // Irrelevance: the only correct behavior is calling nothing.
    if (calls.length === 0) return { pass: true, reason: "no calls made" };
    return {
      pass: false,
      reason: `expected abstention, got ${calls.length} call(s): ${calls.map((c) => c.name).join(", ")}`,
    };
  }
  if (calls.length === 0)
    return { pass: false, reason: "no calls made, expected one" };
  for (const call of calls) {
    for (const alternative of groundTruth.alternatives) {
      if (alternativeMatches(call, alternative))
        return { pass: true, reason: `matched ${call.name}` };
    }
  }
  return {
    pass: false,
    reason: `no recorded call matched: got [${calls.map((c) => `${c.name}(${JSON.stringify(c.arguments)})`).join("; ")}]`,
  };
}
