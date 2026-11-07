import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Finding } from './check.ts'
import { readImports } from './imports.ts'

// The `platform-imports` check (ADR 0006): a distribution target's platform packages are imported
// only from files under a folder named for that target, tests included, so AF's core stays target-neutral. Only
// real imports count (`import`, `export … from`, `import()`), read from the AST: a package named in a string, a
// comment or a template is not an import.

interface Platform {
  /** The packages' shared prefix. */
  readonly prefix: string
  /** The path segment a file must sit under to import them. */
  readonly folder: string
  /** What AF code uses instead, by package (the longest matching specifier prefix wins). */
  readonly replacements: Readonly<Record<string, string>>
}

const PLATFORMS: readonly Platform[] = [
  {
    prefix: '@ruken/',
    folder: 'ruken',
    replacements: {
      '@ruken/sdk':
        '@automata/framework (the host contract: Hosting, Capability, ErrorCode and the payloads)',
      '@ruken/sdk-host': '@automata/framework/testing (fakeHosting)',
      '@ruken/manifest': '@automata/content/game-config (the game config)',
      '@ruken/cli': 'automata ship publish --target ruken',
    },
  },
  {
    prefix: '@tauri-apps/',
    folder: 'tauri',
    replacements: { '@tauri-apps/': "@automata/framework/target under the 'tauri' build" },
  },
]

const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx|svelte)$/
const DECLARATION = /\.d\.[cm]?ts$/
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist'])

/** Every source file under `dir` the check reads, sorted: tests and Svelte components too, no declarations. */
export function collectPlatformSources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_DIRS.has(name) && !name.startsWith('.')) out.push(...collectPlatformSources(path))
    } else if (SOURCE.test(name) && !DECLARATION.test(name)) out.push(path)
  }
  return out
}

function replacementFor(platform: Platform, specifier: string): string {
  const keys = Object.keys(platform.replacements)
    .filter((key) => specifier === key || specifier.startsWith(key.endsWith('/') ? key : `${key}/`))
    .sort((a, b) => b.length - a.length)
  const key = keys[0]
  return key === undefined
    ? `a file under a '${platform.folder}/' folder`
    : (platform.replacements[key] as string)
}

/** The findings for one file: each platform import outside that platform's folder. */
export function platformImportFindings(file: string, code: string): Finding[] {
  const segments = file.replaceAll('\\', '/').split('/')
  const { imports, errors } = readImports(file, code)
  const findings: Finding[] = [...errors]
  for (const { specifier, line, col } of imports) {
    const platform = PLATFORMS.find((candidate) => specifier.startsWith(candidate.prefix))
    if (platform === undefined || segments.includes(platform.folder)) continue
    findings.push({
      file,
      line,
      col,
      rule: 'platform-import',
      message: `"${specifier}" is imported only under a '${platform.folder}/' folder (DIST spec §5.1); use ${replacementFor(platform, specifier)}, or move this file under '${platform.folder}/'`,
    })
  }
  return findings
}
