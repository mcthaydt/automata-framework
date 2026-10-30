import { dirname, join, relative, resolve } from 'node:path'
import { parseSync } from 'oxc-parser'
import { isNode, type AstNode as Node, staticMemberName } from './ast.ts'
import { GAME_SIM_SET_NAMES } from './files.ts'
import { kootaBindings, kootaSoaProblem } from './koota-soa.ts'
import { simEntryVerdict } from './sim-entries.ts'

// Determinism boundary for packages/sim (A0+A1 spec §3.3 and §11), plus one CSP rule, `koota-soa`
// (koota-soa.ts). Works on the AST, so comments, strings, property keys and type positions never produce false
// findings.

export type Rule =
  | 'banned-global'
  | 'banned-member'
  | 'math-member'
  | 'pow-operator'
  | 'key-enumeration'
  | 'locale'
  | 'import'
  | 'koota-soa'
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
  'Intl', // ICU data differs per engine and version
  'WeakRef', // observes garbage collection timing
  'FinalizationRegistry',
  'SharedArrayBuffer', // shared memory between threads
  'Atomics',
])

/**
 * Members that reach a banned global without naming it: `(() => {}).constructor` is `Function`, so
 * `.constructor('return Date.now()')` would run code hidden in a string.
 */
const BANNED_MEMBERS: ReadonlySet<string> = new Set(['constructor'])

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

/** Locale/ICU-dependent methods: checked on any receiver, since the receiver's type is unknown to the AST. */
const LOCALE_METHODS = new Set([
  'localeCompare',
  'toLocaleString',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'toLocaleDateString',
  'toLocaleTimeString',
])

