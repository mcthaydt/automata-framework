// Last Light's camera zones as things (ED3D.7c, ED3D spec §4.7): a zone stands at its `look` point, floating at the
// look's height, which is where Last Light's own plan draws a zone's marker (editor/src/client/levels.ts, 92e6704),
// and its `area` is four sides, `x0`, `z0`, `x1` and `z1`, an open side having no value. Every shipped zone has an open
// side, so a zone has no middle to stand at. Its other members (the camera's `x`, `hysteresis`, `depthFollow`, `enter`
// and anything the schema does not know) are no fields: they are carried through untouched, in the file's order.
//
// An edit keeps the `ids` check's zone rules, in its sentences: it is refused with the first zone sentence the new zones
// have that the old ones did not, so the first zone stays the rest of the map, a later one keeps an area, and a removal
// cannot make a later zone the first. The size rule is the shipped editor's (editor/src/server/level-edits.ts `areaOf`).
import type { FieldDef, FieldValues } from '@mcthaydt/automata-editor/kit/fields'
import { type ZoneFault, zoneFaults } from '../checks/last-light/ids'
import type { ThingDef } from '../entities/thing-def.schema'
import type { RawEntry, Thing } from '../entities/things'
import type { Area, Blockout, ZoneSpec } from '../format/blockout.schema'
import { noThing, ThingAccessError } from './thing-access'

/** The four sides of a zone's area, as the definition's `area` names them. */
const SIDES = ['x0', 'z0', 'x1', 'z1'] as const

/** How narrow an area may be along an axis with both sides set: the shipped editor's rule. */
const NARROWEST = 0.5

const side = (id: string): FieldDef => ({ id, type: 'float' })

export const zoneDefinition: ThingDef = {
  id: 'zone',
  shape: 'point',
  sit: 'free',
  area: SIDES,
  fields: [
    // Last Light's follow camera by default (FOLLOW_DISTANCE, `follow: 1`), and the distances `cameraOf` allows. The
    // range of `follow` is the `ids` check's to say, so the field has none and the sentence is said once.
    { id: 'distance', type: 'float', min: 6, max: 30, default: 14 },
    { id: 'follow', type: 'float', default: 1 },
    ...SIDES.map(side),
  ],
}

/** The members of a zone that are its place or its fields; every other member is carried through. */
const OWNED = new Set(['id', 'look', 'distance', 'follow', 'area'])

/** A zone as a raw instance of the definition: its look point, its distance, its follow and the sides it has. */
export function zoneEntry(zone: ZoneSpec, index: number): RawEntry {
  const [x0, x1] = zone.area?.x ?? [null, null]
  const [z0, z1] = zone.area?.z ?? [null, null]
  const sides = Object.fromEntries(
    (
      [
        ['x0', x0],
        ['z0', z0],
        ['x1', x1],
        ['z1', z1],
      ] as const
    ).filter(([, value]) => value !== null),
  )
  const [x, y, z] = zone.look
  return {
    path: ['zones', index],
    value: {
      def: 'zone',
      id: zone.id,
      x,
      y,
      z,
      distance: zone.distance,
      ...(zone.follow === undefined ? {} : { follow: zone.follow }),
      ...sides,
    },
  }
}

const sideOf = (values: FieldValues, id: string): number | null => {
  const value = values[id]
  return typeof value === 'number' ? value : null
}

/** The area the four sides make, or nothing when every side is open. Throws for a side too close to its opposite. */
function areaOf(values: FieldValues): Area | undefined {
  const area: {
    x?: [number | null, number | null]
    z?: [number | null, number | null]
  } = {}
  for (const axis of ['x', 'z'] as const) {
    const [low, high] = [sideOf(values, `${axis}0`), sideOf(values, `${axis}1`)]
    if (low !== null && high !== null && high - low < NARROWEST)
      throw new ThingAccessError(`the area is at least ${NARROWEST} m along ${axis}`)
    if (low !== null || high !== null) area[axis] = [low, high]
  }
  return area.x === undefined && area.z === undefined ? undefined : area
}

