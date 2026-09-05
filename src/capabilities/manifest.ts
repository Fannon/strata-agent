export type JsonSchema = Record<string, unknown>;
export interface CapabilityOperation {
  /** Exact original name. Quoted TS properties preserve every MCP name without collisions. */
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  metadata?: { readOnly?: boolean; destructive?: boolean; idempotent?: boolean; openWorld?: boolean };
}
export interface CapabilityModule {
  id: string;
  description?: string;
  operations: CapabilityOperation[];
}
export interface CapabilityResult {
  structured?: unknown;
  untyped: unknown;
  isError?: boolean;
  rawBytes: number;
}
export interface CapabilityConnector {
  invoke(operation: string, input: Record<string, unknown>, signal: AbortSignal): Promise<CapabilityResult>;
  close(): Promise<void>;
}
export const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value) ?? "null");
