import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding } from './check.ts'
import { type ForbidReport, forbidFindings } from './forbid.ts'

// The `--no-extension-imports` check: core never imports an extension. The roots it is given (core's packages and the
// 2D reference game) may not import any package that lives under `extensions/`, type-only and dynamic imports
// included. It is the `--forbid` reader with its own rule name and message, so a name in a string is not an import.

/** The package names of every `extensions/<folder>/package.json` under `repoRoot`. */
export function extensionPackageNames(repoRoot: string): ReadonlySet<string> {
  const dir = join(repoRoot, 'extensions')
  if (!existsSync(dir)) return new Set()
  const names = readdirSync(dir)
    .map((folder) => join(dir, folder, 'package.json'))
    .filter((manifest) => existsSync(manifest))
    .map((manifest) => (JSON.parse(readFileSync(manifest, 'utf8')) as { name: string }).name)
  return new Set(names)
}

const EXTENSION_REPORT: ForbidReport = {
  rule: 'extension-import',
  message: (specifier) => `core never imports an extension: ${specifier}`,
}

/** The findings for every source under `roots` that imports one of `extensionNames` (or a path inside it). */
export function extensionImportFindings(
  roots: readonly string[],
  extensionNames: ReadonlySet<string>,
): Finding[] {
  return roots.flatMap((root) => forbidFindings(root, [...extensionNames], EXTENSION_REPORT).findings)
}
