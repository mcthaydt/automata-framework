import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { actionsSchema } from '#src/shared/actors/actions.schema.ts'
import actions from '#src/shared/actors/library/actions.json'
import { hairSchema } from '#src/shared/hair/hair.schema.ts'
import hair from '#src/shared/hair/library/hair.json'
import times from '#src/shared/lighting/library/times.json'
import { timesSchema } from '#src/shared/lighting/times.schema.ts'
import { gaitsSchema } from '#src/shared/motion/gaits.schema.ts'
import gaits from '#src/shared/motion/library/gaits.json'
import poses from '#src/shared/motion/library/poses.json'
import seats from '#src/shared/motion/library/seats.json'
import { posesSchema } from '#src/shared/motion/poses.schema.ts'
import { seatsSchema } from '#src/shared/motion/seats.schema.ts'
import { itemsSchema } from '#src/shared/outfit/items.schema.ts'
import items from '#src/shared/outfit/library/items.json'
import swatches from '#src/shared/outfit/library/swatches.json'
import { swatchesSchema } from '#src/shared/outfit/swatches.schema.ts'

/** Adds a key no schema knows to the first entry (to the first entry of `actions`, the file's `actions` map): a
 * misspelt key is the mistake a hand-edited library makes, and a strict schema must name it. */
const withStray = (raw: object, where: string[]) => {
  const copy = structuredClone(raw) as Record<string, unknown>
  let at = copy
  for (const key of where) at = at[key] as Record<string, unknown>
  const first = Object.keys(at)[0]
  at[first] = { ...(at[first] as object), colur: 1 }
  return copy
}

const LIBRARIES: { name: string; raw: object; schema: ZodType; where: string[] }[] = [
  { name: 'actions', raw: actions, schema: actionsSchema, where: ['actions'] },
  { name: 'hair', raw: hair, schema: hairSchema, where: [] },
  { name: 'times', raw: times, schema: timesSchema, where: [] },
  { name: 'gaits', raw: gaits, schema: gaitsSchema, where: [] },
  { name: 'poses', raw: poses, schema: posesSchema, where: [] },
  { name: 'seats', raw: seats, schema: seatsSchema, where: [] },
  { name: 'items', raw: items, schema: itemsSchema, where: [] },
  { name: 'swatches', raw: swatches, schema: swatchesSchema, where: [] },
]

describe('the eight libraries are checked when they load', () => {
  it.each(LIBRARIES)('$name comes out exactly as written', ({ raw, schema }) => {
    const parsed = schema.parse(raw)
    expect(parsed).toEqual(raw)
    // The same keys in the same order: the order a library is written in seeds the painter.
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(raw))
  })
  it.each(LIBRARIES)('$name with a misspelt key is refused, naming the key', ({ raw, schema, where }) => {
    expect(() => schema.parse(withStray(raw, where))).toThrow(/Unrecognized key.*colur/s)
  })
  describe('hair pieces', () => {
    it('refuses a misspelt key inside a piece of a kind the painter draws', () => {
      const style = structuredClone(hair.bob) as unknown as {
        pieces: Record<string, Record<string, unknown>>[]
      }
      const piece = style.pieces.find((p) => 'fall' in p) as Record<string, Record<string, unknown>>
      piece.fall.lenght = 1
      expect(() => hairSchema.parse({ bob: style })).toThrow(/Unrecognized key.*lenght/s)
    })
    it('lets a piece of a kind a fork registers through', () => {
      const style = { about: 'x', finish: 'sleek', pieces: [{ plume: { height: 3 } }] }
      expect(hairSchema.parse({ plume: style })).toEqual({ plume: style })
    })
  })
})
