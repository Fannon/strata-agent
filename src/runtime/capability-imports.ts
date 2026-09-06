/**
 * Capability import rewrite for the direct-Bun executor (issue 027).
 *
 * The TypeScript compiler accepts any `@c/`/`@cap/` import shape, while the
 * QuickJS worker resolves those specifiers through its own module loader.
 * A disposable Bun worker has no such loader, so the emitted JavaScript is
 * rewritten here: capability imports become destructures from a
 * `globalThis.__strataCaps` table installed by the worker before evaluation.
 *
 * Named imports keep their local bindings (`import { api as fs }` works);
 * namespace imports bind the whole table entry. Anything else that names a
 * capability specifier (default, side-effect or re-export forms) fails with
 * an explicit error instead of silently changing meaning. Unknown
 * capability ids fail with the same "Module unavailable" message as the
 * QuickJS loader. Duplicate local `api` bindings are left for the engine to
 * reject, matching ESM duplicate-binding behavior in both runtimes.
 */
export function rewriteCapabilityImports(
  code: string,
  knownIds: readonly string[],
): string {
  const known = new Set(knownIds);
  const unsupported =
    /(^|;|\})\s*import\s+(?![{*])([^"']+?)\s+from\s*["']@c(?:ap)?\/[^"']+["']|(^|;|\})\s*import\s*["']@c(?:ap)?\/[^"']+["']|export\s+[^;]*\s+from\s*["']@c(?:ap)?\/[^"']+["']/m;
  const probe = unsupported.exec(code);
  if (probe)
    throw new Error(
      `Direct-Bun bindings support only named and namespace @c/ imports: ${probe[0].slice(0, 80).trim()}`,
    );
  const checkId = (id: string, specifier: string) => {
    if (!known.has(id)) throw new Error(`Module unavailable: ${specifier}`);
  };
  const namespaceRe =
    /(^|;|\})\s*import\s*\*\s*as\s*([A-Za-z_$][\w$]*)\s*from\s*["'](@c(?:ap)?\/([A-Za-z0-9_-]+))["']\s*;?/g;
  const namedRe =
    /(^|;|\})\s*import\s*\{([^}]*)\}\s*from\s*["'](@c(?:ap)?\/([A-Za-z0-9_-]+))["']\s*;?/g;
  let out = code.replace(
    namespaceRe,
    (_match, prefix: string, local: string, specifier: string, id: string) => {
      checkId(id, specifier);
      return `${prefix}const ${local} = globalThis.__strataCaps[${JSON.stringify(id)}];`;
    },
  );
  out = out.replace(
    namedRe,
    (_match, prefix: string, names: string, specifier: string, id: string) => {
      checkId(id, specifier);
      const bindings = names
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const alias = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(part);
          if (!alias) throw new Error(`Unsupported import binding: ${part}`);
          return alias[2] ? `${alias[1]}: ${alias[2]}` : alias[1];
        });
      if (!bindings.length) throw new Error(`Empty import from ${specifier}`);
      return `${prefix}const { ${bindings.join(", ")} } = globalThis.__strataCaps[${JSON.stringify(id)}];`;
    },
  );
  return out;
}
