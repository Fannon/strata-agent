import ts from "typescript";

export interface CatalogOperationMeta {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface CapabilityMeta {
  id: string;
  description?: string;
  operations: CatalogOperationMeta[];
  dependsOn?: string[];
  related?: string[];
}

export interface CatalogEntry {
  /** File the entry was extracted from. */
  file: string;
  meta: CapabilityMeta;
}

/**
 * Extract the `export const meta = {...}` value from a catalog source file
 * WITHOUT executing the module. Only JSON-compatible static literals are
 * accepted (string/number/boolean/null/array/object, unary minus); anything
 * computed — function calls, identifiers, spreads, template interpolation —
 * throws a descriptive error instead of running.
 */
export function extractMeta(sourceText: string, file = "catalog.ts"): CapabilityMeta {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  let init: ts.Expression | undefined;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "meta" &&
        declaration.initializer
      ) {
        init = declaration.initializer;
      }
    }
  }
  if (!init)
    throw new Error(`${file}: catalog requires \`export const meta = {...}\``);
  const value = evalLiteral(unwrap(init), file);
  return assertMeta(value, file);
}

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    node = node.expression;
  }
  // `export const meta = {...} as const` may nest; parenthesized for safety.
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

function evalLiteral(node: ts.Expression, file: string): unknown {
  const fail = (): never => {
    const { line } = ts.getLineAndCharacterOfPosition(
      node.getSourceFile(),
      node.getStart(),
    );
    throw new Error(
      `${file}:${line + 1}: catalog meta must be a static literal; ` +
        `found ${ts.SyntaxKind[node.kind]}. Move computed values into bindings.`,
    );
  };
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) {
    const items: unknown[] = [];
    for (const element of node.elements) {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) {
        fail();
      } else {
        items.push(evalLiteral(element, file));
      }
    }
    return items;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        const key = property.name;
        if (
          ts.isIdentifier(key) ||
          ts.isStringLiteral(key) ||
          ts.isNumericLiteral(key)
        ) {
          out[key.text] = evalLiteral(unwrap(property.initializer), file);
          continue;
        }
      }
      fail();
    }
    return out;
  }
  return fail();
}

function assertMeta(value: unknown, file: string): CapabilityMeta {
  const fail = (why: string): CapabilityMeta => {
    throw new Error(`${file}: invalid catalog meta: ${why}`);
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("top level must be an object");
  const meta = value as Record<string, unknown>;
  if (typeof meta.id !== "string" || !meta.id) return fail("id must be a non-empty string");
  if (meta.description !== undefined && typeof meta.description !== "string")
    return fail("description must be a string");
  if (!Array.isArray(meta.operations) || !meta.operations.length)
    return fail("operations must be a non-empty array");
  for (const op of meta.operations) {
    if (!op || typeof op !== "object") return fail("each operation must be an object");
    const operation = op as Record<string, unknown>;
    if (typeof operation.name !== "string" || !operation.name)
      return fail("each operation needs a string name");
    if (
      !operation.inputSchema ||
      typeof operation.inputSchema !== "object" ||
      Array.isArray(operation.inputSchema)
    )
      return fail(`operation ${operation.name} needs an inputSchema object`);
    if (
      operation.outputSchema !== undefined &&
      (typeof operation.outputSchema !== "object" ||
        !operation.outputSchema ||
        Array.isArray(operation.outputSchema))
    )
      return fail(`operation ${operation.name} has an invalid outputSchema`);
  }
  for (const edge of ["dependsOn", "related"] as const) {
    if (meta[edge] !== undefined) {
      if (
        !Array.isArray(meta[edge]) ||
        !(meta[edge] as unknown[]).every((e) => typeof e === "string")
      )
        return fail(`${edge} must be a string array`);
    }
  }
  return {
    id: meta.id as string,
    ...(typeof meta.description === "string" ? { description: meta.description } : {}),
    operations: meta.operations as CatalogOperationMeta[],
    ...((meta.dependsOn as string[] | undefined)?.length ? { dependsOn: meta.dependsOn as string[] } : {}),
    ...((meta.related as string[] | undefined)?.length ? { related: meta.related as string[] } : {}),
  };
}

/** Read a catalog file and extract its metadata without executing it. */
export async function loadCatalogFile(file: string): Promise<CatalogEntry> {
  const { readFile } = await import("node:fs/promises");
  return { file, meta: extractMeta(await readFile(file, "utf8"), file) };
}

export interface SearchHit {
  id: string;
  file: string;
  description?: string;
  matchedOperations: string[];
  score: number;
}

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

/**
 * Deterministic lexical search over extracted catalog metadata.
 * Scores query-token overlap against id, description and operation
 * names/descriptions; id matches weigh double. Ties break by id.
 */
export function searchCatalog(
  entries: CatalogEntry[],
  query: string,
  limit = 5,
): SearchHit[] {
  const wanted = new Set(tokens(query));
  if (!wanted.size) return [];
  return entries
    .map((entry) => {
      const { meta } = entry;
      const idTokens = new Set(tokens(meta.id));
      const textTokens = new Set(
        tokens(
          [meta.description ?? "", ...meta.operations.flatMap((op) => [op.name, op.description ?? ""])].join(" "),
        ),
      );
      let score = 0;
      for (const token of wanted) {
        if (idTokens.has(token)) score += 2;
        else if (textTokens.has(token)) score += 1;
      }
      return {
        id: meta.id,
        file: entry.file,
        ...(meta.description ? { description: meta.description } : {}),
        matchedOperations: meta.operations
          .filter((op) =>
            tokens(`${op.name} ${op.description ?? ""}`).some((t) => wanted.has(t)),
          )
          .map((op) => op.name),
        score,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, Math.max(0, limit));
}
