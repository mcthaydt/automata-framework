import { parseSync } from 'oxc-parser'
import {
  childrenOf,
  isNode,
  isReference,
  lineLocator,
  type AstNode as Node,
  staticMemberName,
  TYPE_NODES,
} from './ast.ts'
import { kootaBindings, kootaSoaProblem } from './koota-soa.ts'
import { type ImportScope, importVerdict } from './sim-imports.ts'
import { BANNED_GLOBALS, BANNED_MEMBERS, KEY_ENUMERATION, LOCALE_METHODS, MATH_ALLOWED } from './sim-rules.ts'

// Determinism boundary for packages/sim, so a replay hashes the same in every engine, plus one CSP rule, `koota-soa`
// (koota-soa.ts). Works on the AST, so comments, strings, property keys and type positions never produce false
// findings. The tables of what is banned are in `sim-rules.ts`.

export type Rule =
  | 'banned-global'
  | 'banned-member'
  | 'math-member'
  | 'pow-operator'
  | 'key-enumeration'
  | 'locale'
  | 'import'
  | 'koota-soa'
  | 'platform-import'
  | 'forbidden-import'
  | 'feature-import'
  | 'shared-import'
  | 'app-import'
  | 'entries-import'
  | 'entries-logic'
  | 'testing-import'
  | 'alias-in-src'
  | 'browser-import'
  | 'parse-error'

export interface Finding {
  readonly file: string
  readonly line: number
  readonly col: number
  readonly rule: Rule
  readonly message: string
}

export interface Finding {
  readonly file: string
  readonly line: number
  readonly col: number
  readonly rule: Rule
  readonly message: string
}

export interface CheckOptions extends ImportScope {
  /**
   * Inline mode, for a one-file example: the file is a browser file, so only the sim inside it is
   * checked, which is every argument of a `defineSystem` or `definePlugin` call (the system bodies, the plugin's
   * setup). File-level code and imports are not checked. A helper the sim calls that is declared outside those
   * calls is not checked either; a sim that big belongs in a game's `sim/` folder, under the per-file check.
   * `koota-soa` is the exception: it checks every call in the file, because the CSP it guards covers the whole page
   * and components are defined at file level.
   */
  readonly inline?: boolean
}

/** A rule's report: where it fired and why. */
type Report = (node: Node, rule: Rule, message: string) => void

/** The calls whose arguments are sim code in inline mode. */
const INLINE_SIM_CALLS: ReadonlySet<string> = new Set(['defineSystem', 'definePlugin'])

/** `import`, `export ... from` and `export *` of a value: the source must be on the list. */
function checkImportDeclaration(node: Node, file: string, options: CheckOptions, report: Report): void {
  const source = (node.source as { value?: string } | null)?.value
  if (source === undefined || node.importKind === 'type' || node.exportKind === 'type') return
  const verdict = importVerdict(file, source, options)
  if (!verdict.ok)
    report(
      node,
      'import',
      `import of "${source}" is not allowed in the sim${verdict.detail === undefined ? '' : `: ${verdict.detail}`}`,
    )
}

/** `import(...)`: the source must be a string literal on the list, since nothing else can be checked. */
function checkImportExpression(node: Node, file: string, options: CheckOptions, report: Report): void {
  const src = node.source as Node & { value?: unknown }
  if (
    src.type !== 'Literal' ||
    typeof src.value !== 'string' ||
    !importVerdict(file, src.value, options).ok
  ) {
    report(node, 'import', 'dynamic import must be a string literal from the allowlist')
  }
}

/** `a.b`: a member that reaches Function, a locale method, a `Math` member that is not bit-exact, or `Object.keys`. */
function checkMember(node: Node, enumerationExempt: boolean, report: Report): void {
  const obj = node.object as Node & { name?: string }
  const name = staticMemberName(node)
  if (name !== undefined && BANNED_MEMBERS.has(name))
    report(node, 'banned-member', `".${name}" reaches Function; it is not allowed in the sim`)
  if (name !== undefined && LOCALE_METHODS.has(name))
    report(node, 'locale', `"${name}" is locale-dependent; compare/format explicitly`)
  if (obj.type !== 'Identifier') return
  if (obj.name === 'Math' && (name === undefined || !MATH_ALLOWED.has(name))) {
    report(
      node,
      'math-member',
      `Math.${name ?? '[computed]'} is not bit-exact across engines; use automata-sim/math`,
    )
  }
  if ((obj.name === 'Object' || obj.name === 'Reflect') && !enumerationExempt) {
    if (name === undefined) {
      report(node, 'key-enumeration', `${obj.name}[...] needs a literal member name`)
    } else if (KEY_ENUMERATION.has(name) || name === 'ownKeys') {
      report(
        node,
        'key-enumeration',
        `${obj.name}.${name} order is engine-dependent; use sortedKeys()/sortedEntries()`,
      )
    }
  }
}

