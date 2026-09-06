/**
 * Evaluator-access auditor (028 step 0, 031-audit follow-up).
 *
 * Scans a cell's tool-call arguments for access to forbidden locations:
 * answer/oracle files, canary paths, and parent-directory traversal.
 * Operates on recorded `tool_execution_start` args only — it audits what the
 * candidate observably attempted, and cannot prove absence of unrecorded
 * paths. A clean result is "no evidence of access," never proof of
 * impossibility; structural isolation (answers out of the candidate
 * filesystem) remains the real guarantee.
 */

export interface AccessAudit {
  /** True when no forbidden access was observed. */
  clean: boolean;
  /** One entry per offending tool call, in trace order. */
  violations: { toolCallId: string; toolName: string; reason: string }[];
}

/** `..` or `~` as a standalone path segment anywhere in the string. Spread `...` never matches: neither of its overlapping `..` pairs is followed by a separator or string end. */
const parentSegment = /(^|[/\\\s'"])\.\.(?=[/\\]|$)|(^|[/\\\s'"])~(?=[/\\]|$)/;

function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsOf(v, out);
  else if (value !== null && typeof value === "object")
    for (const v of Object.values(value as Record<string, unknown>)) stringsOf(v, out);
  return out;
}

export function auditToolArgs(
  calls: { toolCallId: string; toolName: string; args: unknown }[],
  forbidden: { substrings?: string[]; forbidParentTraversal?: boolean } = {},
): AccessAudit {
  const needles = (forbidden.substrings ?? []).map((s) => s.toLowerCase());
  const checkTraversal = forbidden.forbidParentTraversal ?? true;
  const violations: AccessAudit["violations"] = [];
  for (const call of calls) {
    const reasons: string[] = [];
    for (const s of stringsOf(call.args)) {
      const lower = s.toLowerCase();
      for (const needle of needles) {
        if (needle && lower.includes(needle)) {
          reasons.push(`forbidden location referenced: ${needle}`);
          break;
        }
      }
      if (checkTraversal && parentSegment.test(s)) {
        // `...` spread can never reach here: the regex requires `..` to be a
        // full segment bounded by separators or string ends.
        reasons.push("parent-directory traversal");
      }
    }
    if (reasons.length)
      violations.push({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        reason: [...new Set(reasons)].join("; "),
      });
  }
  return { clean: violations.length === 0, violations };
}
