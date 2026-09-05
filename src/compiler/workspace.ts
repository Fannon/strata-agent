import ts from "typescript";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const libDir = dirname(createRequire(import.meta.url).resolve("typescript"));
const programPath = "/strata/program.ts";
const declarationPath = "/strata/capabilities.d.ts";

/** Persistent language service; each invocation replaces the whole program. */
export class Workspace {
  private source = "";
  private version = 0;
  private declarations = "";
  private declarationsVersion = 0;
  private service: ts.LanguageService;
  constructor(declarations: string) {
    this.declarations = declarations;
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      types: [],
      lib: ["lib.es2022.d.ts"],
      noEmitOnError: true,
    };
    // Compiler can read only its standard libraries and the two virtual files.
    const read = (path: string) =>
      path === programPath
        ? this.source
        : path === declarationPath
          ? this.declarations
          : path.startsWith(libDir + "/") &&
              /^lib\.[\w.]+\.d\.ts$/.test(path.slice(libDir.length + 1))
            ? ts.sys.readFile(path)
            : undefined;
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => options,
      getScriptFileNames: () => [programPath, declarationPath],
      getScriptVersion: (path) =>
        path === programPath
          ? String(this.version)
          : path === declarationPath
            ? String(this.declarationsVersion)
            : "0",
      getScriptSnapshot: (path) => {
        const source = read(path);
        return source === undefined
          ? undefined
          : ts.ScriptSnapshot.fromString(source);
      },
      getCurrentDirectory: () => "/strata",
      getDefaultLibFileName: () => join(libDir, "lib.es2022.full.d.ts"),
      fileExists: (path) => read(path) !== undefined,
      readFile: read,
    };
    this.service = ts.createLanguageService(host);
  }
  compile(source: string): { diagnostics: string[]; code?: string } {
    this.source = source;
    this.version++;
    const tree = ts.createSourceFile(
      programPath,
      source,
      ts.ScriptTarget.ES2022,
      true,
    );
    const diagnostics: string[] = [];
    // Suppression comments undermine compile-before-execute feedback. Assertions remain
    // normal TS and are backed by schema validation at the broker.
    if (/@ts-(?:ignore|nocheck|expect-error)\b/.test(source))
      diagnostics.push(
        "program.ts: TypeScript diagnostic suppression directives are not supported",
      );
    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        (!ts.isStringLiteral(node.moduleSpecifier) ||
          !node.moduleSpecifier.text.startsWith("@cap/"))
      )
        diagnostics.push("program.ts: only @cap/ imports are available");
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      )
        diagnostics.push("program.ts: dynamic imports are not supported");
      ts.forEachChild(node, visit);
    };
    visit(tree);
    const all = [
      ...this.service.getCompilerOptionsDiagnostics(),
      ...this.service.getSyntacticDiagnostics(programPath),
      ...this.service.getSemanticDiagnostics(programPath),
      ...this.service.getSemanticDiagnostics(declarationPath),
    ];
    for (const d of all) {
      const pos = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
      diagnostics.push(
        `${d.file?.fileName.split("/").pop() ?? "compiler"}${pos ? `:${pos.line + 1}:${pos.character + 1}` : ""} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`,
      );
    }
    const program = this.service.getProgram()!;
    const checker = program.getTypeChecker();
    const file = program.getSourceFile(programPath)!;
    const symbol = checker.getSymbolAtLocation(file);
    const main =
      symbol &&
      checker.getExportsOfModule(symbol).find((s) => s.name === "main");
    if (
      !main ||
      !checker
        .getTypeOfSymbolAtLocation(main, file)
        .getCallSignatures()
        .some((s) => s.parameters.length === 0)
    )
      diagnostics.push(
        "program.ts: export a zero-argument main() function returning your result",
      );
    if (diagnostics.length) return { diagnostics };
    const emit = this.service.getEmitOutput(programPath);
    if (emit.emitSkipped)
      return { diagnostics: ["TypeScript emit was skipped; no code executed"] };
    return {
      diagnostics,
      code: emit.outputFiles.find((f) => f.name.endsWith(".js"))!.text,
    };
  }
  /** Replace the capability declarations (hot-add); next compile sees them. */
  setDeclarations(declarations: string) {
    this.declarations = declarations;
    this.declarationsVersion++;
  }
  close() {
    this.service.dispose();
  }
}
