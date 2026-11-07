// The one export extractor, shared by `pnpm api-report` and
// `pnpm api-index`. Two inputs, one reader:
// - `sourceExports` reads each core entry point from source. AF builds with `isolatedDeclarations`, so
//   TypeScript 6's `transpileDeclaration` turns every source file into its declarations alone. Files outside
//   the core packages' `src` (effect, zod, pixi.js) load as empty modules: only declaration text is read,
//   never types, so nothing external is needed, no `pnpm build` either, private packages are covered, and a
//   run takes seconds.
// - `declarationExports` reads the emitted `.d.ts` as written. rolldown-plugin-dts splits declarations into
//   chunks and renames them (`export { n as ColliderOptions }`), so nothing is matched by text.
// Either way the checker resolves each export's aliases across files and packages, and `readExports`
// describes what they name: its kind, its declaration text under the exported name, its doc comment. Each
// tool keeps its own row shape and order (`extractApi` below; tooling/api-index/src/rows.ts). TypeScript 7
// has no stable JS API yet, so this is TypeScript 6.
import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import ts from 'typescript'
import type { CorePackage } from './core-packages.ts'

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
  | 'svelte'
  | 'unresolved'
  | 'other'

export interface ApiExport {
  readonly name: string
  readonly kind: ApiKind
  /** The declaration(s) without `export`/`declare`, named as exported; merged declarations one after another. */
  readonly declaration: string
}

export interface ApiEntry {
  readonly entryPoint: string
  readonly exports: readonly ApiExport[]
}

export interface PackageApi {
  readonly package: string
  readonly version: string
  readonly entries: readonly ApiEntry[]
}

/** One export of one entry module, as the one extractor reads it. */
export interface ExtractedExport {
  readonly name: string
  readonly kind: ApiKind
  /** The declaration(s) without `export`/`declare`, named as exported; overloads and merged ones in order. */
  readonly declaration: string
  /** The doc comment (each declaration's, joined) and its `@tags`, one per line; empty when there is none. */
  readonly doc: string
}

/** The exports of one entry file in the order the checker lists them; undefined when it is not a module. */
export type ExportsOf = (file: string) => readonly ExtractedExport[] | undefined

/** Case-insensitive, then by code unit: the same order on every machine, whatever its locale. */
export function byName(a: string, b: string): number {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()
  if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

function kindOf(declaration: ts.Declaration): ApiKind {
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

/** One declaration's text, named `name` even where it was declared under another local name. */
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

/** The module an unresolved re-export names, e.g. `./dialog/Dialog.svelte`. */
function reexportSource(alias: ts.Symbol): string | undefined {
  for (const declaration of alias.declarations ?? []) {
    const exportDeclaration = ts.isExportSpecifier(declaration) ? declaration.parent.parent : undefined
    const specifier = exportDeclaration?.moduleSpecifier
    if (specifier !== undefined && ts.isStringLiteral(specifier)) return specifier.text
  }
  return undefined
}

function docOf(symbol: ts.Symbol, checker: ts.TypeChecker): string {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
  const tags = symbol.getJsDocTags(checker).map((tag) => {
    const tagText = ts.displayPartsToString(tag.text).trim()
    return tagText === '' ? `@${tag.name}` : `@${tag.name} ${tagText}`
  })
  return [text, ...tags].filter((line) => line !== '').join('\n')
}

function describeExport(exported: ts.Symbol, checker: ts.TypeChecker): ExtractedExport {
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
  const declarations = symbol.declarations ?? []
  const [first] = declarations
  if (first === undefined) {
    // The alias resolves to nothing: a module the program cannot read (a `.svelte` file has no declarations
    // here), so the export is named by the module it comes from.
    const source = reexportSource(exported)
    if (source?.endsWith('.svelte')) {
      return { name: exported.name, kind: 'svelte', declaration: `component from '${source}'`, doc: '' }
    }
    return { name: exported.name, kind: 'unresolved', declaration: `from '${source ?? '?'}'`, doc: '' }
  }
  return {
    name: exported.name,
    kind: kindOf(first),
    declaration: declarations.map((declaration) => declarationText(declaration, exported.name)).join('\n'),
    doc: docOf(symbol, checker),
  }
}

/** The one reader: every export of each entry file of `program`. */
function readExports(program: ts.Program): ExportsOf {
  const checker = program.getTypeChecker()
  return (file) => {
    const source = program.getSourceFile(file)
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) return undefined
    return checker.getExportsOfModule(moduleSymbol).map((exported) => describeExport(exported, checker))
  }
}

/** Each core entry point's exports, read from source (no build). Comments are not emitted: `doc` is empty. */
export function sourceExports(packages: readonly CorePackage[]): ExportsOf {
  const sourceDirs = packages.map((pkg) => join(pkg.dir, 'src') + sep)
  const isCoreSource = (file: string) =>
    !file.endsWith('.d.ts') && /\.[cm]?ts$/.test(file) && sourceDirs.some((dir) => file.startsWith(dir))

  // Workspace imports resolve to source through `paths`, never through node_modules links.
  const paths: Record<string, string[]> = {}
  for (const pkg of packages) {
    for (const entry of pkg.entries) {
      paths[entry.entryPoint === '.' ? pkg.name : `${pkg.name}${entry.entryPoint.slice(1)}`] = [entry.file]
    }
  }
  const options: ts.CompilerOptions = {
    noLib: true,
    types: [],
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    paths,
  }
  const host = ts.createCompilerHost(options, true)
  host.getSourceFile = (fileName, languageVersion) => {
    if (!isCoreSource(fileName)) return ts.createSourceFile(fileName, '', languageVersion, true)
    const declarations = ts.transpileDeclaration(readFileSync(fileName, 'utf8'), {
      fileName,
      compilerOptions: { isolatedDeclarations: true, declaration: true, removeComments: true },
    }).outputText
    return ts.createSourceFile(fileName, declarations, languageVersion, true)
  }

  const files = packages.flatMap((pkg) => pkg.entries.map((entry) => entry.file))
  return readExports(ts.createProgram(files, options, host))
}

/**
 * Each emitted `.d.ts` entry file's exports, read as written, with doc comments. `paths` maps an import specifier
 * to the declaration file it must resolve to: without it, an import of another workspace package follows its
 * `node_modules` link to the package's manifest, whose `exports` point at source, and the re-export prints the source.
 */
export function declarationExports(
  files: readonly string[],
  paths?: Record<string, string[]>,
): ExportsOf {
  const program = ts.createProgram(files, {
    // Only declarations, aliases and doc comments are read, never types, so the default lib and @types are
    // not loaded (loading them made each run several seconds slower). Diagnostics are not read.
    noLib: true,
    types: [],
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    ...(paths === undefined ? {} : { paths }),
  })
  return readExports(program)
}

/** The API of every package, entry points in `exports` order, exports sorted by `byName`. */
export function extractApi(packages: readonly CorePackage[]): PackageApi[] {
  const exportsOf = sourceExports(packages)
  return packages.map((pkg) => ({
    package: pkg.name,
    version: pkg.version,
    entries: pkg.entries.map((entry) => ({
      entryPoint: entry.entryPoint,
      // An entry that is not a module (no import or export) has no exports. The report has no doc comments.
      exports: (exportsOf(entry.file) ?? [])
        .map(({ name, kind, declaration }) => ({ name, kind, declaration }))
        .sort((a, b) => byName(a.name, b.name)),
    })),
  }))
}
