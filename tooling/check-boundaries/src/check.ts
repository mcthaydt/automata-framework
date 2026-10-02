import { parseSync } from 'oxc-parser'

// Determinism boundary for packages/sim (A0+A1 spec §3.3 and §11). Works on the AST, so comments, strings,
// property keys and type positions never produce false findings.

export type Rule =
  | 'banned-global'
  | 'math-member'
  | 'pow-operator'
  | 'key-enumeration'
  | 'import'
  | 'parse-error'

export interface Finding {
  readonly file: string
  readonly line: number
  readonly col: number
  readonly rule: Rule
  readonly message: string
}

/** No I/O, no wall clock, no host APIs (law 5). */
export const BANNED_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'self',
  'document',
  'navigator',
  'location',
  'history',
  'console',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'crypto',
  'process',
  'globalThis',
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
  'setImmediate',
  'eval',
  'Function',
])

/** Math members that IEEE-754 / ECMAScript define exactly (S5 verdict). Everything else is engine-dependent. */
export const MATH_ALLOWED: ReadonlySet<string> = new Set([
  'sqrt',
  'fround',
  'round',
  'floor',
  'ceil',
  'trunc',
  'abs',
  'min',
  'max',
  'sign',
  'imul',
])

const KEY_ENUMERATION = new Set(['keys', 'values', 'entries', 'getOwnPropertyNames', 'getOwnPropertySymbols'])

export const IMPORT_ALLOWED: ReadonlySet<string> = new Set([
  'koota',
  'zod',
  '@dimforge/rapier2d-deterministic-compat',
  '@dimforge/rapier3d-deterministic-compat',
])

// Keys whose subtree is type-only: skipped entirely.
const TYPE_KEYS = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
])
const TYPE_NODES = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction'])
// Identifier positions that name something rather than reference it.
const BINDING_KEYS = new Set(['id', 'params', 'local', 'imported', 'exported', 'label'])

type Node = { type: string; start: number; [k: string]: unknown }
const isNode = (v: unknown): v is Node =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'

function isReference(key: string, parent: Node | null): boolean {
  if (!parent) return true
  if (BINDING_KEYS.has(key)) return false
  if (parent.type === 'CatchClause' && key === 'param') return false
  if (key === 'property' && parent.type === 'MemberExpression' && !parent.computed) return false
  if (key === 'key' && !parent.computed) return false // object/class property and method names
  return true
}

const importOk = (source: string): boolean =>
  source.startsWith('./') || source.startsWith('../') || IMPORT_ALLOWED.has(source)

export function checkSource(file: string, code: string): Finding[] {
  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  const at = (offset: number) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((lineStarts[mid] as number) <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, col: offset - (lineStarts[lo] as number) + 1 }
  }
  const findings: Finding[] = []
  const report = (node: Node, rule: Rule, message: string) =>
    findings.push({ file, ...at(node.start), rule, message })

  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) {
    findings.push({
      file,
      line: 1,
      col: 1,
      rule: 'parse-error',
      message: parsed.errors.map((e) => e.message).join('; '),
    })
    return findings
  }
  const enumerationExempt = file.replaceAll('\\', '/').endsWith('/util/sorted.ts')

  const visit = (node: Node, key: string, parent: Node | null): void => {
    if (TYPE_NODES.has(node.type)) return
    if (
      node.type === 'TSModuleDeclaration' &&
      (node.declare === true || typeof (node.id as { value?: unknown })?.value === 'string')
    )
      return
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration': {
        const source = (node.source as { value?: string } | null)?.value
        if (
          source !== undefined &&
          node.importKind !== 'type' &&
          node.exportKind !== 'type' &&
          !importOk(source)
        ) {
          report(node, 'import', `import of "${source}" is not allowed in the sim`)
        }
        break
      }
      case 'ImportExpression': {
        const src = node.source as Node & { value?: unknown }
        if (src.type !== 'Literal' || typeof src.value !== 'string' || !importOk(src.value)) {
          report(node, 'import', 'dynamic import must be a string literal from the allowlist')
        }
        break
      }
      case 'BinaryExpression':
      case 'AssignmentExpression':
        if (node.operator === '**' || node.operator === '**=') {
          report(
            node,
            'pow-operator',
            `"${node.operator}" is engine-dependent; use pow from automata-sim/math`,
          )
        }
        break
      case 'ForInStatement':
        if (!enumerationExempt)
          report(node, 'key-enumeration', 'for...in order is engine-dependent; use sortedKeys()')
        break
      case 'MemberExpression': {
        const obj = node.object as Node & { name?: string }
        const prop = node.property as Node & { name?: string; value?: unknown }
        const name = node.computed ? (typeof prop.value === 'string' ? prop.value : undefined) : prop.name
        if (
          obj.type === 'Identifier' &&
          obj.name === 'Math' &&
          (name === undefined || !MATH_ALLOWED.has(name))
        ) {
          report(
            node,
            'math-member',
            `Math.${name ?? '[computed]'} is not bit-exact across engines; use automata-sim/math`,
          )
        }
        if (
          obj.type === 'Identifier' &&
          (obj.name === 'Object' || obj.name === 'Reflect') &&
          !enumerationExempt
        ) {
          if (name !== undefined && (KEY_ENUMERATION.has(name) || name === 'ownKeys')) {
            report(
              node,
              'key-enumeration',
              `${obj.name}.${name} order is engine-dependent; use sortedKeys()/sortedEntries()`,
            )
          }
        }
        break
      }
      case 'Identifier': {
        const name = node.name as string
        if (!isReference(key, parent)) break
        if (BANNED_GLOBALS.has(name))
          report(node, 'banned-global', `"${name}" is not available in the sim (no I/O, no clock)`)
        if (name === 'Math' && !(parent?.type === 'MemberExpression' && key === 'object')) {
          report(node, 'math-member', 'Math may only be used as Math.<allowed member>')
        }
        if (
          (name === 'Object' || name === 'Reflect') &&
          !enumerationExempt &&
          !(parent?.type === 'MemberExpression' && key === 'object')
        ) {
          report(node, 'key-enumeration', `${name} may only be used as ${name}.<member>`)
        }
        break
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' || TYPE_KEYS.has(k)) continue
      if (Array.isArray(v)) {
        for (const child of v) if (isNode(child)) visit(child, k, node)
      } else if (isNode(v)) visit(v, k, node)
    }
  }
  visit(parsed.program as unknown as Node, 'program', null)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
