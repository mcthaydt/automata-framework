// A level's emitters are presentation: steam, drips, moths, flames and embers that the particle layer draws. They parse
// with the level and nothing the sim reads depends on them.
import { describe, expect, it } from 'vitest'
import { AF_SECTOR_2_FORMAT, afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'

const level = (emitters: unknown) => ({
  format: AF_SECTOR_2_FORMAT,
  name: 'toy',
  sectors: [
    {
      id: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
    },
  ],
  emitters,
})

describe('a level’s emitters', () => {
  it('parse with the level, each with its kind and place', () => {
    const result = afSector2Schema.safeParse(
      level([
        { kind: 'steam', at: [1, 0, 1] },
        { kind: 'drip', at: [1, 2.5, 3], to: [3, 2.5, 3], ground: 0 },
        { kind: 'moth', at: [2, 2.4, 2] },
        { kind: 'flame', at: [0.5, 1.2, 0.5] },
        { kind: 'ember', at: [3, 0.2, 3] },
      ]),
    )
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data.emitters?.map((e) => e.kind)).toEqual(['steam', 'drip', 'moth', 'flame', 'ember'])
  })

  it('refuse a kind there is not, and a place that is not three numbers', () => {
    expect(afSector2Schema.safeParse(level([{ kind: 'rain', at: [0, 0, 0] }])).success).toBe(false)
    expect(afSector2Schema.safeParse(level([{ kind: 'steam', at: [0, 0] }])).success).toBe(false)
  })

  it('are optional: a level without them parses as before', () => {
    const result = afSector2Schema.safeParse(level(undefined))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.emitters).toBeUndefined()
  })
})
