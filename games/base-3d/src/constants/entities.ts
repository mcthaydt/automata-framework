// The dungeon pieces' entity definitions (DESIGN.md §10, GAME-3D.1f): af-sector/1's entity shape (`{ def, id, x, z,
// y?, ...fields }`, ED3D §4.7) with one strict schema a definition, so a level ED3D writes and a hand-written area
// read the same. Metres and degrees as authored; `compileArea` turns them into fixed point. The area's spawn, foes,
// pits and exits are still its own lists until GAME-3D.1i moves the areas into af-sector files.
import { z } from 'zod'

/** What a chest can hold (§10): an item by its `ItemCode` name, a key, the map, the compass, a heart piece, or `embers:N`. */
export const CHEST_CONTENTS = [
  'sling',
  'bombs',
  'hookchain',
  'small-key',
  'boss-key',
  'map',
  'compass',
  'heart-piece',
] as const

const base = {
  def: z.string(),
  id: z.string().min(1),
  x: z.number(),
  z: z.number(),
  y: z.number().optional(),
}
/** A box entity's size in plan, centred on its `x` and `z`; a 1 m cell unless it says otherwise. */
const box = { width: z.number().positive().default(1), depth: z.number().positive().default(1) }
const ref = z.string().min(1)
const refs = z.array(ref).default([])

/** Each definition's schema, by its name. A field naming another entity or a room is checked by `compileArea`. */
export const ENTITY_DEFS = {
  door: z.strictObject({
    ...base,
    ...box,
    lock: z.enum(['none', 'small-key', 'boss-key', 'clear', 'switch']),
    /** The switch that opens it, for `lock: 'switch'`. */
    switch: ref.optional(),
  }),
  switch: z.strictObject({
    ...base,
    ...box,
    kind: z.enum(['plate', 'eye', 'lever']),
    latch: z.boolean().default(false),
    targets: refs,
  }),
  block: z.strictObject({ ...base, ...box }),
  'one-way': z.strictObject({
    ...base,
    ...box,
    /** The room (by view id) it lets Wick through from. */ from: ref,
  }),
  chest: z.strictObject({
    ...base,
    ...box,
    contents: z.union([z.enum(CHEST_CONTENTS), z.string().regex(/^embers:[1-9][0-9]{0,2}$/)]),
    /** The entity whose being on (or open) shows the chest; shown from the start without one. */
    hidden: ref.optional(),
  }),
  pot: z.strictObject({ ...base, ...box, /** The drop table it rolls when broken. */ drop: ref }),
  cracked: z.strictObject({ ...base, ...box }),
  'hook-post': z.strictObject({ ...base }),
  'sling-target': z.strictObject({ ...base, height: z.number().min(0.5).max(3), targets: refs }),
  'ledge-drop': z.strictObject({ ...base, ...box, /** The room (by view id) it drops Wick to. */ to: ref }),
  npc: z.strictObject({ ...base, figure: ref, /** The message key prefix of its lines. */ lines: ref }),
  shop: z.strictObject({ ...base, ...box, /** The stock table it sells from. */ stock: ref }),
  entry: z.strictObject({ ...base, facing: z.number().default(0), portal: ref.optional() }),
} as const

export type EntityDefName = keyof typeof ENTITY_DEFS
/** An entity as authored, any definition. */
export type EntitySource = {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
} & {
  readonly [field: string]: unknown
}
