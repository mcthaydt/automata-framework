// The orientation check (M4.7 follow-up): the orientation a game plays in must be the `runtime.orientation` its
// ship config sends Ruken, or the rotate hint and the host's frame disagree. `defineGame({ orientation })` says it
// (`any` when the property is left out, as `GameSpec` defaults it). Like the board check, the game's own sources are
// read, not run, so a failure names the call site; only string literals are checked.

import { readFileSync } from 'node:fs'
import { basename, relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import {
  isGameSource,
  isNode,
  keyOf,
  type Node,
  nameOf,
  position,
  sources,
  stringLiteral,
} from './source-reader.ts'

/** An orientation a `defineGame` call plays in, at the literal's opening quote (or at the call, when it is left out). */
export interface PlayedOrientation {
  readonly orientation: string
  readonly line: number
  readonly col: number
}

/** A game that plays in an orientation its ship config does not declare. */
export interface OrientationMismatchFound extends PlayedOrientation {
  /** The ship config's `runtime.orientation`. */
  readonly declared: string
  /** Relative to the game folder, with forward slashes. */
  readonly file: string
}

const TESTS = /\.(?:test|spec)\./

/** Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped. */
export const isOrientationSource = (file: string): boolean =>
  isGameSource(file) && !TESTS.test(basename(file))

const propertiesOf = (object: Node): Node[] =>
  (object.properties as unknown[]).filter(
    (entry): entry is Node => isNode(entry) && entry.type === 'Property',
  )

/** The `orientation` a `defineGame({ … })` call plays in; undefined when it cannot be read as a literal. */
function orientationOf(call: Node): { value: string; start: number } | undefined {
  const [spec] = call.arguments as unknown[]
  if (!isNode(spec) || spec.type !== 'ObjectExpression') return undefined
  const written = (spec.properties as unknown[]).filter(isNode)
  // A spread may carry an orientation this cannot see.
  if (written.some((entry) => entry.type === 'SpreadElement')) return undefined
  const orientation = propertiesOf(spec).find((property) => keyOf(property) === 'orientation')
  if (orientation === undefined) return { value: 'any', start: (call.callee as Node).start as number }
  return stringLiteral(orientation.value)
    ? { value: orientation.value.value, start: orientation.value.start }
    : undefined
}

/**
 * The orientations the `defineGame` calls in one source file play in, in source order; `undefined` when the file
 * does not parse (its typecheck already fails, and a half-read tree could name an orientation that is not there).
 */
export function gameOrientationsIn(file: string, code: string): PlayedOrientation[] | undefined {
  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return undefined
  const found: { value: string; start: number }[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    if (node.type === 'CallExpression' && nameOf(node.callee) === 'defineGame') {
      const played = orientationOf(node)
      if (played !== undefined) found.push(played)
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(parsed.program)
  return found
    .sort((a, b) => a.start - b.start)
    .map((played) => ({ orientation: played.value, ...position(code, played.start) }))
}

/**
 * The `runtime.orientation` a `ship.config.ts` declares, read from the source as written (`automata check` reads
 * files, it does not run them). `undefined` when the file does not parse or `runtime.orientation` is not written as
 * a literal, so the check can say it could not read it.
 */
export function declaredOrientationIn(code: string): string | undefined {
  const parsed = parseSync('ship.config.ts', code)
  if (parsed.errors.length > 0) return undefined
  let declared: string | undefined
  const visit = (node: unknown): void => {
    if (declared !== undefined) return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    if (
      node.type === 'Property' &&
      keyOf(node) === 'runtime' &&
      isNode(node.value) &&
      node.value.type === 'ObjectExpression'
    ) {
      const orientation = propertiesOf(node.value).find((property) => keyOf(property) === 'orientation')
      if (orientation !== undefined && stringLiteral(orientation.value)) declared = orientation.value.value
      return
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(parsed.program)
  return declared
}

/** Every `defineGame` in a game's sources that plays in an orientation other than `declared` (its config's). */
export function findOrientationMismatches(gameDir: string, declared: string): OrientationMismatchFound[] {
  return sources(gameDir).flatMap((path) => {
    const file = relative(gameDir, path).split(sep).join('/')
    if (!isOrientationSource(file)) return []
    return (gameOrientationsIn(path, readFileSync(path, 'utf8')) ?? [])
      .filter((played) => played.orientation !== declared)
      .map((played) => ({ ...played, declared, file }))
  })
}