/** A name that reads a banned global, or `Math`, `Object` or `Reflect` used as something other than `X.<member>`. */
function checkIdentifier(
  node: Node,
  key: string,
  parent: Node | null,
  enumerationExempt: boolean,
  report: Report,
): void {
  const name = node.name as string
  if (!isReference(key, parent)) return
  const isMemberObject = parent?.type === 'MemberExpression' && key === 'object'
  if (BANNED_GLOBALS.has(name))
    report(node, 'banned-global', `"${name}" is not available in the sim (no I/O, no clock)`)
  if (name === 'Math' && !isMemberObject) {
    report(node, 'math-member', 'Math may only be used as Math.<allowed member>')
  }
  if ((name === 'Object' || name === 'Reflect') && !enumerationExempt && !isMemberObject) {
    report(node, 'key-enumeration', `${name} may only be used as ${name}.<member>`)
  }
}

/** What the per-node rules need to know about the file being checked. */
interface RuleContext {
  readonly file: string
  readonly options: CheckOptions
  /** `util/sorted.ts` is where `sortedKeys` itself enumerates keys. */
  readonly enumerationExempt: boolean
  readonly report: Report
  readonly checkKootaCall: (call: Node) => void
}

/** `declare module` and `declare global` hold types only. */
function isTypeOnlyModule(node: Node): boolean {
  return (
    node.type === 'TSModuleDeclaration' &&
    (node.declare === true || typeof (node.id as { value?: unknown })?.value === 'string')
  )
}

/** Applies the rules that look at this node alone (its children are visited separately). */
function checkNode(node: Node, key: string, parent: Node | null, rules: RuleContext): void {
  const { file, options, enumerationExempt, report } = rules
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
      checkImportDeclaration(node, file, options, report)
      break
    case 'ImportExpression':
      checkImportExpression(node, file, options, report)
      break
    case 'BinaryExpression':
    case 'AssignmentExpression':
      if (node.operator === '**' || node.operator === '**=') {
        report(node, 'pow-operator', `"${node.operator}" is engine-dependent; use pow from automata-sim/math`)
      }
      break
    case 'CallExpression':
      rules.checkKootaCall(node)
      break
    case 'ForInStatement':
      if (!enumerationExempt)
        report(node, 'key-enumeration', 'for...in order is engine-dependent; use sortedKeys()')
      break
    case 'MemberExpression':
      checkMember(node, enumerationExempt, report)
      break
    case 'Identifier':
      checkIdentifier(node, key, parent, enumerationExempt, report)
      break
  }
}

/** The name a call is made by: `f(...)` or `x.f(...)`. */
function calleeName(call: Node): string | undefined {
  const callee = call.callee as Node & { name?: string }
  if (callee.type === 'Identifier') return callee.name
  return callee.type === 'MemberExpression' ? staticMemberName(callee) : undefined
}

/** Checks one file's source and returns what it finds, in the order it reads. */
export function checkSource(file: string, code: string, options: CheckOptions = {}): Finding[] {
  const locate = lineLocator(code)
  const findings: Finding[] = []
  const report: Report = (node, rule, message) =>
    findings.push({ file, ...locate(node.start), rule, message })

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
  const program = parsed.program as unknown as Node
  const enumerationExempt = file.replaceAll('\\', '/').endsWith('/util/sorted.ts')
  const koota = kootaBindings(program)
  const checkKootaCall = (call: Node) => {
    const problem = kootaSoaProblem(call, koota)
    if (problem !== undefined) report(problem.node, 'koota-soa', problem.message)
  }

  const rules: RuleContext = { file, options, enumerationExempt, report, checkKootaCall }
  const visit = (node: Node, key: string, parent: Node | null): void => {
    if (TYPE_NODES.has(node.type) || isTypeOnlyModule(node)) return
    checkNode(node, key, parent, rules)
    for (const [childKey, child] of childrenOf(node)) visit(child, childKey, node)
  }

  // Inline mode: walk without reporting until a sim call, then check its arguments with the full rules. Only
  // `koota-soa` is checked on the way.
  const findSim = (node: Node): void => {
    if (TYPE_NODES.has(node.type)) return
    if (node.type === 'CallExpression') {
      checkKootaCall(node)
      const name = calleeName(node)
      if (name !== undefined && INLINE_SIM_CALLS.has(name)) {
        for (const argument of node.arguments as unknown[])
          if (isNode(argument)) visit(argument, 'arguments', node)
        return
      }
    }
    for (const [, child] of childrenOf(node)) findSim(child)
  }

  if (options.inline === true) findSim(program)
  else visit(program, 'program', null)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
