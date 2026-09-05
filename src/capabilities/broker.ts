import type { CapabilityConnector, CapabilityModule } from './manifest.ts';
import { validator } from './schemas.ts';

export interface CallMetric { capability: string; operation: string; invoked: boolean; rawBytes: number; failure?: 'policy' | 'input' | 'output' | 'transport' }
export interface Metrics {
  sourceBytes: number; compileMs: number; diagnostics: string[]; executionMs: number;
  capabilityCalls: number; calls: CallMetric[]; rawCapabilityBytes: number;
  bytesExposedToPi: number; validationFailures: number; policyFailures: number;
}
export class CapabilityBroker {
  private operations;
  constructor(readonly manifest: CapabilityModule, private connector: CapabilityConnector, private allowed: ReadonlySet<string>) {
    this.operations = new Map(manifest.operations.map(op => [op.name, {
      input: validator(op.inputSchema), output: op.outputSchema ? validator(op.outputSchema) : undefined,
    }]));
  }
  async invoke(capability: string, operation: string, input: unknown, signal: AbortSignal, metrics: Metrics) {
    signal.throwIfAborted();
    if (metrics.calls.length >= 100) throw new Error('Capability call limit exceeded (100)');
    const record: CallMetric = { capability, operation, invoked: false, rawBytes: 0 };
    metrics.calls.push(record);
    const fail = (stage: CallMetric['failure'], message: string): never => {
      record.failure = stage;
      if (stage === 'policy') metrics.policyFailures++;
      if (stage === 'input' || stage === 'output') metrics.validationFailures++;
      throw new Error(`${capability}.${operation}: ${stage}: ${message}`);
    };
    const op = this.operations.get(operation);
    if (capability !== this.manifest.id || !op || !this.allowed.has(operation)) fail('policy', 'operation is not locally allowed');
    const inputError = op!.input(input);
    if (inputError) fail('input', inputError);
    signal.throwIfAborted();
    record.invoked = true;
    metrics.capabilityCalls++;
    let result;
    try { result = await this.connector.invoke(operation, input as Record<string, unknown>, signal); }
    catch (error) { return fail('transport', error instanceof Error ? error.message : String(error)); }
    record.rawBytes = result.rawBytes;
    metrics.rawCapabilityBytes += result.rawBytes;
    signal.throwIfAborted();
    if (result.isError) fail('transport', 'MCP server returned isError');
    if (op!.output) {
      const outputError = op!.output(result.structured);
      if (outputError) fail('output', outputError);
      return result.structured;
    }
    return result.untyped;
  }
}
