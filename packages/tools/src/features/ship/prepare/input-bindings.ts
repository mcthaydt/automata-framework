// The inputs check (M4.1 follow-up): `runtime.inputs` against the game's input map (M4 spec §4.13, I-g). The map
// cannot be loaded under plain Node, so it is read from the `keys(command, bindings, options)` calls in the game's
// sources, as the board and orientation checks read theirs, and turned into the bindings `inputsProblems` takes: that
// function stays the one owner of the rule. `keys()` decides the two facts the rule needs from its arguments: each
// key binding is a touch button unless `options.touch` is `false`, `options.pad` binds pad buttons, and
// `options.gestures` binds touch gestures.
//
// Anything that is not written as a literal can only add a device, never remove one: it counts as touchable and binds
// no pad. So a problem this reports is always real, and one it cannot see is left to the game's own test.

import { readFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import { inputsProblems, type ShipInputBindings } from '../targets/ruken/check-inputs.ts'
import {
  isNode,
  isShippedSource,
  keyOf,
  type Node,
  position,
  sources,
  stringLiteral,
} from './source-reader.ts'

/** `keys` lives in the umbrella and the game package; a `keys` from anywhere else is not the input map. */
const AUTOMATA_MODULE = /^@mcthaydt\/automata(?:-game)?$/

/** Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped. */
export const isInputsSource: (file: string) => boolean = isShippedSource

/** The `runtime.inputs` a `ship.config.ts` declares, with the position of its opening bracket. */
export interface DeclaredInputs {
  readonly inputs: string[]
  readonly line: number
  readonly col: number
}

/** The local names `keys` is imported under from the umbrella or the game package. */
function keysNamesIn(program: Node): Set<string> {
  const names = new Set<string>()
  for (const statement of program.body as unknown[]) {
    if (!isNode(statement) || statement.type !== 'ImportDeclaration') continue
    if (!stringLiteral(statement.source) || !AUTOMATA_MODULE.test(statement.source.value)) continue
    for (const specifier of statement.specifiers as unknown[]) {
      if (!isNode(specifier) || specifier.type !== 'ImportSpecifier') continue
      const imported = specifier.imported
      const importedName = isNode(imported) ? (imported.name ?? imported.value) : undefined
      if (importedName === 'keys' && isNode(specifier.local)) names.add(specifier.local.name as string)
    }
  }
  return names
}

/** The properties of an object literal; `undefined` when it is not one or has a spread, which may add any. */
function writtenProperties(value: unknown): Node[] | undefined {
  if (!isNode(value) || value.type !== 'ObjectExpression') return undefined
  const properties = (value.properties as unknown[]).filter(isNode)
  return properties.some((property) => property.type !== 'Property') ? undefined : properties
}

const property = (properties: readonly Node[], name: string): Node | undefined =>
  properties.find((entry) => keyOf(entry) === name)

/** What one `keys(...)` call binds, as the entries `inputsProblems` reads; `where` names the call. */
function bindingsOf(call: Node, where: string): ShipInputBindings {
  const [, bindings, options] = call.arguments as unknown[]
  const keyCount = writtenProperties(bindings)?.length
  const written = options === undefined ? [] : writtenProperties(options)
  // options that cannot be read may carry `touch`, `pad` and `gestures` of their own: touchable, no pad proved.
  if (written === undefined) return { [`${where} keys`]: { touch: true } }

  const touch = property(written, 'touch')?.value
  const touchOption = touch === undefined ? true : isNode(touch) && touch.value === false ? false : true
  const result: { [action: string]: { pad?: number[]; touch?: boolean; gesture?: string[] } } = {
    [`${where} keys`]: { touch: touchOption && keyCount !== 0 },
  }

  const pad = writtenProperties(property(written, 'pad')?.value)
  if (pad !== undefined && pad.length > 0)
    result[`${where} pad`] = { pad: pad.map((entry) => Number(keyOf(entry)) || 0) }

  const gestures = property(written, 'gestures')
  if (gestures !== undefined) {
    const named = writtenProperties(gestures.value)
    if (named === undefined) result[`${where} gestures`] = { gesture: ['(unreadable)'] }
    else if (named.length > 0)
      result[`${where} gestures`] = { gesture: named.map((entry) => String(keyOf(entry))) }
  }
  return result
}

/**
 * What the `keys()` calls in one source file bind, one `<file>:<line>:<col> keys` entry per call (and `pad` and
 * `gestures` entries where it binds them); empty when the file has no call; `undefined` when it does not parse (its
 * typecheck already fails, and a half-read tree could name a device that is not there).
 */
export function keysBindingsIn(file: string, code: string): ShipInputBindings | undefined {
  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return undefined
  const names = keysNamesIn(parsed.program as unknown as Node)
  if (names.size === 0) return {}
  const found: ShipInputBindings = {}
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    const callee = node.callee
    if (
      node.type === 'CallExpression' &&
      isNode(callee) &&
      callee.type === 'Identifier' &&
      names.has(callee.name as string)
    ) {
      const { line, col } = position(code, callee.start as number)
      Object.assign(found, bindingsOf(node, `${file}:${line}:${col}`))
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(parsed.program)
  return found
}

/**
 * The `runtime.inputs` a `ship.config.ts` declares, read from the source as written (`automata check` reads files, it
 * does not run them). `undefined` when the file does not parse or `runtime.inputs` is not an array of string literals.
 */
export function declaredInputsIn(code: string): DeclaredInputs | undefined {
  const parsed = parseSync('ship.config.ts', code)
  if (parsed.errors.length > 0) return undefined
  let declared: DeclaredInputs | undefined
  const visit = (node: unknown): void => {
    if (declared !== undefined) return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    if (node.type === 'Property' && keyOf(node) === 'runtime') {
      const inputs = property(writtenProperties(node.value) ?? [], 'inputs')?.value
      if (isNode(inputs) && inputs.type === 'ArrayExpression') {
        const elements = inputs.elements as unknown[]
        if (elements.every(stringLiteral))
          declared = {
            inputs: elements.map((element) => (element as Node).value as string),
            ...position(code, inputs.start as number),
          }
      }
      return
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(parsed.program)
  return declared
}

/** What every `keys()` call in a game's sources binds, together; empty when the game has none. */
function keysBindingsOf(gameDir: string): ShipInputBindings {
  const bindings: { [action: string]: ShipInputBindings[string] } = {}
  for (const path of sources(gameDir)) {
    const file = relative(gameDir, path).split(sep).join('/')
    if (isInputsSource(file)) Object.assign(bindings, keysBindingsIn(file, readFileSync(path, 'utf8')))
  }
  return bindings
}

/**
 * Each disagreement between `inputs` (a config's `runtime.inputs`) and what the `keys()` calls in a game's sources
 * bind, in `inputsProblems`' words; empty when they agree or the game has no `keys()` call to compare.
 */
export function findInputsProblems(gameDir: string, inputs: readonly string[]): string[] {
  const bindings = keysBindingsOf(gameDir)
  return Object.keys(bindings).length === 0 ? [] : inputsProblems(inputs, bindings)
}
