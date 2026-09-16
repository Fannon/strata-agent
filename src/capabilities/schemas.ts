import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { compile } from "json-schema-to-typescript";
import type { CapabilityModule, JsonSchema } from "./manifest.ts";

export interface ValidatorOptions {
  /**
   * Accept timezone-free `YYYY-MM-DDTHH:MM:SS[.fraction]` alongside strict
   * RFC 3339 `date-time` values. Boundary-scoped compatibility for backends
   * whose declared `date-time` schemas disagree with their actual naive
   * responses (040: AppWorld serializes naive datetimes via isoformat while
   * declaring strict `date-time`). Validation-only: the original string is
   * preserved verbatim and no timezone is ever inferred. Global default is
   * strict (false). Applies wherever the caller uses it; the broker applies
   * it to output validators only, never to agent-supplied inputs.
   */
  acceptNaiveDateTime?: boolean;
}

/** Shared `date-time` gate for the boundary opt-in: strict RFC 3339 (offset
 * or Z) plus the naive upstream `YYYY-MM-DDTHH:MM:SS` form with optional
 * fraction. Ranges are bounded (month 01-12, day 01-31, hour 00-23,
 * min/sec 00-59) so malformed values stay rejected; like AJV's own format
 * check this is a lexical gate, not a calendar validation. The offset stays
 * optional and is never defaulted: a naive value validates as itself, with
 * no timezone inferred. */
const LOOSE_DATE_TIME =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[tT]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?([zZ]|[+-]([01]\d|2[0-3]):[0-5]\d)?$/;

export function validator(schema: JsonSchema, options: ValidatorOptions = {}) {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: false,
    validateFormats: true,
  });
  addFormats(ajv);
  if (options.acceptNaiveDateTime === true) {
    ajv.addFormat("date-time", (value: string) => LOOSE_DATE_TIME.test(value));
  }
  const check = ajv.compile(schema);
  return (value: unknown): string | undefined =>
    check(value)
      ? undefined
      : ajv.errorsText(check.errors, { dataVar: "value" });
}

export const declarationsPreamble =
  "declare const console: { log(...values: unknown[]): void };";

export type DeclarationStyle = "full" | "compact";

/** Selection helper mirroring parseExecutor: unset/empty means full baseline. */
export function parseDeclarationStyle(value: string | undefined): DeclarationStyle {
  if (!value || value === "full") return "full";
  if (value === "compact") return "compact";
  throw new Error(`Unknown STRATA_DECLARATIONS "${value}"; expected "full" or "compact"`);
}

/** Compact-only schema clone: array length caps move from static tuple
 * unions into prose ("Max N items.") so the checker emits `T[]`.
 * Runtime AJV validation still enforces the caps pre-dispatch; only the
 * error stage moves (compile-time rejection becomes input-validation
 * rejection, still zero-effect). Everything else — operations, types,
 * enums, required, descriptions — is untouched. Never applied to the
 * schemas the broker validates with. */
export function compactSchemaForDeclarations(schema: JsonSchema): JsonSchema {
  const clone = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clone);
    if (value === null || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(node)) {
      if (key === "maxItems" || key === "minItems") continue;
      out[key] = clone(entry);
    }
    if (node.items !== undefined && typeof node.maxItems === "number") {
      const prior =
        typeof out.description === "string" && out.description.length > 0
          ? out.description + " "
          : "";
      out.description = `${prior}Max ${node.maxItems} items.`;
    }
    return out;
  };
  return clone(schema) as JsonSchema;
}

export async function declarations(
  module: CapabilityModule,
  style: DeclarationStyle = "full",
): Promise<string> {
  const definitions: string[] = [];
  const methods: string[] = [];
  for (const [i, op] of module.operations.entries()) {
    const input = `Input${i}`,
      output = `Output${i}`;
    const generate = (schema: JsonSchema, name: string) =>
      compile({ ...schema, title: name }, name, {
        bannerComment: "",
        unknownAny: true,
        enableConstEnums: false,
        // Remote refs would make generation dependent on external I/O.
        $refOptions: { resolve: { http: false, file: false } },
      });
    // Namespace each schema: shared definition names across operations cannot collide.
    // Compact presentation generates from length-cap-relaxed clones; the
    // broker keeps validating against the original schemas.
    const inputSchema =
      style === "compact" ? compactSchemaForDeclarations(op.inputSchema) : op.inputSchema;
    const outputSchema =
      style === "compact" && op.outputSchema
        ? compactSchemaForDeclarations(op.outputSchema)
        : op.outputSchema;
    definitions.push(
      `namespace Op${i} {\n${await generate(inputSchema, input)}\n${outputSchema ? await generate(outputSchema, output) : ""}\n}`,
    );
    const doc = (op.description ?? "").replaceAll("*/", "* /");
    methods.push(
      `/** ${doc} */\n${JSON.stringify(op.name)}(input: Op${i}.${input}): Promise<${op.outputSchema ? `Op${i}.${output}` : "unknown"}>;`,
    );
  }
  const body = `${definitions.join("\n")}\nexport const api: {\n${methods.join("\n")}\n};\n`;
  if (style === "compact") {
    // Alias by re-export instead of a second full copy (verified against the
    // restricted compiler: valid programs pass, invalid ones still fail).
    const cap = `@cap/${module.id}`;
    const short = `@c/${module.id}`;
    return (
      `declare module ${JSON.stringify(cap)} {\n${body}}\n` +
      `declare module ${JSON.stringify(short)} {\nimport { api } from ${JSON.stringify(cap)};\nexport { api };\n}\n`
    );
  }
  return `declare module ${JSON.stringify("@cap/" + module.id)} {\n${body}}\ndeclare module ${JSON.stringify("@c/" + module.id)} {\n${body}}\n`;
}
