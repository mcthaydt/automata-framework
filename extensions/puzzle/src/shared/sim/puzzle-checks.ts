// The references a puzzle def makes, checked when content compiles, each at its path: items it uses,
// gives, takes, tests or starts with must be in `items`; a noise at a hotspot must name one in `hotspots`; a `{ call }`
// must be one the game declares; and an effect owned by another extension needs that extension registered.
import type { Effect, PuzzleDef } from './puzzle.schema'
import type { Cond } from './value.schema'

/**
 * What the content checks need to know about the game: the `call` names it declares and the
 * extensions it registers.
 */
export interface PuzzleCheckOptions {
  /** The `{ call }` names the game declares (its `calls` option). */
  readonly calls: readonly string[]
  /** The extensions the game registers, by name. */
  readonly extensions: readonly string[]
}

type Path = (string | number)[]
type Report = (path: Path, message: string) => void

/** The extension each cross-extension effect needs; `exit` is the game's own Flow. */
const NEEDS: readonly (readonly [keyof Effect | string, string])[] = [
  ['cutscene', 'cutscenes'],
  ['dialogue', 'narrative'],
  ['noise', 'systems'],
]

const itemsOf = (c: Cond): string[] =>
  'has' in c ? [c.has] : 'not' in c ? itemsOf(c.not) : 'any' in c ? c.any.flatMap(itemsOf) : []

export function checkPuzzle(def: PuzzleDef, options: PuzzleCheckOptions, report: Report): void {
  const items = new Set(def.items)
  const item = (name: string, path: Path): void => {
    if (!items.has(name)) report(path, `no item "${name}" in items`)
  }
  const conds = (list: readonly Cond[] | undefined, path: Path): void =>
    list?.forEach((c, i) => {
      for (const name of itemsOf(c)) item(name, [...path, i])
    })
  def.entry.forEach((entry, e) => {
    entry.items.forEach((name, i) => {
      item(name, ['entry', e, 'items', i])
    })
  })
  conds(def.goal, ['goal'])
  def.actions.forEach((action, a) => {
    const at: Path = ['actions', a]
    if (typeof action.use === 'string') item(action.use, [...at, 'use'])
    else
      action.use?.forEach((name, i) => {
        item(name, [...at, 'use', i])
      })
    conds(action.when, [...at, 'when'])
    action.then.forEach((effect, f) => {
      checkEffect(def, effect, [...at, 'then', f], options, item, report)
    })
  })
}

function checkEffect(
  def: PuzzleDef,
  e: Effect,
  path: Path,
  options: PuzzleCheckOptions,
  item: (name: string, path: Path) => void,
  report: Report,
): void {
  for (const [key, extension] of NEEDS)
    if (key in e && !options.extensions.includes(extension)) {
      report(path, `a ${key} effect needs the ${extension} extension`)
      return
    }
  if ('give' in e) item(e.give, [...path, 'give'])
  else if ('take' in e) item(e.take, [...path, 'take'])
  else if ('noise' in e && typeof e.noise.at === 'string' && def.hotspots[e.noise.at] === undefined)
    report([...path, 'noise', 'at'], `no hotspot "${e.noise.at}" in hotspots`)
  else if ('call' in e && !options.calls.includes(e.call))
    report([...path, 'call'], `the game declares no call "${e.call}"`)
}
