// The F1 boundary test's rule (PRODUCT.1b1; PRODUCT spec §2 F1, §10 P-c and P-d): a Plus package imports core only
// through a public `exports` entry of a core package, the same entries a game or a user can import. The public
// entries are read from the core packs Plus installs (.core/packs, P5-D1): a packed manifest's `exports` is the
// published one, so a core package that is private (runtime and render-pixi until they publish) has no pack and
// no entry. A private pack Plus needs for its own tests (the framework's evidence tool, a core-packs extra) is
// allowed in test files only, because it is never published. Every `@mcthaydt/` name that is not a Plus package is core (as in tooling/core/manifest-rules.ts).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { plusPackageNames } from '../core/manifest-rules.ts'
import { parsePacks } from '../core/overrides.ts'

const CORE_SCOPE = '@mcthaydt/'
const SOURCE_FILE = /\.(?:[mc]?[jt]sx?|svelte)$/
/** A test file may import a private core pack (the framework's evidence tool); shipped code may not. */
const TEST_FILE = /\.test\.[mc]?[jt]sx?$/
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', '.turbo'])

/**
 * `from '…'`, `import '…'`, `import('…')` and `require('…')`, wherever they are and across line breaks. A comment
 * that reads like an import is read too: that can only add a finding, never hide one.
 */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

interface FoundImport {
  readonly specifier: string
  /** 1-based line of the specifier itself. */
  readonly line: number
}

function findImports(source: string): FoundImport[] {
  return [...source.matchAll(IMPORT)].map((match) => {
    const specifier = match[1] as string
    const at = (match.index ?? 0) + match[0].lastIndexOf(specifier)
    return { specifier, line: source.slice(0, at).split('\n').length }
  })
}

export function importSpecifiers(source: string): string[] {
  return findImports(source).map((found) => found.specifier)
}

export interface CoreEntries {
  /** Entries of published core packs. */
  readonly public: Set<string>
  /** Entries of private packs (packed as extras, never published): test files only. */
  readonly testOnly: Set<string>
}

/** Every specifier a public `exports` key of a packed core package gives: `.` is the name, `./x` is `name/x`. */
export function publicCoreEntries(root: string): Set<string> {
  return coreEntries(root).public
}

function coreEntries(root: string): CoreEntries {
  const packsJson = join(root, '.core', 'packs', 'packs.json')
  if (!existsSync(packsJson)) throw new Error(`${packsJson} is missing: run pnpm core:sync`)
  const entries: CoreEntries = { public: new Set(), testOnly: new Set() }
  for (const pack of parsePacks(readFileSync(packsJson, 'utf8')).packs) {
    const manifest = JSON.parse(
      readFileSync(join(root, '.core', 'packs', pack.dir, 'package.json'), 'utf8'),
    ) as {
      private?: boolean
      exports?: Record<string, unknown>
    }
    const into = manifest.private === true ? entries.testOnly : entries.public
    for (const key of Object.keys(manifest.exports ?? {}))
      into.add(key === '.' ? pack.name : `${pack.name}/${key.slice(2)}`)
  }
  return entries
}

function sourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, item.name)
    if (item.isDirectory()) {
      if (!SKIPPED_DIRS.has(item.name)) files.push(...sourceFiles(path))
    } else if (SOURCE_FILE.test(item.name)) files.push(path)
  }
  return files
}

/**
 * Where Plus packages live: everything under `packages/`, and each workspace package under `tooling/` (a folder with
 * its own package.json, such as the pipelines platform). Loose tooling scripts are not packages and are not scanned.
 */
function scannedRoots(root: string): string[] {
  const roots: string[] = []
  const packagesDir = join(root, 'packages')
  if (existsSync(packagesDir)) roots.push(packagesDir)
  const toolingDir = join(root, 'tooling')
  if (existsSync(toolingDir))
    for (const item of readdirSync(toolingDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    ))
      if (item.isDirectory() && existsSync(join(toolingDir, item.name, 'package.json')))
        roots.push(join(toolingDir, item.name))
  return roots
}

/** True when `specifier` names `name` itself or a path inside it. */
const isIn = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`)

/** One message per core import outside the public entries, in every Plus package (packages/ and tooling/ workspace packages): `file:line: …`. */
export function coreImportFindings(root: string): string[] {
  const entries = coreEntries(root)
  const plusNames = [...plusPackageNames(root)]
  const findings: string[] = []
  for (const file of scannedRoots(root).flatMap(sourceFiles)) {
    const where = relative(root, file)
    const isTest = TEST_FILE.test(file)
    for (const { specifier, line } of findImports(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith(CORE_SCOPE) || entries.public.has(specifier)) continue
      if (plusNames.some((name) => isIn(specifier, name))) continue
      if (entries.testOnly.has(specifier)) {
        if (!isTest)
          findings.push(`${where}:${line}: "${specifier}" is a private core package, for test files only`)
        continue
      }
      findings.push(`${where}:${line}: "${specifier}" is not a public exports entry of a core package`)
    }
  }
  return findings
}
