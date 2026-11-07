// `af-sector/1` to `/2` (spec 9): lossless, never silent about it, and `readLevel` is the one door a file comes in by.
import { describe, expect, it } from 'vitest'
import { type AfSector, afSectorSchema } from '#src/shared/level/af-sector.schema.ts'
import { migrateAfSector1 } from '#src/shared/level/af-sector-1-to-2.migration.ts'
import { afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'
import { readLevel } from '#src/shared/level/read-level.ts'
import depot from '../../../fixtures/level/depot.af-sector.json' with { type: 'json' }
import roomV1 from '../../../fixtures/level/room-v1.af-sector.json' with { type: 'json' }

// biome-ignore lint/suspicious/noExplicitAny: tests edit a level by path
type Json = Record<string, any>

const V1_FIXTURES: AfSector[] = [depot, roomV1].map((json) => afSectorSchema.parse(json))
const withFloor = (floor: number): Json => ({
  ...(depot as Json),
  sectors: [{ ...(depot as Json).sectors[0], floor }],
})

describe('migrating af-sector/1', () => {
  it('migrates every /1 fixture losslessly', () => {
    for (const fixture of V1_FIXTURES) {
      const two = migrateAfSector1(fixture)
      expect(two.format).toBe('af-sector/2')
      expect(afSector2Schema.parse(JSON.parse(JSON.stringify(two)))).toEqual(two)
      expect(two.sectors.map((sector) => sector.id)).toEqual(fixture.sectors.map((sector) => sector.id))
      expect(two.entities).toEqual(fixture.entities)
      expect(two.entityDefs).toEqual(fixture.entityDefs)
    }
  })

  it('reads a bare-number floor and ceiling as a plane', () => {
    const { level } = readLevel(withFloor(1.5))
    expect(level.sectors[0]?.floor).toEqual({ z: 1.5 })
    expect(level.sectors[0]?.ceiling).toEqual({ z: 4 })
  })

  it('reads a wall’s texture as its surface and keeps the rest of the wall', () => {
    const json: Json = {
      format: 'af-sector/1',
      name: 't',
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [0, 0, { texture: 'brick', next: 'b', thick: 0.2 }],
            [4, 0],
            [4, 4],
          ],
          holes: [
            [
              [1, 1, { texture: 'tile' }],
              [2, 1],
              [2, 2],
            ],
          ],
        },
      ],
    }
    const sector = readLevel(json).level.sectors[0] as Json
    expect(sector.corners[0][2]).toEqual({ surface: 'brick', next: 'b', thick: 0.2 })
    expect(sector.holes[0][0][2]).toEqual({ surface: 'tile' })
  })

  it('carries a wall’s cut and hideFrom, a sector’s zone and the level’s masses through unchanged', () => {
    const json: Json = {
      format: 'af-sector/1',
      name: 't',
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
      sectors: [
        {
          id: 'a',
          zone: 'clinic',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [0, 0, { cut: 'front', hideFrom: ['north'] }],
            [4, 0],
            [4, 4],
          ],
        },
      ],
    }
    const { level } = readLevel(json)
    const sector = level.sectors[0] as Json
    expect(sector.zone).toBe('clinic')
    expect(sector.corners[0][2]).toEqual({ cut: 'front', hideFrom: ['north'] })
    expect((level as Json).masses).toEqual(json.masses)
  })
})

describe('reading a level', () => {
  it('says when a level was migrated, and not when it was not', () => {
    expect(readLevel(roomV1).migrated).toBe(true)
    const two = readLevel(roomV1).level
    const again = readLevel(JSON.parse(JSON.stringify(two)))
    expect(again.migrated).toBe(false)
    expect(again.level).toEqual(two)
    expect(again.problems).toEqual([])
  })

  it('reports a file it cannot read instead of throwing, with where in the file', () => {
    const bad = readLevel({ format: 'af-sector/2', name: 'x', sectors: [{ id: 'a' }] })
    expect(bad.problems.length).toBeGreaterThan(0)
    expect(bad.problems[0]).toMatchObject({ code: 'invalid-level', where: 'sectors[0]' })
    expect(bad.problems[0]?.path.slice(0, 2)).toEqual(['sectors', 0])
    expect(readLevel({ format: 'af-sector/9', name: 'x', sectors: [] }).problems[0]).toMatchObject({
      code: 'unknown-format',
      path: ['format'],
    })
    expect(readLevel(null).problems[0]?.code).toBe('invalid-level')
    expect(readLevel(null).level.sectors).toEqual([])
  })
})
