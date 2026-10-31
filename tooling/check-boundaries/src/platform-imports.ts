import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'
import { type AstNode, isNode } from './ast.ts'
import type { Finding } from './check.ts'

// The `platform-imports` check (DIST spec §5.1, ADR 0006): a distribution target's platform packages are imported
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
        '@mcthaydt/automata-host (the host contract: Hosting, Capability, ErrorCode and the payloads)',
      '@ruken/sdk-host': '@mcthaydt/automata-testing/host (FakeHosting)',
      '@ruken/manifest': '@mcthaydt/automata-content/game-config (the game config)',
      '@ruken/cli': 'automata-ship publish --target ruken',
    },
  },
  {
    prefix: '@tauri-apps/',
    folder: 'tauri',
    replacements: { '@tauri-apps/': "@mcthaydt/automata-host/target under the 'tauri' build" },
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

/** The script blocks of a Svelte component, each with the line it starts on (the code is parsed as TypeScript). */
function scriptsOf(file: string, code: string): { code: string; firstLine: number }[] {
  if (!file.endsWith('.svelte')) return [{ code, firstLine: 1 }]
  const blocks: { code: string; firstLine: number }[] = []
  for (const match of code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const bodyStart = (match.index ?? 0) + match[0].indexOf('>') + 1
    blocks.push({ code: match[1] ?? '', firstLine: code.slice(0, bodyStart).split('\n').length })
  }
  return blocks
}

/** The specifiers of every import, re-export and string-literal dynamic import in `program`, with their nodes. */
function importsOf(program: AstNode): { specifier: string; node: AstNode }[] {
  const found: { specifier: string; node: AstNode }[] = []
  const visit = (node: AstNode): void => {
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration' ||
      node.type === 'ImportExpression'
    ) {
      const value = (node.source as { value?: unknown } | null | undefined)?.value
      if (typeof value === 'string') found.push({ specifier: value, node })
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) for (const item of child) if (isNode(item)) visit(item)
      if (isNode(child)) visit(child)
    }
  }
  visit(program)
  return found
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
  const findings: Finding[] = []
  for (const script of scriptsOf(file, code)) {
    const parsed = parseSync(file.endsWith('.svelte') ? `${file}.ts` : file, script.code)
    if (parsed.errors.length > 0) {
      const message = parsed.errors.map((error) => error.message).join('; ')
      findings.push({ file, line: script.firstLine, col: 1, rule: 'parse-error', message })
      continue
    }
    for (const { specifier, node } of importsOf(parsed.program as unknown as AstNode)) {
      const platform = PLATFORMS.find((candidate) => specifier.startsWith(candidate.prefix))
      if (platform === undefined || segments.includes(platform.folder)) continue
      const before = script.code.slice(0, node.start).split('\n')
      findings.push({
        file,
        line: script.firstLine + before.length - 1,
        col: (before.at(-1)?.length ?? 0) + 1,
        rule: 'platform-import',
        message: `"${specifier}" is imported only under a '${platform.folder}/' folder (DIST spec §5.1); use ${replacementFor(platform, specifier)}, or move this file under '${platform.folder}/'`,
      })
    }
  }
  return findings
}
