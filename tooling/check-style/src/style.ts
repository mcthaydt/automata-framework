import { basename } from 'node:path'
import { parseSync } from 'oxc-parser'

// Naming discipline (A0+A1 spec §3.3): kebab-case file names, and role suffixes that match what the file
// exports, in both directions. Replaces automata-template's S_/C_/M_ prefixes.
// Note: namespace-qualified (ns.defineSystem) and aliased (import { defineSystem as ds }) factories are not recognized.
// Call define* directly.

export type StyleRule = 'file-name' | 'role-suffix' | 'role-mismatch' | 'role-missing' | 'parse-error'

export interface StyleFinding {
  readonly file: string
  readonly rule: StyleRule
  readonly message: string
}

export const ROLES: ReadonlySet<string> = new Set([
  'component',
  'system',
  'command',
  'event',
  'resource',
  'plugin',
  'manager',
  'schema',
  'migration',
  'content',
  'generator',
  'extension',
])

/** define* factory -> the role suffix its exported results require. */
const DEFINE_ROLE: Readonly<Record<string, string>> = {
  defineComponent: 'component',
  defineSystem: 'system',
  defineCommand: 'command',
  defineEvent: 'event',
  defineResource: 'resource',
  definePlugin: 'plugin',
  defineContentSchema: 'content',
  defineContentGenerator: 'generator',
  defineExtension: 'extension',
}
const FACTORY_FOR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DEFINE_ROLE).map(([fn, role]) => [role, fn]),
)

const NAME_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.([a-z]+))?\.ts$/

type Node = { type: string; [k: string]: unknown }

/** Strip type wrappers: as const, satisfies T, non-null (!), parenthesized. */
function unwrap(node: Node | null): Node | null {
  if (!node) return null
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'ParenthesizedExpression'
  ) {
    return unwrap((node.expression as Node) || null)
  }
  return node
}

/** Check if a node (after unwrap) is a call to a known define* factory. */
function factoryOf(node: Node | null): string | undefined {
  const call = unwrap(node)
  if (call?.type !== 'CallExpression') return undefined
  const callee = call.callee as Node & { name?: string }
  if (callee.type !== 'Identifier' || !callee.name) return undefined
  return Object.hasOwn(DEFINE_ROLE, callee.name) ? callee.name : undefined
}

/** Factory names of every `export const X = defineY(...)` / `export default defineY(...)` / `const X = defineY(...); export { X }` in the file. */
function exportedFactories(program: Node): string[] {
  const out: string[] = []
  const constMap = new Map<string, string>() // name -> factory

  // First pass: build map of top-level const declarations
  for (const stmt of program.body as Node[]) {
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations as Node[]) {
        const name = (d.id as Node & { name?: string }).name
        if (name) {
          const f = factoryOf(d.init as unknown as Node)
          if (f) constMap.set(name, f)
        }
      }
    }
  }

  // Second pass: find exports
  for (const stmt of program.body as Node[]) {
    if (stmt.type === 'ExportNamedDeclaration') {
      const decl = stmt.declaration as Node | null
      // export const X = defineY(...)
      if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations as Node[]) {
          const f = factoryOf(d.init as unknown as Node)
          if (f) out.push(f)
        }
      }
      // export { X, Y } - resolve via constMap
      const specifiers = stmt.specifiers as Node[] | undefined
      if (specifiers) {
        for (const spec of specifiers) {
          const localName = (spec.local as Node & { name?: string }).name
          if (localName && constMap.has(localName)) {
            out.push(constMap.get(localName) as string)
          }
        }
      }
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      // export default X where X is an identifier
      const decl = stmt.declaration as Node | null
      if (decl?.type === 'Identifier') {
        const name = (decl as Node & { name?: string }).name
        if (name && constMap.has(name)) {
          out.push(constMap.get(name) as string)
        }
      } else {
        // export default defineY(...)
        const f = factoryOf(decl)
        if (f) out.push(f)
      }
    }
  }
  return out
}

export function checkFile(file: string, code: string): StyleFinding[] {
  const name = basename(file)
  const finding = (rule: StyleRule, message: string): StyleFinding[] => [{ file, rule, message }]
  if (name === 'index.ts') return []
  // Svelte 5 rune modules must be named *.svelte.ts; that marker is Svelte's, not one of our roles.
  const m = NAME_RE.exec(name.replace(/\.svelte\.ts$/, '.ts'))
  if (!m)
    return finding('file-name', `"${name}" must be kebab-case, optionally with a role suffix (name.role.ts)`)
  const role = m[2]
  if (role !== undefined && !ROLES.has(role))
    return finding('file-name', `"${name}" has unknown role "${role}"`)

  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return finding('parse-error', parsed.errors.map((e) => e.message).join('; '))
  const factories = exportedFactories(parsed.program as unknown as Node)

  if (role === undefined) {
    const first = factories[0]
    if (first) {
      const suffix = Object.hasOwn(DEFINE_ROLE, first)
        ? DEFINE_ROLE[first as keyof typeof DEFINE_ROLE]
        : 'unknown'
      return finding('role-suffix', `exports a ${first} result, so the file must be named *.${suffix}.ts`)
    }
    return []
  }
  const factory = FACTORY_FOR[role]
  if (factory === undefined) return [] // manager, schema, migration: no define* factory to match
  if (factories.some((f) => f !== factory)) {
    return finding('role-mismatch', `a *.${role}.ts file may only export ${factory} results`)
  }
  if (!factories.includes(factory))
    return finding('role-missing', `a *.${role}.ts file must export at least one ${factory} result`)
  return []
}
