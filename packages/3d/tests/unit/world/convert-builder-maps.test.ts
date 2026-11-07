// EnvironmentBuilder's maps, converted once into `/2` (spec 9). The fixture is `maps.json` at 6d82a52.
import { describe, expect, it } from 'vitest'
import { convertBuilderMap } from '#src/features/world/convert-builder-map.ts'
import { afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'
import maps from '../../fixtures/level/builder-maps.json' with { type: 'json' }

// biome-ignore lint/suspicious/noExplicitAny: tests read a level by path
type Json = Record<string, any>

const MAPS = maps as Record<string, Json>
const builderMap = (id: string): Json => ({ id, ...MAPS[id] })

describe('converting a builder map', () => {
  it('converts a builder map: rect sectors to corners, sprites to props and cast', () => {
    const two = convertBuilderMap(builderMap('bedroom')) as Json
    expect(two.sectors[0].corners).toHaveLength(4)
    expect(two.props.length).toBeGreaterThan(0)
    expect(two.cast).toHaveLength(2)
  })

  it('converts every map to a level the /2 schema reads back unchanged', () => {
    for (const id of Object.keys(MAPS)) {
      const two = convertBuilderMap(builderMap(id))
      expect(afSector2Schema.parse(JSON.parse(JSON.stringify(two))), id).toEqual(two)
      expect(two.name).toBe(id)
    }
  })

  it('walks a rectangle clockwise from its north-west corner, so edge i is the builder’s edge i', () => {
    const two = convertBuilderMap(builderMap('bedroom')) as Json
    expect(two.sectors[0].corners.map((c: number[]) => [c[0], c[1]])).toEqual([
      [-3.1, -1.7],
      [3.1, -1.7],
      [3.1, 1.7],
      [-3.1, 1.7],
    ])
    // the north wall (edge 0) carries the window and the door
    expect(two.sectors[0].corners[0][2].decor.map((d: Json) => d.kind)).toEqual(['window', 'door'])
  })

  it('puts the sector’s default wall on every edge and an edge’s own members over it', () => {
    const two = convertBuilderMap(builderMap('bedroom')) as Json
    const [north, east] = two.sectors[0].corners.map((c: unknown[]) => c[2])
    expect(east).toEqual({ surface: 'wallpaperSage', skirting: 0.1, trim: 'trimWhite' })
    expect(north).toMatchObject({ surface: 'wallpaperSage', skirting: 0.1, trim: 'trimWhite' })
  })

  it('reads planes, shade, time, views and the rest of the level', () => {
    const two = convertBuilderMap(builderMap('bedroom')) as Json
    expect(two.sectors[0].floor).toEqual({ z: 0, surface: 'oakFloor' })
    expect(two.sectors[0].ceiling).toEqual({ z: 2.6, surface: 'ceiling' })
    expect(two.sectors[0].light).toBe(1)
    expect(two.time).toBe('lampLit')
    expect(two.look).toEqual({ visibility: 7, grade: 'warmNight' })
    expect(two.grime).toBe(0.25)
    expect(Object.keys(two.views)).toEqual(['diorama', 'topdown', 'fp'])
    expect(two.paths.walk).toHaveLength(5)
    // a darker builder shade is a lower light level
    expect((convertBuilderMap(builderMap('neonBar')) as Json).sectors.map((s: Json) => s.light)).toContain(
      0.8,
    )
  })

  it('turns sprites with a use or kind into props with stable ids, and sprites with who into cast', () => {
    const two = convertBuilderMap(builderMap('streetNight')) as Json
    const ids = [...two.props, ...two.cast].map((p: Json) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(two.props.some((p: Json) => p.kind === 'box')).toBe(true)
    expect(two.cast.find((c: Json) => c.to !== undefined)).toMatchObject({ who: 'base-f', to: [-14, 2.3] })
    // a sprite’s own id survives
    expect(convertBuilderMap(builderMap('bedroom')).props?.some((p) => p.id === 'bedside')).toBe(true)
  })

  it('carries the horizon into sky and the map’s reads', () => {
    const two = convertBuilderMap(builderMap('streetNight')) as Json
    expect(two.sky.horizon).toHaveLength(2)
    expect((convertBuilderMap(builderMap('neonBar')) as Json).reads).toBeDefined()
  })

  it('keeps a sector given as vertices, a slope, a sky ceiling, a door and a dress', () => {
    const two = convertBuilderMap({
      id: 'x',
      name: 'X',
      time: 'day',
      sprites: [],
      sectors: [
        {
          id: 'a',
          verts: [
            [0, 0],
            [3, 0],
            [0, 3],
          ],
          floor: { z: 0, swatch: 'g', slope: [0.1, 0] },
          ceil: { z: 3, sky: true },
          door: { near: 1, swatch: 'oak', shown: 1 },
          doorState: 1,
          dress: { as: 'office', dressed: true, seed: 2 },
          walls: {
            1: { swatch: 'brick', windows: { from: 1, rows: 1, cols: 2, width: 1, height: 1, gap: 1 } },
          },
        },
      ],
      dressed: true,
    }) as Json
    const sector = two.sectors[0]
    expect(sector.corners).toHaveLength(3)
    expect(sector.floor).toEqual({ z: 0, surface: 'g', slope: [0.1, 0] })
    expect(sector.ceiling).toEqual({ z: 3, sky: true })
    expect(sector.door).toEqual({ near: 1, surface: 'oak' })
    expect(sector.dress).toEqual({ as: 'office', seed: 2 })
    expect(sector.corners[1][2]).toEqual({
      surface: 'brick',
      windows: { from: 1, rows: 1, cols: 2, width: 1, height: 1, gap: 1 },
    })
    expect(two.dressed).toBeUndefined()
  })

  it('refuses a plan that is not a map', () => {
    expect(() => convertBuilderMap(null)).toThrow(/builder map/)
    expect(() => convertBuilderMap({ id: 'x' })).toThrow(/sectors/)
  })
})