export const IMPORT_ALLOWED: ReadonlySet<string> = new Set([
  'koota',
  'zod',
  '@dimforge/rapier2d-deterministic-compat',
  '@dimforge/rapier3d-deterministic-compat',
  // The sim's public entry points, for sim plugins in other packages (packages/physics). They are checked
  // sources themselves; deep imports into the sim's internals stay banned.
  '@mcthaydt/automata-sim',
  '@mcthaydt/automata-sim/hash',
  '@mcthaydt/automata-sim/math',
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

function isReference(key: string, parent: Node | null): boolean {
  if (!parent) return true
  if (BINDING_KEYS.has(key)) return false
  if (parent.type === 'CatchClause' && key === 'param') return false
  if (key === 'property' && parent.type === 'MemberExpression' && !parent.computed) return false
  if (key === 'key' && !parent.computed) return false // object/class property and method names
  return true
}

export interface CheckOptions {
  /** The source root being checked. When set, a relative import that resolves outside it is reported. */
  readonly root?: string
  /**
   * More import specifiers this root may use, by exact name: another sim folder's entry point that is checked
   * on its own (a demo's sim on its base's sim, `@af-examples/base-2d/sim`).
   */
  readonly allowImports?: readonly string[]
  /**
   * Inline mode (EX spec §4), for a one-file example: the file is a browser file, so only the sim inside it is
   * checked, which is every argument of a `defineSystem` or `definePlugin` call (the system bodies, the plugin's
   * setup). File-level code and imports are not checked. A helper the sim calls that is declared outside those
   * calls is not checked either; a sim that big belongs in a game's `sim/` folder, under the per-file check.
   * `koota-soa` is the exception: it checks every call in the file, because the CSP it guards covers the whole page
   * and components are defined at file level.
   */
  readonly inline?: boolean
  /**
   * A game laid out by role (GL spec §4.5): the resolved paths of its sim files. A relative value import from a sim
   * file must resolve to one of them; type-only imports stay free.
   */
  readonly simSet?: ReadonlySet<string>
}

/** The calls whose arguments are sim code in inline mode. */
const INLINE_SIM_CALLS: ReadonlySet<string> = new Set(['defineSystem', 'definePlugin'])

export function checkSource(file: string, code: string, options: CheckOptions = {}): Finding[] {
  /** Whether `source` may be imported; `detail` explains a refusal the extension's own declaration caused. */
  const importVerdict = (source: string): { ok: boolean; detail?: string } => {
    if (source.startsWith('./') || source.startsWith('../')) {
      if (options.simSet !== undefined) {
        const target = resolve(dirname(file), source)
        // TypeScript resolves `./x.ts`, `./x`, a NodeNext `./x.js` and a folder's `./x/index.ts` to the same file.
        const candidates = [target, `${target}.ts`, target.replace(/\.js$/, '.ts'), join(target, 'index.ts')]
        const inSim = candidates.some((path) => options.simSet?.has(path))
        return inSim
          ? { ok: true }
          : {
              ok: false,
              detail: `the sim imports ${source}, which is outside the sim (${GAME_SIM_SET_NAMES})`,
            }
      }
      if (options.root === undefined) return { ok: true }
      const target = relative(resolve(options.root), resolve(dirname(file), source))
      return { ok: !target.startsWith('..') }
    }
    if (IMPORT_ALLOWED.has(source) || (options.allowImports?.includes(source) ?? false)) return { ok: true }
    // An installed extension may declare sim entries of its own (P5-D2).
    const verdict = simEntryVerdict(file, source)
    return verdict.allowed
      ? { ok: true }
      : verdict.detail === undefined
        ? { ok: false }
        : { ok: false, detail: verdict.detail }
  }
  const importOk = (source: string): boolean => importVerdict(source).ok

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
  const koota = kootaBindings(parsed.program as unknown as Node)
  const checkKootaCall = (call: Node) => {
    const problem = kootaSoaProblem(call, koota)
    if (problem !== undefined) report(problem.node, 'koota-soa', problem.message)
  }

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
        if (source !== undefined && node.importKind !== 'type' && node.exportKind !== 'type') {
          const verdict = importVerdict(source)
          if (!verdict.ok)
            report(
              node,
              'import',
              `import of "${source}" is not allowed in the sim${verdict.detail === undefined ? '' : `: ${verdict.detail}`}`,
            )
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
      case 'CallExpression':
        checkKootaCall(node)
        break
      case 'ForInStatement':
        if (!enumerationExempt)
          report(node, 'key-enumeration', 'for...in order is engine-dependent; use sortedKeys()')
        break
      case 'MemberExpression': {
        const obj = node.object as Node & { name?: string }
        const name = staticMemberName(node)
        if (name !== undefined && BANNED_MEMBERS.has(name))
          report(node, 'banned-member', `".${name}" reaches Function; it is not allowed in the sim`)
        if (name !== undefined && LOCALE_METHODS.has(name))
          report(node, 'locale', `"${name}" is locale-dependent; compare/format explicitly`)
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
  const children = (node: Node): [string, Node][] => {
    const found: [string, Node][] = []
    for (const [k, v] of Object.entries(node)) {
      if (k === 'type' || TYPE_KEYS.has(k)) continue
      if (Array.isArray(v)) {
        for (const child of v) if (isNode(child)) found.push([k, child])
      } else if (isNode(v)) found.push([k, v])
    }
    return found
  }

  // Inline mode: walk without reporting until a sim call, then check its arguments with the full rules. Only
  // `koota-soa` is checked on the way.
  const findSim = (node: Node): void => {
    if (TYPE_NODES.has(node.type)) return
    if (node.type === 'CallExpression') {
      checkKootaCall(node)
      const callee = node.callee as Node & { name?: string }
      const name =
        callee.type === 'Identifier'
          ? callee.name
          : callee.type === 'MemberExpression'
            ? staticMemberName(callee)
            : undefined
      if (name !== undefined && INLINE_SIM_CALLS.has(name)) {
        for (const argument of node.arguments as unknown[])
          if (isNode(argument)) visit(argument, 'arguments', node)
        return
      }
    }
    for (const [, child] of children(node)) findSim(child)
  }

  if (options.inline === true) findSim(parsed.program as unknown as Node)
  else visit(parsed.program as unknown as Node, 'program', null)
  return findings.sort((a, b) => a.line - b.line || a.col - b.col)
}
