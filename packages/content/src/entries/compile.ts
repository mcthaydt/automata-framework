// @mcthaydt/automata-content/compile: the content compile with no disk and no Effect. Hand it every file of a game
// (`content/feel.toml` and its text) and it gives the compiled content or the problems an author must fix. The
// editors' phone app runs it in its page. Browser-safe: no Node built-ins and no Effect.

export {
  type CompiledContent,
  type CompileOptions,
  type CompileResult,
  compileContentFiles,
  type MessageLocation,
} from '../shared/compile/compile-tree'
export { contentModuleText, VIRTUAL_MODULE_ID } from '../shared/compile/content-module'
export { type Diagnostic, formatDiagnostic } from '../shared/diagnostics/diagnostic'
export type { SourceFile } from '../shared/parse/parse-document'
