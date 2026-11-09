// The interpreter's pure half, from the adventure source's `createPuzzle`: whether a condition holds,
// whether an action's `use` matches what the verb holds, and the first action that matches. Facts are read through a
// lookup, so a game's mapped fields (`facts` option) and the `held` and `code` verb facts read the same way.
import type { Action, PuzzleDef } from './puzzle.schema'
import type { Cond, Value } from './value.schema'

/**
 * What the player did, as the interpreter reads it: where it is aimed, the item held, a pair of
 * items, a typed code or a floor point.
 */
export interface Verb {
  readonly at: string
  readonly held?: string | undefined
  readonly pair?: readonly [string, string] | undefined
  readonly code?: string | undefined
  readonly point?: { readonly x: number; readonly z: number } | undefined
}

/** What a condition reads: a fact by name and whether an item is carried. */
export interface Reader {
  fact(name: string): Value | undefined
  has(item: string): boolean
}

/** `held` and `code` are facts of the verb itself; every other fact is the reader's. */
const factOf = (reader: Reader, verb: Verb, name: string): Value | undefined =>
  name === 'held' ? (verb.held ?? '') : name === 'code' ? (verb.code ?? '') : reader.fact(name)

/**
 * Whether a condition holds for this reader and verb. `held` and `code` are facts of the verb
 * itself.
 */
export function holds(reader: Reader, verb: Verb, c: Cond): boolean {
  if ('has' in c) return reader.has(c.has)
  if ('not' in c) return !holds(reader, verb, c.not)
  if ('any' in c) return c.any.some((x) => holds(reader, verb, x))
  const v = factOf(reader, verb, c.fact)
  if (c.is !== undefined && v !== c.is) return false
  if (c.atLeast !== undefined && !(typeof v === 'number' && v >= c.atLeast)) return false
  if (c.atMost !== undefined && !(typeof v === 'number' && v <= c.atMost)) return false
  return true
}

/** A pair matches in either order; a single `use` is the first of a pair, or the held item. */
export function uses(action: Action, verb: Verb): boolean {
  const { use } = action
  if (use === undefined) return true
  if (typeof use !== 'string') {
    const pair = verb.pair
    return (
      !!pair && ((use[0] === pair[0] && use[1] === pair[1]) || (use[0] === pair[1] && use[1] === pair[0]))
    )
  }
  return use === (verb.pair ? verb.pair[0] : verb.held)
}

/** The first action, in content order, aimed where the verb is, using what it holds, whose conditions all hold. */
export const match = (def: PuzzleDef, reader: Reader, verb: Verb): Action | undefined =>
  def.actions.find(
    (a) => a.at === verb.at && uses(a, verb) && (a.when ?? []).every((c) => holds(reader, verb, c)),
  )

/** The fallback line for a verb that matched nothing: per hotspot, then per verb kind, then `*` (codes have no `*`). */
export function fallbackLine(def: PuzzleDef, verb: Verb): string | undefined {
  const { fallback } = def
  if (verb.at === 'code') return fallback.code
  if (verb.at === 'floor' || verb.at === 'combine') return fallback[verb.at] ?? fallback['*']
  return fallback[verb.at] ?? fallback['*']
}
