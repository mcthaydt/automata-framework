import { parseSync } from 'oxc-parser'
import type { CheckFinding } from './check-report.ts'

// What the bundle scans (`no-eval`, `data-urls`) share: oxc-parser's ESTree AST of one built file, read as syntax.

export type Node = { type: string; start: number; [key: string]: unknown }

export const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

/** Names that reach the global object in a browser bundle. */
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(['window', 'globalThis', 'self'])

export const unwrap = (node: Node): Node =>
  node.type === 'ParenthesizedExpression' ? unwrap(node.expression as Node) : node

/** `eval`, `window.eval` and `(0, eval)` read as `eval`; any other callee as undefined. */
export function globalName(callee: Node): string | undefined {
  const node = unwrap(callee)
  if (node.type === 'Identifier') return node.name as string
  if (node.type === 'SequenceExpression') {
    const expressions = node.expressions as Node[]
    const last = expressions[expressions.length - 1]
    return last === undefined ? undefined : globalName(last)
  }
  if (node.type === 'MemberExpression') {
    const object = unwrap(node.object as Node)
    if (object.type !== 'Identifier' || !GLOBAL_OBJECTS.has(object.name as string)) return undefined
    return staticKey(node)
  }
  return undefined
}

function staticKey(member: Node): string | undefined {
  const property = member.property as Node
  if (!member.computed) return property.name as string
  return stringValue(property)
}

/** A string literal or a template literal with no substitutions; undefined for anything else. */
export function stringValue(node: Node): string | undefined {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0) {
    return ((node.quasis as { value: { cooked: string | null } }[])[0]?.value.cooked ?? undefined) as
      | string
      | undefined
  }
  return undefined
}

function lineIndex(code: string): (offset: number) => { line: number; col: number } {
  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  return (offset) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((lineStarts[mid] as number) <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, col: offset - (lineStarts[lo] as number) + 1 }
  }
}

export type ParsedBundle =
  | { readonly program: Node; readonly at: (offset: number) => { line: number; col: number } }
  | { readonly parseError: CheckFinding }

/** Parses one built file as a module. A file that does not parse is a `parse-error` finding, never a pass. */
export function parseBundle(file: string, code: string): ParsedBundle {
  const parsed = parseSync(file, code, { sourceType: 'module', lang: 'js' })
  if (parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message).join('; ')
    return {
      parseError: {
        file,
        line: 1,
        col: 1,
        rule: 'parse-error',
        message: `cannot scan this bundle: ${message}`,
      },
    }
  }
  return { program: parsed.program as unknown as Node, at: lineIndex(code) }
}
