// How the editor's edits reach the things of a level, whatever format it is in (ED3D spec §4.1, §4.7): where a thing
// lives in the file, written back, so that an edit is written once. Reading stays `LevelProfile.entities`; a format
// keeps its own places (AF sector: one list of `{ def, id, x, z, ... }`; Last Light: a spawn, three lists and two
// records) inside its own access object, and nothing here names a Last Light concept. A thing is found by its
// definition and its id.
import type { Thing } from '../entities/things'

/** A level cannot hold what an edit wrote or took away, or has no such thing: a sentence for the person. */
export class ThingAccessError extends Error {
  override readonly name = 'ThingAccessError'
}

export interface ThingAccess<D> {
  /** Every id a new thing of `def` may not take. */
  takenIds(doc: D, def: string): readonly string[]
  /**
   * The level with `thing` added at the end of its list or record. Throws `ThingAccessError` for a thing the format
   * has no place for (Last Light's second spawn).
   */
  add(doc: D, thing: Thing): D
  /**
   * The level with the thing `def`/`id` carrying the place and values of `thing`, in its own place in the file, its
   * members in the order the file has them; the level itself when nothing differs. Throws `ThingAccessError` when the
   * level has no such thing.
   */
  replace(doc: D, def: string, id: string, thing: Thing): D
  /** The level without the thing. Throws `ThingAccessError` when there is none, or the format cannot do without it. */
  remove(doc: D, def: string, id: string): D
  /** What still names the thing, as sentences; empty when it can go. A thing's own ref to itself does not count. */
  references(doc: D, def: string, id: string): readonly string[]
}

export const noThing = (def: string, id: string): ThingAccessError => new ThingAccessError(`no ${def} ${id}`)

type Members = Readonly<Record<string, unknown>>

/** The members a thing writes beside its identity: `x`, `y` when it has one, `z`, then its field values. */
function written(thing: Thing): [string, unknown][] {
  return [
    ['x', thing.x],
    ...(thing.y === undefined ? [] : ([['y', thing.y]] as [string, unknown][])),
    ['z', thing.z],
    ...Object.entries(thing.values),
  ]
}

/**
 * A new thing's members: `identity` first (`def` and `id` for AF sector, `id` for a Last Light list, nothing for a
 * record entry), then `x`, `y` when there is one, `z`, and the values.
 */
export function newMembers(thing: Thing, identity: Members): Record<string, unknown> {
  return { ...identity, ...Object.fromEntries(written(thing)) }
}

/**
 * `old` with the place and values of `thing`: its own members in its own order, the identity untouched, `x`, `z` and
 * `y` and each field changed to what the thing says, a member the thing no longer has dropped, and a member it newly
 * has appended. The very object `old` when nothing differs, so a level that did not change is the same level.
 */
export function mergeMembers<T extends object>(old: T, thing: Thing, identity: Members): T {
  const now = new Map(written(thing))
  const merged: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(old)) {
    if (Object.hasOwn(identity, key)) merged[key] = value
    else if (now.has(key)) merged[key] = now.get(key)
  }
  for (const [key, value] of now) if (!Object.hasOwn(merged, key)) merged[key] = value
  const same =
    Object.keys(merged).length === Object.keys(old).length &&
    Object.entries(old).every(([key, value]) => JSON.stringify(merged[key]) === JSON.stringify(value))
  return same ? old : (merged as T)
}
