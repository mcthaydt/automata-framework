// Reads each core entry point's exports from source (PRODUCT spec §2 F6). AF builds with
// `isolatedDeclarations`, so TypeScript 6's `transpileDeclaration` turns every source file into its
// declarations alone; the checker then resolves each export's aliases across files and packages, as DX.4's
// API index does over the built `.d.ts`. No `pnpm build` is needed, and private packages are covered.
// Files outside the core packages' `src` (effect, zod, pixi.js) load as empty modules: only declaration text
// is read, never types, so nothing external is needed and a run takes seconds.
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

function describeExport(exported: ts.Symbol, checker: ts.TypeChecker): ApiExport {
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
  const declarations = symbol.declarations ?? []
  const [first] = declarations
  if (first === undefined) {
    const source = reexportSource(exported)
    if (source?.endsWith('.svelte')) {
      return { name: exported.name, kind: 'svelte', declaration: `component from '${source}'` }
    }
    return { name: exported.name, kind: 'unresolved', declaration: `from '${source ?? '?'}'` }
  }
  return {
    name: exported.name,
    kind: kindOf(first),
    declaration: declarations.map((declaration) => declarationText(declaration, exported.name)).join('\n'),
  }
}

/** The API of every package, entry points in `exports` order, exports sorted by `byName`. */
export function extractApi(packages: readonly CorePackage[]): PackageApi[] {
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
  const program = ts.createProgram(files, options, host)
  const checker = program.getTypeChecker()

  return packages.map((pkg) => ({
    package: pkg.name,
    version: pkg.version,
    entries: pkg.entries.map((entry) => {
      const source = program.getSourceFile(entry.file)
      const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
      const exported = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol)
      return {
        entryPoint: entry.entryPoint,
        exports: exported
          .map((symbol) => describeExport(symbol, checker))
          .sort((a, b) => byName(a.name, b.name)),
      }
    }),
  }))
}