/** `next` with `old`'s value where the two are equal as data, so an unchanged member stays the very same value. */
const kept = <T>(old: T | undefined, next: T): T =>
  JSON.stringify(old) === JSON.stringify(next) ? (old as T) : next

/**
 * The zone `thing` describes: `old`'s members in `old`'s order with its place, distance, follow and area replaced (an
 * absent one dropped, a new one appended), and every value that is not a field written as a member, as 7a does.
 */
function zoneOf(thing: Thing, old: ZoneSpec | undefined): ZoneSpec {
  const fields = new Set<string>(zoneDefinition.fields.map((field) => field.id))
  const area = areaOf(thing.values)
  const owned: Record<string, unknown> = {
    id: thing.id,
    look: kept(old?.look, [thing.x, thing.y ?? 0, thing.z]),
    distance: thing.values.distance,
    follow: thing.values.follow,
    area: kept(old?.area, area),
  }
  const others = Object.entries(thing.values).filter(([id]) => !fields.has(id))
  const merged: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(old ?? {}))
    if (!OWNED.has(key)) merged[key] = value
    else if (owned[key] !== undefined) merged[key] = owned[key]
  for (const [key, value] of [...Object.entries(owned), ...others])
    if (value !== undefined && !Object.hasOwn(merged, key)) merged[key] = value
  return merged as unknown as ZoneSpec
}

/**
 * A zone fault as the rule and the zone: a level with no zone and one whose first zone has an area break the same rule
 * differently, and a follow of 1.5 set to 2 breaks the same rule no worse.
 */
const broken = (fault: ZoneFault): string => `${fault.rule}@${fault.zone ?? ''}`

/** The level with `zones`, unless that makes a zone break a rule of the `ids` check it did not break. */
function withZones(blockout: Blockout, zones: readonly ZoneSpec[]): Blockout {
  const before = new Set(zoneFaults(blockout.zones).map(broken))
  const worse = zoneFaults(zones).find((fault) => !before.has(broken(fault)))
  if (worse !== undefined) throw new ThingAccessError(worse.problem.message)
  return { ...blockout, zones }
}

const indexOf = (blockout: Blockout, id: string): number => {
  const at = blockout.zones.findIndex((zone) => zone.id === id)
  if (at < 0) throw noThing('zone', id)
  return at
}

export const zoneAccess = {
  takenIds: (blockout: Blockout): string[] => blockout.zones.map((zone) => zone.id),

  add: (blockout: Blockout, thing: Thing): Blockout =>
    withZones(blockout, [...blockout.zones, zoneOf(thing, undefined)]),

  replace(blockout: Blockout, id: string, thing: Thing): Blockout {
    const at = indexOf(blockout, id)
    const old = blockout.zones[at] as ZoneSpec
    const next = zoneOf(thing, old)
    const same =
      Object.keys(next).length === Object.keys(old).length &&
      Object.entries(old).every(([key, value]) => (next as unknown as Record<string, unknown>)[key] === value)
    if (same) return blockout
    return withZones(
      blockout,
      blockout.zones.map((zone, index) => (index === at ? next : zone)),
    )
  },

  remove(blockout: Blockout, id: string): Blockout {
    indexOf(blockout, id)
    return withZones(
      blockout,
      blockout.zones.filter((zone) => zone.id !== id),
    )
  },

  /** The rooms and the openings whose camera zone it is. */
  references: (blockout: Blockout, id: string): string[] => [
    ...blockout.rooms.filter((room) => room.zone === id).map((room) => `room ${room.id}: zone ${id}`),
    ...(blockout.openings ?? [])
      .filter((opening) => opening.zone === id)
      .map((opening) => `opening ${opening.id}: zone ${id}`),
  ],
}
