// The furniture, characters and lamps an `af-sector/2` level places, as things (Levels 3D spec §5, §7). They are not
// `entities`: the level keeps them in `props`, `cast` and `lamps`, each placed by `at` (`[x, z]`, with a height as a
// third value) and turned by `angle`, and carries more (`with`, `pose`, `to`, a lamp's light) that nothing here shows.
// So they have their own reading and writing: a place is read and written by this file, every other member of it rides
// as it was written, and the definitions they stand under are made from the game's content, read only.
//
// Definition ids: `prop.<use>` for furniture from the game's library, `kind.<kind>` for a place made straight by a
// generator, `cast.<who>` for a character and `lamp.<kind>` for a lamp. None can be written in a file (an id has no "."),
// which is how an entity is told from a placed thing. (Not ":": a selection id is split on ":" and "/".)

import type { AfSector2File, CastPlace, LampPlace, PropPlace } from '@automata/3d/level'
import { LAMP_KINDS } from '@automata/3d/world-content'
import type { FieldDef } from '@automata/editor/kit/fields'
import { fileTitle } from '@automata/editor/suite'
import { sameJson } from '../../edit/json-values'
import type { ThingDef, ThingGroup } from '../../things/thing-def.schema'
import type { Thing } from '../../things/things'
import type { GameLibrary } from '../game-library'
import { swatchHex } from '../materials'
import { noThing, ThingAccessError } from '../thing-access'

type ListName = 'props' | 'cast' | 'lamps'
type Placed = PropPlace | CastPlace | LampPlace

const PREFIXES = { 'prop.': 'props', 'kind.': 'props', 'cast.': 'cast', 'lamp.': 'lamps' } as const

/** The list a definition's things are in, or nothing when the definition is a plain entity's. */
function listOf(def: string): ListName | undefined {
  for (const [prefix, list] of Object.entries(PREFIXES)) if (def.startsWith(prefix)) return list as ListName
  return undefined
}

/** Whether a definition id is one of the placed kinds. */
export const isPlacedDefinition = (def: string): boolean => listOf(def) !== undefined

/** The name a placed definition is for: `crate` of `prop.crate`. */
const nameOf = (def: string): string => def.slice(def.indexOf('.') + 1)

/** The one value a person turns. Degrees clockwise from east, as the level writes it. */
const ANGLE: FieldDef = { id: 'angle', type: 'float', label: 'Turn', min: -360, max: 360, step: 15 }

/** What a box of furniture is drawn as when the game says nothing of its size, and for a name the game lacks. */
const PLAIN_SIZE: readonly [number, number, number] = [0.5, 0.5, 0.5]
/** A character is about as tall as a person and as wide as a door post. */
const CHARACTER_SIZE: readonly [number, number, number] = [0.5, 1.7, 0.5]

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** A prop's footprint from its record: a `size`, else a cylinder's radius and height, else a plain box. */
function sizeOf(record: Readonly<Record<string, unknown>> | undefined): readonly [number, number, number] {
  const size = record?.size
  if (Array.isArray(size) && size.length === 3 && size.every(isNumber))
    return size as unknown as readonly [number, number, number]
  const { radius, height } = record ?? {}
  if (isNumber(radius) && isNumber(height)) return [2 * radius, height, 2 * radius]
  return PLAIN_SIZE
}

/** An id's start for a new thing named `name`: `crate-` for `crate`, `lamp-pendant-` for `lamp.pendant`. */
const idBaseOf = (name: string): string => `${name.replaceAll(/[^a-z0-9_-]/gi, '-').toLowerCase()}-`

function furniture(name: string, library: GameLibrary, def: string): ThingDef {
  const record = library.props.get(name)
  const swatch = record?.swatch
  const color = typeof swatch === 'string' ? swatchHex(library, swatch) : undefined
  return {
    id: def,
    label: fileTitle(name),
    ...(color === undefined ? {} : { color }),
    fields: [ANGLE],
    shape: 'box',
    size: sizeOf(record),
    readOnly: true,
    group: 'furniture',
    idBase: idBaseOf(name),
  }
}

const character = (who: string): ThingDef => ({
  id: `cast.${who}`,
  label: fileTitle(who),
  fields: [ANGLE],
  shape: 'box',
  size: CHARACTER_SIZE,
  readOnly: true,
  group: 'characters',
  idBase: idBaseOf(who),
})

const lamp = (kind: string): ThingDef => ({
  id: `lamp.${kind}`,
  label: `${fileTitle(kind)} lamp`,
  fields: [],
  shape: 'point',
  sit: 'free',
  readOnly: true,
  group: 'lamps',
  idBase: idBaseOf(kind),
})

const propDef = (place: PropPlace): string | undefined =>
  place.use !== undefined ? `prop.${place.use}` : place.kind !== undefined ? `kind.${place.kind}` : undefined

/**
 * The definitions the level's placed things stand under: every piece of furniture and every character the game has (so
 * the palette offers them), then any the level names that the game lacks (so they still open, drawn plain), then the
 * lamp kit's kinds and any in use. Each once, in that order.
 */
