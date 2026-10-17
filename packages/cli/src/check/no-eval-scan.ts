import { parseSync } from 'oxc-parser'
import type { CheckFinding } from './check-report.ts'
import { ALLOWED_EVAL_CALLS } from './no-eval-allowlist.ts'

// The `no-eval` scan (DX spec §3.6): finds the call forms Ruken's CSP (no 'unsafe-eval') would block in a built
// bundle. It works on the AST, so strings, comments, `x.eval(…)` and object methods named `eval` (Effect's fiber
// primitives have them) are never findings. It reads syntax only: an alias such as `const F = Function; new F(…)`
// is not seen. The `csp` step, which runs the build under the real policy, is the check for those.

type Node = { type: string; start: number; [key: string]: unknown }

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

/** Names that reach the global object in a browser bundle. */
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(['window', 'globalThis', 'self'])
const TIMERS: ReadonlySet<string> = new Set(['setTimeout', 'setInterval'])
const FUNCTION_BOUNDARIES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

const unwrap = (node: Node): Node =>
  node.type === 'ParenthesizedExpression' ? unwrap(node.expression as Node) : node

/** `eval`, `window.eval` and `(0, eval)` read as `eval`; any other callee as undefined. */
function globalName(callee: Node): string | undefined {
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
function stringValue(node: Node): string | undefined {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0) {
    return ((node.quasis as { value: { cooked: string | null } }[])[0]?.value.cooked ?? undefined) as
      | string
      | undefined
  }
  return undefined
}

/** A timer's first argument is code when it is any string: a literal, a template or a concatenation with one. */
function isStringExpression(node: Node | undefined): boolean {
  if (node === undefined) return false
  const inner = unwrap(node)
  if (inner.type === 'Literal') return typeof inner.value === 'string'
  if (inner.type === 'TemplateLiteral') return true
  if (inner.type === 'BinaryExpression' && inner.operator === '+') {
    return isStringExpression(inner.left as Node) || isStringExpression(inner.right as Node)
  }
  return false
}

/** Whether a `Function(...)` call is one of the documented vendor calls (no-eval-allowlist.ts). */
function isAllowedVendorCall(args: readonly Node[], insideTry: boolean): boolean {
  return ALLOWED_EVAL_CALLS.some((entry) => {
    if (entry.insideTry && !insideTry) return false
    if (args.length !== entry.params.length + 1) return false
    if (!entry.params.every((param, i) => stringValue(args[i] as Node) === param)) return false
    return typeof entry.body !== 'string' || stringValue(args[entry.params.length] as Node) === entry.body
  })
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

export function scanForEval(file: string, code: string): CheckFinding[] {
  const at = lineIndex(code)
  const parsed = parseSync(file, code, { sourceType: 'module', lang: 'js' })
  if (parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message).join('; ')
    return [{ file, line: 1, col: 1, rule: 'parse-error', message: `cannot scan this bundle: ${message}` }]
  }

  const findings: CheckFinding[] = []
  const report = (node: Node, rule: string, message: string) =>
    findings.push({ file, ...at(node.start), rule, message })

  const check = (node: Node, insideTry: boolean) => {
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return
    const name = globalName(node.callee as Node)
    const args = node.arguments as Node[]
    if (name === 'eval' && node.type === 'CallExpression') {
      report(node, 'eval', 'eval() is blocked by Ruken’s CSP (no unsafe-eval)')
    } else if (name === 'Function' && !isAllowedVendorCall(args, insideTry)) {
      report(node, 'function-constructor', 'Function(…) compiles code at runtime; Ruken’s CSP blocks it')
    } else if (name !== undefined && TIMERS.has(name) && isStringExpression(args[0])) {
      report(node, 'string-timer', `${name} with a string runs it as code; pass a function`)
    }
  }

  // `insideTry` is true in a try block's own code, and resets inside a nested function, which may run later.
  const visit = (node: Node, insideTry: boolean): void => {
    check(node, insideTry)
    const inFunction = FUNCTION_BOUNDARIES.has(node.type)
    for (const key of Object.keys(node)) {
      const child = node[key]
      const childInsideTry = inFunction ? false : node.type === 'TryStatement' ? key === 'block' : insideTry
      if (Array.isArray(child)) {
        for (const item of child) if (isNode(item)) visit(item, childInsideTry)
      } else if (isNode(child)) visit(child, childInsideTry)
    }
  }
  visit(parsed.program as unknown as Node, false)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
