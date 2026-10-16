// Reads every export of every entry point from the emitted .d.ts with the TypeScript 6 type checker (DX spec
// §3.8). The checker is needed because rolldown-plugin-dts splits declarations into chunks and renames them
// (`export { n as ColliderOptions }`): an export's name, declaration and doc comment are found by resolving its
// alias, never by matching text. TypeScript 7 has no stable JS API yet (plan: Decisions).
import ts from 'typescript'
import type { EntryPoint } from './entry-points.ts'

export type ApiKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'const'
  | 'let'
  | 'var'
  | 'namespace'
  | 'other'

/** One export of one published entry point, for one version: a row of `api.json`. */
export interface ApiExport {
  readonly package: string
  readonly entryPoint: string
  readonly name: string
  readonly kind: ApiKind
  /** The declaration as written in the `.d.ts`, without `export`/`declare`, overloads one per line. */
  readonly signature: string
  /** The doc comment (each overload's, joined) and its `@tags`, one per line; empty when there is none. */
  readonly doc: string
  readonly version: string
}

// en collation, so the order is the same on every machine and reads naturally (`add`, `Color`, `Counter`).
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare

function kindOf(declaration: ts.Declaration | undefined): ApiKind {
  if (declaration === undefined) return 'other'
  if (ts.isFunctionDeclaration(declaration)) return 'function'
  if (ts.isClassDeclaration(declaration)) return 'class'
  if (ts.isInterfaceDeclaration(declaration)) return 'interface'
  if (ts.isTypeAliasDeclaration(declaration)) return 'type'
  if (ts.isEnumDeclaration(declaration)) return 'enum'
  if (ts.isModuleDeclaration(declaration) || ts.isSourceFile(declaration)) return 'namespace'
  if (ts.isVariableDeclaration(declaration)) {
    const flags = ts.getCombinedNodeFlags(declaration)
    if (flags & ts.NodeFlags.Const) return 'const'
    return flags & ts.NodeFlags.Let ? 'let' : 'var'
  }
  return 'other'
}

const LEADING_MODIFIERS = /^(?:(?:export|declare|default)\s+)+/

/** One declaration's text, named `name` even where a chunk declared it under another local name. */
function declarationText(declaration: ts.Declaration, name: string): string {
  if (ts.isSourceFile(declaration)) return `namespace ${name}`
  const start = declaration.getStart()
  let text = declaration.getText()
  const ownName = ts.getNameOfDeclaration(declaration)
  if (ownName !== undefined && ownName.getText() !== name) {
    const from = ownName.getStart() - start
    text = text.slice(0, from) + name + text.slice(from + ownName.getText().length)
  }
  if (ts.isVariableDeclaration(declaration)) return `${kindOf(declaration)} ${text};`
  return text.replace(LEADING_MODIFIERS, '')
}

function docOf(symbol: ts.Symbol, checker: ts.TypeChecker): string {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
  const tags = symbol.getJsDocTags(checker).map((tag) => {
    const tagText = ts.displayPartsToString(tag.text).trim()
    return tagText === '' ? `@${tag.name}` : `@${tag.name} ${tagText}`
  })
  return [text, ...tags].filter((line) => line !== '').join('\n')
}

/** Every export of `entries`, sorted by package, entry point and name. */
export function extractExports(entries: readonly EntryPoint[]): ApiExport[] {
  const program = ts.createProgram(
    entries.map((entry) => entry.typesFile),
    {
      // Only declarations, aliases and doc comments are read, never types, so the default lib and @types are
      // not loaded (loading them made each run several seconds slower). Diagnostics are not read.
      noLib: true,
      types: [],
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  )
  const checker = program.getTypeChecker()
  const rows: ApiExport[] = []
  for (const entry of entries) {
    const source = program.getSourceFile(entry.typesFile)
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) throw new Error(`${entry.typesFile} is not a module`)
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const declarations = symbol.declarations ?? []
      rows.push({
        package: entry.package,
        entryPoint: entry.entryPoint,
        name: exported.name,
        kind: kindOf(declarations[0]),
        signature: declarations.map((declaration) => declarationText(declaration, exported.name)).join('\n'),
        doc: docOf(symbol, checker),
        version: entry.version,
      })
    }
  }
  return rows.sort(
    (a, b) =>
      a.package.localeCompare(b.package, 'en') ||
      a.entryPoint.localeCompare(b.entryPoint, 'en') ||
      byName(a.name, b.name),
  )
}
