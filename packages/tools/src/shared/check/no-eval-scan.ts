import { globalName, isNode, type Node, parseBundle, stringValue, unwrap } from './bundle-ast.ts'
import type { CheckFinding } from './check-report.ts'
import { ALLOWED_EVAL_CALLS } from './no-eval-allowlist.ts'

// The `no-eval` scan: finds the call forms Ruken's CSP (no 'unsafe-eval') would block in a built
// bundle. It works on the AST, so strings, comments, `x.eval(…)` and object methods named `eval` (Effect's fiber
// primitives have them) are never findings. It reads syntax only: an alias such as `const F = Function; new F(…)`
// is not seen. The `csp` step, which runs the build under the real policy, is the check for those.

const TIMERS: ReadonlySet<string> = new Set(['setTimeout', 'setInterval'])
const FUNCTION_BOUNDARIES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

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

export function scanForEval(file: string, code: string): CheckFinding[] {
  const parsed = parseBundle(file, code)
  if ('parseError' in parsed) return [parsed.parseError]
  const { at } = parsed

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
  visit(parsed.program, false)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
