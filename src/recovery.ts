/** Host-only evidence. Never embedded in redacted metrics or developer traces. */
export interface Evidence {
  bytes: number;
  truncated: boolean;
  value?: unknown;
  preview?: string;
}
export function evidence(value: unknown, maxBytes = 2048): Evidence {
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return { bytes: 0, truncated: true };
    const bytes = Buffer.byteLength(json);
    if (bytes <= maxBytes) return { bytes, truncated: false, value: JSON.parse(json) };
    // Bound by bytes, not UTF-16 characters, without returning broken JSON.
    let preview = Buffer.from(json).subarray(0, maxBytes).toString("utf8");
    while (Buffer.byteLength(preview) > maxBytes) preview = preview.slice(0, -1);
    return { bytes, truncated: true, preview };
  } catch {
    return { bytes: 0, truncated: true };
  }
}
export interface ActionReceipt {
  call: string;
  program: string;
  capability: string;
  operation: string;
  effect: "write" | "unknown";
  /** confirmed = broker accepted a success response; not independent business verification. */
  status: "confirmed" | "not-executed" | "uncertain";
  input?: Evidence;
  response?: Evidence;
  responseValidated?: boolean;
  failure?: string;
  evidenceOmitted?: boolean;
}
const LIMIT = 20;
const EVIDENCE_BYTES = 32768;
/** At most 20 programs, 100 receipt identities/program and 32 KiB evidence/program. */
export class RecoveryLedger {
  private expiredThroughSequence = 0;
  private programs = new Map<string, { sequence: number; finished: boolean; receipts: Map<string, ActionReceipt> }>();
  start(program: string, sequence: number) {
    this.programs.set(program, { sequence, finished: false, receipts: new Map() });
    while (this.programs.size > LIMIT) {
      const oldest = this.programs.keys().next().value!;
      this.expiredThroughSequence = Math.max(this.expiredThroughSequence, this.programs.get(oldest)!.sequence);
      this.programs.delete(oldest);
    }
  }
  record(receipt: ActionReceipt) {
    const entry = this.programs.get(receipt.program);
    // Late transport outcomes cannot rewrite a completed report or resurrect evicted history.
    if (!entry || entry.finished) return;
    if (!entry.receipts.has(receipt.call) && entry.receipts.size >= 100) return;
    const next = structuredClone(receipt);
    let used = 0;
    for (const r of entry.receipts.values()) if (r.call !== next.call)
      used += Buffer.byteLength(JSON.stringify([r.input, r.response]));
    if (used + Buffer.byteLength(JSON.stringify([next.input, next.response])) > EVIDENCE_BYTES) {
      delete next.response;
      next.evidenceOmitted = true;
      if (used + Buffer.byteLength(JSON.stringify([next.input])) > EVIDENCE_BYTES) delete next.input;
    }
    entry.receipts.set(next.call, next);
  }
  finish(program: string) {
    const entry = this.programs.get(program);
    if (entry) entry.finished = true;
  }
  has(program: string) { return this.programs.has(program); }
  clear() { this.programs.clear(); this.expiredThroughSequence = 0; }
  page(program: string | undefined, since: number, offset = 0, limit = 5) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 5)
      throw new Error("Receipt offset must be >=0 and limit must be 1–5.");
    if (program && !this.programs.has(program)) throw new Error(`Unknown or expired program "${program}".`);
    const entries = [...this.programs].filter(([id, entry]) => program ? id === program : entry.sequence > since);
    const receipts = entries.flatMap(([, entry]) => [...entry.receipts.values()]);
    return {
      scope: program ?? "current agent request (retained programs only)",
      programs: entries.map(([id]) => id),
      historyIncomplete: !program && since < this.expiredThroughSequence,
      total: receipts.length,
      confirmed: receipts.filter(r => r.status === "confirmed").length,
      uncertain: receipts.filter(r => r.status === "uncertain").length,
      notExecuted: receipts.filter(r => r.status === "not-executed").length,
      receipts: structuredClone(receipts.slice(offset, offset + limit)),
      nextOffset: offset + limit < receipts.length ? offset + limit : null,
      note: "Confirmed means the broker accepted a success response, not independently verified business state. responseValidated says whether an output schema was checked. Unknown-effect operations may be reads. Inspect state before retrying uncertain writes; call ids are correlation ids, not backend idempotency keys.",
    };
  }
  summary(since: number) {
    const page = this.page(undefined, since);
    return {
      scope: page.scope, historyIncomplete: page.historyIncomplete,
      confirmed: page.confirmed, uncertain: page.uncertain, notExecuted: page.notExecuted,
      retainedPrograms: page.programs,
      receipts: page.receipts.slice(0, 3).map(r => ({
        ...r,
        ...(r.input ? { input: evidence(r.input.value ?? r.input.preview, 256) } : {}),
        ...(r.response ? { response: evidence(r.response.value ?? r.response.preview, 256) } : {}),
      })),
      more: "Use program_effects for paginated evidence and allowed inspection operations. Earlier effects are not rolled back by this error.",
    };
  }
}
