import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseSync } from 'oxc-parser'
import { type AstNode, isNode } from './ast.ts'
import type { Finding } from './check.ts'

// One reader of a file's imports, shared by the platform, feature and browser-only checks. Only real imports count
// (`import`, `export … from`, `import()`), read from the AST: a package named in a string, a comment or a template is
// not an import.

export interface ImportRef {
  readonly specifier: string
  /** 1-based, in the whole file (a Svelte script block is offset to its place in the component). */
  readonly line: number
  readonly col: number
  /** `import type …` and `export type … from`: the line is erased at build time and brings no code. */
  readonly typeOnly: boolean
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

/** Every import, re-export and string-literal dynamic import under `node`, in source order of discovery. */
function collect(node: AstNode, found: AstNode[]): void {
  if (
    node.type === 'ImportDeclaration' ||
    node.type === 'ExportNamedDeclaration' ||
    node.type === 'ExportAllDeclaration' ||
    node.type === 'ImportExpression'
  ) {
    if (typeof (node.source as { value?: unknown } | null | undefined)?.value === 'string') found.push(node)
  }
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) for (const item of child) if (isNode(item)) collect(item, found)
    if (isNode(child)) collect(child, found)
  }
}

export interface ReadImports {
  readonly imports: ImportRef[]
  /** Parse errors, as findings; a file that does not parse has no imports to judge. */
  readonly errors: Finding[]
}

/** The imports of one source file (or the script blocks of a Svelte component), with where each one is. */
export function readImports(file: string, code: string): ReadImports {
  const imports: ImportRef[] = []
  const errors: Finding[] = []
  for (const script of scriptsOf(file, code)) {
    const parsed = parseSync(file.endsWith('.svelte') ? `${file}.ts` : file, script.code)
    if (parsed.errors.length > 0) {
      const message = parsed.errors.map((error) => error.message).join('; ')
      errors.push({ file, line: script.firstLine, col: 1, rule: 'parse-error', message })
      continue
    }
    const nodes: AstNode[] = []
    collect(parsed.program as unknown as AstNode, nodes)
    for (const node of nodes) {
      const before = script.code.slice(0, node.start).split('\n')
      imports.push({
        specifier: (node.source as { value: string }).value,
        line: script.firstLine + before.length - 1,
        col: (before.at(-1)?.length ?? 0) + 1,
        typeOnly: node.importKind === 'type' || node.exportKind === 'type',
      })
    }
  }
  return { imports, errors }
}

/**
 * The source file a relative specifier names, or undefined when none exists. Tries the specifier as written (this
 * repository writes the extension: `./tiles.ts`), then with `.ts`, then as a folder's `index.ts`. The path keeps the
 * form of `fromFile` (relative stays relative), so a finding reads the same as the others.
 */
export function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = join(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return undefined
}
