/** Experiment-only execution policies. Production sessions still always check. */
import ts from "typescript";
import { Workspace } from "../../src/compiler/workspace.ts";
import { CapabilityBroker, type Metrics } from "../../src/capabilities/broker.ts";
import { declarations, declarationsPreamble } from "../../src/capabilities/schemas.ts";
import { executeWith } from "../../src/runtime/executor.ts";
import { manifest, type World } from "./fixture.ts";

export const policies = ["always", "never", "after-failure"] as const;
export type Policy = typeof policies[number];
export function metrics(programId: string): Metrics {
  return { programId, sourceBytes: 0, compileMs: 0, diagnostics: [], executionMs: 0,
    capabilityCalls: 0, calls: [], rawCapabilityBytes: 0, bytesExposedToPi: 0,
    validationFailures: 0, policyFailures: 0, engine: "quickjs", outcome: "error", traceDropped: 0 };
}
export function transpile(source: string) {
  if (Buffer.byteLength(source) > 32768) throw new Error("Source exceeds 32768 bytes");
  if (/@ts-(?:ignore|nocheck|expect-error)\b/.test(source)) throw new Error("Diagnostic suppression is unavailable");
  const tree = ts.createSourceFile("program.ts", source, ts.ScriptTarget.ES2022, true);
  let main = false;
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier) ||
      !/^@(?:cap|c)\/pilot$/.test(node.moduleSpecifier.text))) throw new Error("Only @c/pilot capability imports are available");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) throw new Error("Dynamic imports are unavailable");
    if (ts.isFunctionDeclaration(node) && node.name?.text === "main" && node.parameters.length === 0 &&
      node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) main = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!main) throw new Error("Export a zero-argument main() function");
  const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, strict: true }, reportDiagnostics: true });
  if (emitted.diagnostics?.length) throw new Error(emitted.diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  return emitted.outputText;
}
export async function makeRuntime(world: World, policy: Policy) {
  const text = `${declarationsPreamble}\n${await declarations(manifest)}`;
  const compiler = new Workspace(text);
  const broker = new CapabilityBroker(manifest, world.connector, new Set(manifest.operations.map(o => o.name)));
  let sequence = 0;
  return {
    declarations: text, broker,
    async run(source: string, signal = new AbortController().signal) {
      const m = metrics(`pilot:p${++sequence}`);
      m.sourceBytes = Buffer.byteLength(source);
      let result: unknown, error: string | undefined;
      const start = performance.now();
      try {
        signal.throwIfAborted();
        // Common syntax, entry-point and import gate in all arms.
        let code = transpile(source);
        if (policy === "always") {
          const checked = compiler.compile(source);
          m.diagnostics = checked.diagnostics;
          if (m.diagnostics.length) { m.outcome = "compile-error"; error = "TypeScript checking failed; no calls executed"; }
          else code = checked.code!;
        }
        m.compileMs = performance.now() - start;
        if (!error) {
          const executionStart = performance.now();
          const execution = await executeWith("quickjs", code, broker, m, signal, 5000);
          m.executionMs = performance.now() - executionStart;
          result = execution.result; error = execution.error; m.outcome = execution.outcome;
          const excludedFailure = m.calls.some(c => c.failure && !["input", "output"].includes(c.failure));
          if (policy === "after-failure" && m.outcome === "error" && !excludedFailure) {
            const checkingStart = performance.now();
            m.diagnostics = compiler.compile(source).diagnostics;
            m.compileMs += performance.now() - checkingStart;
          }
        }
      } catch (e) { error = e instanceof Error ? e.message : String(e); m.outcome = "error"; m.compileMs ||= performance.now() - start; }
      const visible = error ? { error, diagnostics: m.diagnostics, calls: m.calls, result } : { result };
      const output = JSON.stringify(visible);
      m.bytesExposedToPi = Buffer.byteLength(output);
      return { result, error, metrics: m, text: output };
    },
    close() { compiler.close(); },
  };
}
