// The F1 boundary test's rule (PRODUCT.1b1; PRODUCT spec §2 F1, §10 P-c and P-d): a Plus package imports core only
// through a public `exports` entry of a core package, the same entries a game or a user can import. The public
// entries are read from the core packs Plus installs (.core/packs, P5-D1): a packed manifest's `exports` is the
// published one, so a core package that is private (runtime and render-pixi until they publish) has no pack and
// no entry. Every `@mcthaydt/` name that is not a Plus package is core (as in tooling/core/manifest-rules.ts).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { plusPackageNames } from '../core/manifest-rules.ts'
import { parsePacks } from '../core/overrides.ts'

const CORE_SCOPE = '@mcthaydt/'
const SOURCE_FILE = /\.(ts|svelte)$/
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', '.turbo'])

/**
 * `from '…'`, `import '…'` and `import('…')`, wherever they are. A comment that reads like an import is read too:
 * that can only add a finding, never hide one.
 */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g

export function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((match) => match[1] as string)
}

/** Every specifier a public `exports` key of a packed core package gives: `.` is the name, `./x` is `name/x`. */
export function publicCoreEntries(root: string): Set<string> {
  const packsJson = join(root, '.core', 'packs', 'packs.json')
  if (!existsSync(packsJson)) throw new Error(`${packsJson} is missing: run pnpm core:sync`)
  const entries = new Set<string>()
  for (const pack of parsePacks(readFileSync(packsJson, 'utf8')).packs) {
    const manifest = JSON.parse(
      readFileSync(join(root, '.core', 'packs', pack.dir, 'package.json'), 'utf8'),
    ) as {
      exports?: Record<string, unknown>
    }
    for (const key of Object.keys(manifest.exports ?? {}))
      entries.add(key === '.' ? pack.name : `${pack.name}/${key.slice(2)}`)
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

/** True when `specifier` names `name` itself or a path inside it. */
const isIn = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`)

/** One message per core import outside the public entries, in every package under packages/: `file:line: …`. */
export function coreImportFindings(root: string): string[] {
  const entries = publicCoreEntries(root)
  const plusNames = [...plusPackageNames(root)]
  const packagesDir = join(root, 'packages')
  if (!existsSync(packagesDir)) return []
  const findings: string[] = []
  for (const file of sourceFiles(packagesDir)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      for (const specifier of importSpecifiers(line)) {
        if (!specifier.startsWith(CORE_SCOPE) || entries.has(specifier)) continue
        if (plusNames.some((name) => isIn(specifier, name))) continue
        findings.push(
          `${relative(root, file)}:${index + 1}: "${specifier}" is not a public exports entry of a core package`,
        )
      }
    })
  }
  return findings
}
