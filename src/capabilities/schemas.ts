import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { compile } from "json-schema-to-typescript";
import type { CapabilityModule, JsonSchema } from "./manifest.ts";

export function validator(schema: JsonSchema) {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: false,
    validateFormats: true,
  });
  addFormats(ajv);
  const check = ajv.compile(schema);
  return (value: unknown): string | undefined =>
    check(value)
      ? undefined
      : ajv.errorsText(check.errors, { dataVar: "value" });
}

export const declarationsPreamble =
  "declare const console: { log(...values: unknown[]): void };";

export async function declarations(module: CapabilityModule): Promise<string> {
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
    definitions.push(
      `namespace Op${i} {\n${await generate(op.inputSchema, input)}\n${op.outputSchema ? await generate(op.outputSchema, output) : ""}\n}`,
    );
    const doc = (op.description ?? "").replaceAll("*/", "* /");
    methods.push(
      `/** ${doc} */\n${JSON.stringify(op.name)}(input: Op${i}.${input}): Promise<${op.outputSchema ? `Op${i}.${output}` : "unknown"}>;`,
    );
  }
  const body = `${definitions.join("\n")}\nexport const api: {\n${methods.join("\n")}\n};\n`;
  return `declare module ${JSON.stringify("@cap/" + module.id)} {\n${body}}\ndeclare module ${JSON.stringify("@c/" + module.id)} {\n${body}}\n`;
}
