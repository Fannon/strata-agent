import type { CapabilityConnector, CapabilityModule } from "./manifest.ts";
import { validator } from "./schemas.ts";

export interface CallMetric {
  capability: string;
  operation: string;
  invoked: boolean;
  rawBytes: number;
  failure?: "policy" | "input" | "output" | "transport";
}
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
}
export class CapabilityBroker {
  private modules = new Map<
    string,
    {
      connector: CapabilityConnector;
      allowed: ReadonlySet<string>;
      inputs: Map<string, (value: unknown) => string | undefined>;
      outputs: Map<string, ((value: unknown) => string | undefined) | undefined>;
    }
  >();
  constructor(
    manifest: CapabilityModule,
    connector: CapabilityConnector,
    allowed: ReadonlySet<string>,
  ) {
    this.addModule(manifest, connector, allowed);
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
      outputs.set(op.name, op.outputSchema ? validator(op.outputSchema) : undefined);
    }
    this.modules.set(manifest.id, { connector, allowed, inputs, outputs });
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
  ) {
    signal.throwIfAborted();
    if (metrics.calls.length >= 100)
      throw new Error("Capability call limit exceeded (100)");
    const record: CallMetric = {
      capability: capability.slice(0, 128),
      operation: operation.slice(0, 128),
      invoked: false,
      rawBytes: 0,
    };
    metrics.calls.push(record);
    const fail = (stage: CallMetric["failure"], message: string): never => {
      record.failure = stage;
      if (stage === "policy") metrics.policyFailures++;
      if (stage === "input" || stage === "output") metrics.validationFailures++;
      throw new Error(`${capability}.${operation}: ${stage}: ${message}`);
    };
    const module = this.modules.get(capability);
    const inputValidator = module?.inputs.get(operation);
    if (!module || !inputValidator || !module.allowed.has(operation))
      fail("policy", "operation is not locally allowed");
    const outputValidator = module!.outputs.get(operation);
    const inputError = inputValidator!(input);
    if (inputError) fail("input", inputError);
    signal.throwIfAborted();
    record.invoked = true;
    metrics.capabilityCalls++;
    let result;
    try {
      result = await this.modules.get(capability)!.connector.invoke(
        operation,
        input as Record<string, unknown>,
        signal,
      );
    } catch (error) {
      return fail(
        "transport",
        error instanceof Error ? error.message : String(error),
      );
    }
    record.rawBytes = result.rawBytes;
    metrics.rawCapabilityBytes += result.rawBytes;
    signal.throwIfAborted();
    if (result.isError) fail("transport", "capability returned isError");
    if (outputValidator) {
      const outputError = outputValidator(result.structured);
      if (outputError) fail("output", outputError);
      return result.structured;
    }
    return result.untyped;
  }
}
