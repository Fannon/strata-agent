export type JsonSchema = Record<string, unknown>;
export interface CapabilityOperation {
  /** Exact original name. Quoted TS properties preserve every MCP name without collisions. */
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  metadata?: {
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
    openWorld?: boolean;
  };
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
  /** Backend identity for trace events, e.g. "mcp", "cli-twin", "bun-native". */
  readonly backend?: string;
  invoke(
    operation: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<CapabilityResult>;
  close(): Promise<void>;
}
/** Resource denial: raised before any filesystem/Git effect. */
export class DeniedError extends Error {
  constructor(message: string) {
    super(`denied: ${message}`);
  }
}
/** Missing/unreadable resource or bad shape after validation. */
export class ResourceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const bytes = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value) ?? "null");