export function placedDefinitions(level: AfSector2File, library: GameLibrary): ThingDef[] {
  const out = new Map<string, ThingDef>()
  const add = (def: ThingDef): void => {
    if (!out.has(def.id)) out.set(def.id, def)
  }
  for (const name of library.props.keys()) add(furniture(name, library, `prop.${name}`))
  for (const place of level.props ?? []) {
    const def = propDef(place)
    if (def !== undefined) add(furniture(nameOf(def), library, def))
  }
  for (const who of library.figures) add(character(who))
  for (const place of level.cast ?? []) add(character(place.who))
  // Every lamp the kit has, so a lamp can be placed in a room that has none (a game with no library offers only the
  // file's own names); then any kind in use the kit lacks.
  if (library.found) for (const kind of Object.keys(LAMP_KINDS)) add(lamp(kind))
  for (const place of level.lamps ?? []) add(lamp(place.kind))
  return [...out.values()]
}

const heightOf = (at: readonly number[]): number | undefined => (at.length >= 3 ? at[2] : undefined)

function thingOf(def: string, place: Placed): Thing {
  const [x = 0, z = 0] = place.at
  const y = heightOf(place.at)
  const angle = 'angle' in place ? place.angle : undefined
  return {
    def,
    id: place.id,
    x,
    z,
    ...(y === undefined ? {} : { y }),
    values: angle === undefined ? {} : { angle },
  }
}

/** The level's placed things, furniture first, then characters, then lamps. */
export function placedThings(level: AfSector2File): Thing[] {
  return [
    ...(level.props ?? []).flatMap((place) => {
      const def = propDef(place)
      return def === undefined ? [] : [thingOf(def, place)]
    }),
    ...(level.cast ?? []).map((place) => thingOf(`cast.${place.who}`, place)),
    ...(level.lamps ?? []).map((place) => thingOf(`lamp.${place.kind}`, place)),
  ]
}

/** Every id the three lists use. */
export const placedIds = (level: AfSector2File): string[] =>
  [...(level.props ?? []), ...(level.cast ?? []), ...(level.lamps ?? [])].map((place) => place.id)

const listIn = (level: AfSector2File, list: ListName): readonly Placed[] => level[list] ?? []

/** The index of the placed thing `def`/`id` in its list. */
function indexOf(level: AfSector2File, list: ListName, def: string, id: string): number {
  const at = listIn(level, list).findIndex((place) => place.id === id && defOf(list, place) === def)
  if (at < 0) throw noThing(def, id)
  return at
}

function defOf(list: ListName, place: Placed): string | undefined {
  if (list === 'props') return propDef(place as PropPlace)
  return list === 'cast' ? `cast.${(place as CastPlace).who}` : `lamp.${(place as LampPlace).kind}`
}

/** `[x, z]`, with the height as a third value when there is one. */
const atOf = (thing: Thing, kept?: number): number[] => {
  const y = thing.y ?? kept
  return y === undefined ? [thing.x, thing.z] : [thing.x, thing.z, y]
}

const angleOf = (thing: Thing): number | undefined => {
  const angle = thing.values.angle
  return typeof angle === 'number' ? angle : undefined
}

/** A new place: its identity, where it is, and its turn when it has one. */
function created(thing: Thing, list: ListName): Placed {
  const name = nameOf(thing.def)
  const angle = angleOf(thing)
  const turn = angle === undefined ? {} : { angle }
  if (list === 'lamps') return { id: thing.id, kind: name, at: atOf(thing) }
  if (list === 'cast') return { id: thing.id, who: name, at: atOf(thing), ...turn }
  return {
    id: thing.id,
    ...(thing.def.startsWith('kind.') ? { kind: name } : { use: name }),
    at: atOf(thing),
    ...turn,
  }
}

/**
 * `old` carrying the place and turn of `thing`, its other members as they were and in their places; the very object when
 * nothing differs. A turn the thing no longer has is dropped; a new one goes after `at`.
 */
function placedAgain(old: Placed, thing: Thing): Placed {
  const at = atOf(thing, heightOf(old.at))
  const angle = angleOf(thing)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(old)) {
    if (key === 'at') {
      out.at = sameJson(value, at) ? value : at
      if (angle !== undefined && !('angle' in old)) out.angle = angle
    } else if (key === 'angle') {
      if (angle !== undefined) out.angle = sameJson(value, angle) ? value : angle
    } else out[key] = value
  }
  return sameJson(out, old) ? old : (out as unknown as Placed)
}

function listOrThrow(def: string): ListName {
  const list = listOf(def)
  if (list === undefined) throw new ThingAccessError(`${def} is not something the level places`)
  return list
}

/** How the three lists are read and written, by definition. */
export const placedAccess = {
  add(level: AfSector2File, thing: Thing): AfSector2File {
    const list = listOrThrow(thing.def)
    return { ...level, [list]: [...listIn(level, list), created(thing, list)] }
  },

  replace(level: AfSector2File, def: string, id: string, thing: Thing): AfSector2File {
    const list = listOrThrow(def)
    const places = listIn(level, list)
    const at = indexOf(level, list, def, id)
    const old = places[at] as Placed
    const next = placedAgain(old, thing)
    return next === old
      ? level
      : { ...level, [list]: places.map((each, index) => (index === at ? next : each)) }
  },

  remove(level: AfSector2File, def: string, id: string): AfSector2File {
    const list = listOrThrow(def)
    const at = indexOf(level, list, def, id)
    return { ...level, [list]: listIn(level, list).filter((_, index) => index !== at) }
  },
}

/** The sentence for editing what comes from the game: "Crate comes from the game's furniture, so it can't be changed here." */
export function readOnlyReason(def: ThingDef): string {
  const group: ThingGroup = def.group ?? 'furniture'
  return `${def.label ?? def.id} comes from the game's ${group}, so it can't be changed here.`
}
