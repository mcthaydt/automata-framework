// The `af-sector/2` schema (spec 9): /1 plus the builder's fields, one row each. A pure validator except for one
// thing, the plane: a bare number reads as `{ z }` so every reader sees one shape.
import { describe, expect, it } from 'vitest'
import { AF_SECTOR_2_FORMAT, afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'

// biome-ignore lint/suspicious/noExplicitAny: tests edit a level by path
type Json = Record<string, any>

const room = (extra: Json = {}): Json => ({
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
  ...extra,
})
const level = (extra: Json = {}, sector: Json = {}): Json => ({
  format: AF_SECTOR_2_FORMAT,
  name: 'toy',
  sectors: [room(sector)],
  ...extra,
})
const parse = (json: Json) => {
  const result = afSector2Schema.safeParse(json)
  expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
  return result.data as Json
}
const refusedAt = (json: Json): PropertyKey[][] | undefined => {
  const result = afSector2Schema.safeParse(json)
  return result.success ? undefined : result.error.issues.map((issue) => issue.path)
}

describe('the af-sector/2 schema', () => {
  it('names its format and refuses any other major', () => {
    expect(AF_SECTOR_2_FORMAT).toBe('af-sector/2')
    expect(refusedAt(level({ format: 'af-sector/1' }))).toEqual([['format']])
    expect(refusedAt(level({ format: 'af-sector/3' }))).toEqual([['format']])
    expect(parse(level({ format: 'af-sector/2.1' })).format).toBe('af-sector/2.1')
  })

  it('reads a floor and a ceiling as a plane: a number is { z }, an object keeps its slope, sky and surface', () => {
    const two = parse(level({}, { floor: 1.5, ceiling: { z: 3, sky: true }, light: 0.8 })).sectors[0]
    expect(two.floor).toEqual({ z: 1.5 })
    expect(two.ceiling).toEqual({ z: 3, sky: true })
    const sloped = parse(
      level(
        {},
        { floor: { z: 0, slope: [0.25, 0], surface: { tile: 'oak', repeat: [2, 2], align: 'world' } } },
      ),
    ).sectors[0]
    expect(sloped.floor).toEqual({
      z: 0,
      slope: [0.25, 0],
      surface: { tile: 'oak', repeat: [2, 2], align: 'world' },
    })
    expect(refusedAt(level({}, { floor: 'high' }))).toBeDefined()
  })

  it('reads the sector fields: zone, pit, grime, a door and a dressing', () => {
    const sector = parse(
      level(
        {},
        {
          zone: 'clinic',
          pit: true,
          grime: 1,
          door: {
            open: [2, 6],
            near: 1.5,
            speed: 0.6,
            into: -1,
            hinge: 'end',
            surface: 'oak',
            handle: 'brass',
          },
          dress: {
            as: 'office',
            density: 0.5,
            seed: 7,
            remove: ['hall:floor:1'],
            pin: { 'hall:floor:2': { at: [1, 2], angle: 90, use: 'chair' } },
            surfaces: { floor: 'oak', dado: { surface: 'wood', height: 0.9 }, rail: 0.9 },
          },
        },
      ),
    ).sectors[0]
    expect(sector).toMatchObject({ zone: 'clinic', pit: true, grime: 1 })
    expect(sector.door).toMatchObject({ hinge: 'end', into: -1 })
    expect(sector.dress).toMatchObject({ as: 'office', seed: 7 })
    expect(parse(level({}, { dress: { as: 'office', surfaces: false } })).sectors[0].dress.surfaces).toBe(
      false,
    )
    expect(refusedAt(level({}, { dress: { density: 1 } }))).toEqual([['sectors', 0, 'dress', 'as']])
    expect(refusedAt(level({}, { door: { hinge: 'middle' } }))).toEqual([['sectors', 0, 'door', 'hinge']])
  })

  it('reads a corner’s wall with the builder’s members and keeps cut and hideFrom', () => {
    const wall = {
      next: 'dock',
      surface: { tile: 'brick', align: 'wall' },
      upper: 'plaster',
      lower: 'tile',
      trim: 'trimWhite',
      skirting: 0.1,
      dado: { surface: 'wood', height: 0.9 },
      rail: 0.9,
      cornice: { surface: 'plaster', height: 0.2 },
      none: true,
      decor: [{ kind: 'window', pos: 1, width: 1.2, height: 1.1, sill: 0.9, lit: true }],
      windows: { from: 3, rows: 2, cols: 4, width: 1, height: 1.2, gap: 0.5, lit: 0.4, seed: 3 },
      cut: 'front',
      hideFrom: ['north'],
      window: { at: 1, width: 1, y0: 1, y1: 2 },
    }
    const parsed = parse(
      level(
        {},
        {
          corners: [
            [0, 0, wall],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        },
      ),
    )
    expect(parsed.sectors[0].corners[0][2]).toEqual(wall)
    // /1's own trim object still reads
    const trimmed = parse(
      level(
        {},
        {
          corners: [
            [0, 0, { trim: { skirting: 0.2, cap: false } }],
            [4, 0],
            [4, 4],
          ],
        },
      ),
    )
    expect(trimmed.sectors[0].corners[0][2].trim).toEqual({ skirting: 0.2, cap: false })
    expect(
      refusedAt(
        level(
          {},
          {
            corners: [
              [0, 0, { decor: [{ kind: 'gate', pos: 1, width: 1 }] }],
              [4, 0],
              [4, 4],
            ],
          },
        ),
      ),
    ).toBeDefined()
  })

  it('reads the level’s presentation: props, cast, lamps, time, look, views, paths, sky, seed, reads', () => {
    const two = parse(
      level({
        title: 'A bedroom',
        grime: 0.25,
        seed: 4,
        props: [
          { id: 'bed', use: 'bed.single', at: [-2, -1.08], angle: -90 },
          { id: 'lamp', use: 'lamp.desk', at: [-0.7, -1.45, 0.55], with: { shade: 'plum' }, layer: 'near' },
          { id: 'line', kind: 'box', at: [0, 0.8], with: { size: [1, 0.1, 0.1] } },
        ],
        cast: [{ id: 'f', who: 'base-f', pose: 'stand', at: [0.25, 0.35], angle: 90, to: [-14, 2.3] }],
        lamps: [{ id: 'sun', kind: 'sodium', at: [1, 2, 3], range: 5, level: 0.5, shaft: true }],
        time: { preset: 'lampLit', shadow: false },
        look: { visibility: 7, grade: 'warmNight' },
        views: {
          start: { yawDeg: 0, bounds: { min: [0, 0, 0], max: [1, 2, 1] } },
          fp: { at: [1, 2], angle: 200 },
        },
        paths: {
          walk: [
            [2.4, 1.4],
            [0.8, 1.2, 90],
          ],
        },
        sky: {
          horizon: [{ kind: 'city', swatch: '#23324d', height: 0.22, seed: 4 }],
          layers: [{ name: 'far', from: -4, factor: 0.5 }],
        },
        reads: { minEdge: 1.1, hot: false },
        decals: [{ at: [1, 1], kind: 'stain' }],
        lettering: [{ at: [0, 1, 2], text: ['OPEN'] }],
        masses: [
          {
            points: [
              { x: 0, z: 0 },
              { x: 1, z: 0 },
              { x: 1, z: 1 },
            ],
            top: 3,
            cut: 'front',
          },
        ],
        dress: { as: 'apartment', keep: false },
      }),
    )
    expect(parse(level({ time: 'night' })).time).toBe('night')
    expect(two.props).toHaveLength(3)
    expect(two.cast[0].to).toEqual([-14, 2.3])
    expect(two.masses[0].cut).toBe('front')
    expect(two.title).toBe('A bedroom')
    expect(refusedAt(level({ props: [{ id: 'x', at: [1] }] }))).toBeDefined()
    expect(refusedAt(level({ lamps: [{ id: 'x', at: [1, 1, 1] }] }))).toEqual([['lamps', 0, 'kind']])
  })

  it('keeps a member it does not know, so a newer file survives a round trip', () => {
    const json = level({ extra: { a: 1 } }, { future: true })
    expect(parse(json)).toEqual({
      ...json,
      sectors: [{ ...json.sectors[0], floor: { z: 0 }, ceiling: { z: 3 } }],
    })
  })
})
