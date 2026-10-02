import { basename } from 'node:path'
import { parseSync } from 'oxc-parser'

// Naming discipline (A0+A1 spec §3.3): kebab-case file names, and role suffixes that match what the file
// exports, in both directions. Replaces automata-template's S_/C_/M_ prefixes.

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
])

/** define* factory -> the role suffix its exported results require. */
const DEFINE_ROLE: Readonly<Record<string, string>> = {
  defineComponent: 'component',
  defineSystem: 'system',
  defineCommand: 'command',
  defineEvent: 'event',
  defineResource: 'resource',
  definePlugin: 'plugin',
}
const FACTORY_FOR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DEFINE_ROLE).map(([fn, role]) => [role, fn]),
)

const NAME_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.([a-z]+))?\.ts$/

type Node = { type: string; [k: string]: unknown }

/** Factory names of every `export const X = defineY(...)` / `export default defineY(...)` in the file. */
function exportedFactories(program: Node): string[] {
  const out: string[] = []
  const factoryOf = (init: unknown): string | undefined => {
    const call = init as Node | null
    if (call?.type !== 'CallExpression') return undefined
    const callee = call.callee as Node & { name?: string }
    return callee.type === 'Identifier' && callee.name && DEFINE_ROLE[callee.name] ? callee.name : undefined
  }
  for (const stmt of program.body as Node[]) {
    if (stmt.type === 'ExportNamedDeclaration') {
      const decl = stmt.declaration as Node | null
      if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations as Node[]) {
          const f = factoryOf(d.init)
          if (f) out.push(f)
        }
      }
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      const f = factoryOf(stmt.declaration)
      if (f) out.push(f)
    }
  }
  return out
}

export function checkFile(file: string, code: string): StyleFinding[] {
  const name = basename(file)
  const finding = (rule: StyleRule, message: string): StyleFinding[] => [{ file, rule, message }]
  if (name === 'index.ts') return []
  const m = NAME_RE.exec(name)
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
    if (first)
      return finding(
        'role-suffix',
        `exports a ${first} result, so the file must be named *.${DEFINE_ROLE[first]}.ts`,
      )
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
