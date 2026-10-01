import type { CapabilityConnector, CapabilityModule } from "./manifest.ts";
import { DeniedError } from "./manifest.ts";
import { validator, type ValidatorOptions } from "./schemas.ts";
import { TRACE_VERSION, type TraceEvent } from "../trace.ts";
import { evidence, type ActionReceipt } from "../recovery.ts";

export type CallFailure =
  | "policy"
  | "input"
  | "output"
  | "transport"
  | "denied"
  | "cancelled";
export interface CallMetric {
  capability: string;
  operation: string;
  /** `<program>.<seq>`: correlates this attempt with trace events. */
  callId: string;
  /** Transport/backend identity from the connector, e.g. "mcp". */
  backend: string;
  invoked: boolean;
  /** An accepted success response arrived before the program ended. */
  acknowledged?: boolean;
  rawBytes: number;
  /** Monotonic broker-side duration in milliseconds. */
  durationMs: number;
  failure?: CallFailure;
}
export interface BrokerOptions {
  /**
   * Boundary-scoped output compatibility (040): accept timezone-free
   * upstream datetimes in response validation. Opt-in per broker; global
   * default is strict. Never applies to input validation: agent-supplied
   * values are always checked strictly. The same setting must be used in
   * both arms of any comparison (042 parity).
   */
  acceptNaiveDateTime?: boolean;
}
export type RunOutcome = "ok" | "compile-error" | "cancelled" | "timeout" | "error";
export interface Metrics {
  sourceBytes: number;
  compileMs: number;
  diagnostics: string[];
  executionMs: number;
  capabilityCalls: number;
  calls: CallMetric[];
  rawCapabilityBytes: number;
  bytesExposedToPi: number;
  validationFailures: number;
  policyFailures: number;
  /** Execution engine that ran this program, e.g. "quickjs". */
  engine: string;
  /** `<session>:p<n>`: correlates this run with trace events. */
  programId: string;
  outcome: RunOutcome;
  /** Trace events dropped due to sink bounds or sink failure. */
  traceDropped: number;
}
/** Per-run correlation context supplied by the session through the executor. */
export interface CallTraceContext {
  program: string;
  engine: string;
}
export type TraceEmit = (event: TraceEvent) => void;
export class CapabilityBroker {
  private modules = new Map<
    string,
    {
      connector: CapabilityConnector;
      allowed: ReadonlySet<string>;
      inputs: Map<string, (value: unknown) => string | undefined>;
      outputs: Map<string, ((value: unknown) => string | undefined) | undefined>;
      readOnly: Map<string, boolean | undefined>;
    }
  >();
  private tracer: TraceEmit | undefined;
  private receiptRecorder: ((receipt: ActionReceipt) => void) | undefined;
  private sessionId = "adhoc";
  private callSeq = new Map<string, number>();
  private readonly outputFormats: ValidatorOptions;
  constructor(
    manifest: CapabilityModule,
    connector: CapabilityConnector,
    allowed: ReadonlySet<string>,
    options: BrokerOptions = {},
  ) {
    this.outputFormats = {
      ...(options.acceptNaiveDateTime === true
        ? { acceptNaiveDateTime: true as const }
        : {}),
    };
    this.addModule(manifest, connector, allowed);
  }
  /** Attach the session trace sink and correlation identity. */
  setTracer(sessionId: string, tracer?: TraceEmit) {
    this.sessionId = sessionId;
    this.tracer = tracer;
  }
  setReceiptRecorder(recorder: (receipt: ActionReceipt) => void) { this.receiptRecorder = recorder; }
  get inspectionOperations() {
    return [...this.modules].map(([capability, module]) => ({
      capability,
      operations: [...module.readOnly].filter(([op, readOnly]) => readOnly === true && module.allowed.has(op)).map(([op]) => op).slice(0, 10),
    })).filter(m => m.operations.length).slice(0, 10);
  }
  /** Register another capability module in a live session (discovery load). */
  addModule(
    manifest: CapabilityModule,
    connector: CapabilityConnector,
    allowed: ReadonlySet<string>,
  ) {
    if (this.modules.has(manifest.id))
      throw new Error(`Capability ${manifest.id} is already loaded`);
    const inputs = new Map<string, (value: unknown) => string | undefined>();
    const outputs = new Map<string, ((value: unknown) => string | undefined) | undefined>();
    for (const op of manifest.operations) {
      inputs.set(op.name, validator(op.inputSchema));
      outputs.set(
        op.name,
        op.outputSchema ? validator(op.outputSchema, this.outputFormats) : undefined,
      );
    }
    this.modules.set(manifest.id, { connector, allowed, inputs, outputs, readOnly: new Map(manifest.operations.map(op => [op.name, op.metadata?.readOnly])) });
  }
  /** Loaded capability surfaces, for worker bindings. */
  get surfaces(): Array<{ capability: string; operations: string[] }> {
    return [...this.modules].map(([capability, module]) => ({
      capability,
      operations: [...module.inputs.keys()],
    }));
  }
  async invoke(
    capability: string,
    operation: string,
    input: unknown,
    signal: AbortSignal,
    metrics: Metrics,
    trace?: CallTraceContext,
  ) {
    signal.throwIfAborted();
    if (metrics.calls.length >= 100)
      throw new Error("Capability call limit exceeded (100)");
    const program = trace?.program ?? `${this.sessionId}:adhoc`;
    const seq = (this.callSeq.get(program) ?? 0) + 1;
    this.callSeq.set(program, seq);
    const module = this.modules.get(capability);
    const record: CallMetric = {
      capability: capability.slice(0, 128),
      operation: operation.slice(0, 128),
      callId: `${program}.${seq}`,
      backend: module?.connector.backend ?? "unknown",
      invoked: false,
      rawBytes: 0,
      durationMs: 0,
    };
    metrics.calls.push(record);
    const readOnly = module?.readOnly.get(operation);
    const receipt: ActionReceipt | undefined = readOnly === true || !this.receiptRecorder ? undefined : {
      call: record.callId, program, capability: record.capability, operation: record.operation,
      effect: readOnly === false ? "write" : "unknown", status: "not-executed", input: evidence(input),
    };
    const recordReceipt = () => { if (receipt) this.receiptRecorder?.(receipt); };
    recordReceipt();
    const started = performance.now();
    const elapsed = () => performance.now() - started;
    const emit = (phase: "start" | "outcome", outcome?: string, detail?: string) =>
      this.tracer?.({
        v: TRACE_VERSION,
        kind: "call",
        phase,
        session: this.sessionId,
        program,
        call: record.callId,
        engine: trace?.engine,
        capability: record.capability,
        operation: record.operation,
        backend: record.backend,
        wallMs: Date.now(),
        ...(phase === "outcome"
          ? {
              durationMs: elapsed(),
              outcome,
              bytes: record.rawBytes,
              ...(detail ? { detail: detail.slice(0, 300) } : {}),
            }
          : {}),
      });
    const fail = (stage: CallMetric["failure"], message: string): never => {
      record.failure = stage;
      if (receipt) {
        receipt.status = !record.invoked || stage === "denied" ? "not-executed" : "uncertain";
        receipt.failure = stage;
        recordReceipt();
      }
      record.durationMs = elapsed();
      if (stage === "policy" || stage === "denied") metrics.policyFailures++;
      if (stage === "input" || stage === "output") metrics.validationFailures++;
      emit("outcome", stage, message);
      throw new Error(`${capability}.${operation}: ${stage}: ${message}`);
    };
    emit("start");
    const inputValidator = module?.inputs.get(operation);
    if (!module || !inputValidator || !module.allowed.has(operation))
      fail("policy", "operation is not locally allowed");
    const outputValidator = module!.outputs.get(operation);
    const inputError = inputValidator!(input);
    if (inputError) fail("input", inputError);
    signal.throwIfAborted();
    record.invoked = true;
    if (receipt) { receipt.status = "uncertain"; recordReceipt(); }
    metrics.capabilityCalls++;
    let result;
    try {
      result = await this.modules.get(capability)!.connector.invoke(
        operation,
        input as Record<string, unknown>,
        signal,
      );
    } catch (error) {
      // Classify by error identity and abort state, never by message prose:
      // DeniedError is a pre-effect resource denial, abort means the run is
      // gone and the result would be discarded, everything else is transport.
      if (signal.aborted) return fail("cancelled", "cancelled during dispatch");
      if (error instanceof DeniedError)
        return fail("denied", error instanceof Error ? error.message : String(error));
      return fail(
        "transport",
        error instanceof Error ? error.message : String(error),
      );
    }
    record.rawBytes = result.rawBytes;
    metrics.rawCapabilityBytes += result.rawBytes;
    try {
      signal.throwIfAborted();
    } catch {
      return fail("cancelled", "cancelled after dispatch; result discarded");
    }
    if (result.isError) fail("transport", "capability returned isError");
    const finishOk = (value: unknown) => {
      record.acknowledged = true;
      if (receipt) {
        receipt.status = "confirmed";
        receipt.response = evidence(value);
        receipt.responseValidated = !!outputValidator;
        recordReceipt();
      }
      record.durationMs = elapsed();
      emit("outcome", "ok");
      return value;
    };
    if (outputValidator) {
      const outputError = outputValidator(result.structured);
      if (outputError) fail("output", outputError);
      return finishOk(result.structured);
    }
    return finishOk(result.untyped);
  }
}
