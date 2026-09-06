import { appendFileSync } from "node:fs";

/**
 * Minimal correlated developer trace (local issue 026).
 *
 * The model-facing report truncates call detail under its byte budget, so it
 * cannot serve as the audit record. This module defines a small versioned
 * event contract plus an opt-in bounded local JSONL sink, independent of
 * model output.
 *
 * Redaction is structural: events carry only identities, monotonic durations,
 * outcome categories and byte counts. They never carry program source,
 * operation arguments, file contents, search patterns or paths. Error detail
 * is a bounded caller-supplied message (e.g. a denied path); raw payloads
 * are never included.
 *
 * Sink failure never throws: the failing event and all later events are
 * counted as dropped and writes are disabled, so a broken sink cannot fail
 * a run. Trace replay must never re-execute effects; these events are
 * descriptive only.
 */
export const TRACE_VERSION = 1 as const;

export type TraceKind = "program" | "call" | "load";
export type TracePhase = "start" | "outcome";

export interface TraceEvent {
  v: typeof TRACE_VERSION;
  kind: TraceKind;
  phase: TracePhase;
  /** Opaque session identifier; correlates programs within one session. */
  session: string;
  /** `<session>:p<n>` for programs, `<session>:load<n>` for discovery loads. */
  program: string;
  /** `<program>.<seq>` for capability calls. */
  call?: string;
  /** Execution engine, e.g. "quickjs" or "bun". */
  engine?: string;
  capability?: string;
  operation?: string;
  /** Transport/backend identity, e.g. "mcp", "cli-twin", "bun-native". */
  backend?: string;
  wallMs?: number;
  /** Monotonic duration in milliseconds (outcome phase only). */
  durationMs?: number;
  /** Terminal category: ok, compile-error, policy, input, output, transport,
   *  denied, cancelled, timeout, error. */
  outcome?: string;
  /** Bounded result size metadata (call outcome only), never content. */
  bytes?: number;
  /** Bounded detail string, never arguments/source/content (outcome only). */
  detail?: string;
}

export interface TraceSink {
  event(event: TraceEvent): void;
  readonly events: number;
  readonly dropped: number;
  close(): Promise<void>;
}

const ALLOWED_KEYS = new Set([
  "v",
  "kind",
  "phase",
  "session",
  "program",
  "call",
  "engine",
  "capability",
  "operation",
  "backend",
  "wallMs",
  "durationMs",
  "outcome",
  "bytes",
  "detail",
]);

/** Drop any key outside the contract before serialization (defense in depth). */
function sanitize(event: TraceEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (ALLOWED_KEYS.has(key)) out[key] = value;
  }
  return out;
}

/**
 * Create an opt-in JSONL sink. Returns undefined when no file is given, so
 * tracing stays off unless explicitly requested via STRATA_TRACE_FILE or an
 * explicit session option. Bounds total events and bytes; excess and any
 * write failure count as dropped and never throw.
 */
export function createTraceSink(
  file: string | undefined,
  limits?: { maxEvents?: number; maxBytes?: number },
): TraceSink | undefined {
  if (!file) return undefined;
  const maxEvents = limits?.maxEvents ?? 10_000;
  const maxBytes = limits?.maxBytes ?? 4_194_304;
  let events = 0;
  let dropped = 0;
  let writtenBytes = 0;
  let failed = false;
  return {
    event(event: TraceEvent) {
      if (failed || events + dropped >= maxEvents) {
        dropped++;
        return;
      }
      let line: string;
      try {
        line = `${JSON.stringify(sanitize(event))}\n`;
      } catch {
        dropped++;
        return;
      }
      if (writtenBytes + line.length > maxBytes) {
        dropped++;
        return;
      }
      try {
        appendFileSync(file, line);
        events++;
        writtenBytes += line.length;
      } catch {
        failed = true;
        dropped++;
      }
    },
    get events() {
      return events;
    },
    get dropped() {
      return dropped;
    },
    async close() {},
  };
}

export interface TraceSummary {
  programs: number;
  calls: number;
  engines: Record<string, number>;
  outcomes: Record<string, number>;
  totalResultBytes: number;
  slowest: Array<{
    call: string;
    capability: string;
    operation: string;
    durationMs: number;
    outcome: string;
  }>;
}

/** Pure summarizer over parsed trace events: slowest calls, failure categories, data volume. */
export function summarizeTrace(events: TraceEvent[], slowest = 10): TraceSummary {
  const programs = new Set<string>();
  const engines: Record<string, number> = {};
  const outcomes: Record<string, number> = {};
  const slowestCalls: TraceSummary["slowest"] = [];
  let calls = 0;
  let totalResultBytes = 0;
  for (const event of events) {
    if (event?.kind === "program" && event.phase === "outcome" && event.program)
      programs.add(event.program);
    if (event?.kind !== "call" || event.phase !== "outcome") continue;
    calls++;
    if (event.engine) engines[event.engine] = (engines[event.engine] ?? 0) + 1;
    const outcome = event.outcome ?? "unknown";
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    totalResultBytes += event.bytes ?? 0;
    slowestCalls.push({
      call: event.call ?? "?",
      capability: event.capability ?? "?",
      operation: event.operation ?? "?",
      durationMs: event.durationMs ?? 0,
      outcome,
    });
  }
  slowestCalls.sort((a, b) => b.durationMs - a.durationMs);
  return {
    programs: programs.size,
    calls,
    engines,
    outcomes,
    totalResultBytes,
    slowest: slowestCalls.slice(0, slowest),
  };
}
