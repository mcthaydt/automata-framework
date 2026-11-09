// The level as a file writes it (spec 4): an editor patches text from a model that must equal what the text parses to,
// so it reads a plane as written (a number stays a number) where the game's reader reshapes it to `{ z }`.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { type AfSector, afSectorSchema } from '#src/shared/level/af-sector.schema.ts'
import { migrateAfSector1, migrateAfSector1File } from '#src/shared/level/af-sector-1-to-2.migration.ts'
import { afSector2FileSchema, afSector2Schema } from '#src/shared/level/af-sector-2.schema.ts'
import { planeZ, withPlaneZ } from '#src/shared/level/plane.ts'
import depot from '../../../fixtures/level/depot.af-sector.json' with { type: 'json' }
import roomV1 from '../../../fixtures/level/room-v1.af-sector.json' with { type: 'json' }

const EMBER_HALL: unknown = JSON.parse(
  readFileSync(
    new URL('../../../../../../games/base-3d/content/levels/room.af-sector.json', import.meta.url),
    'utf8',
  ),
)
const V2_FIXTURES: unknown[] = [
  EMBER_HALL,
  JSON.parse(JSON.stringify(BASE_SCENES['base-interior'])),
  JSON.parse(JSON.stringify(BASE_SCENES['base-exterior'])),
]
// The toy files have no wall texture, so a small level that has some (and a hole) makes the upgrade's one rename visible.
const TEXTURED: unknown = {
  format: 'af-sector/1',
  name: 'textured',
  sectors: [
    {
      id: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0, { texture: 'brick', next: 'yard' }],
        [8, 0],
        [8, 8, { texture: 'plaster' }],
        [0, 8],
      ],
      holes: [
        [
          [2, 2, { texture: 'tiles' }],
          [3, 2],
          [3, 3],
        ],
      ],
    },
    {
      id: 'yard',
      floor: 0.5,
      ceiling: 3,
      light: 1,
      corners: [
        [8, 0],
        [12, 0],
        [12, 4],
      ],
    },
  ],
}
const V1_FIXTURES: AfSector[] = [depot, roomV1, TEXTURED].map((json) => afSectorSchema.parse(json))

/** The paths at which two JSON values differ, as `a.b[0]` text; a value only one side has is a difference. */
function differences(a: unknown, b: unknown, path = ''): string[] {
  if (Object.is(a, b)) return []
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return [path]
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap((key) =>
    differences(a[key], b[key], Array.isArray(a) ? `${path}[${key}]` : path === '' ? key : `${path}.${key}`),
  )
}

describe('the level as written', () => {
  it('reads a level as written: a number stays a number', () => {
    const room = afSector2FileSchema.parse(EMBER_HALL)
    expect(room).toEqual(EMBER_HALL)
    expect(room.sectors[0]?.floor).toBe(0)
  })

  it('reads a plane written as an object as an object', () => {
    const room = afSector2FileSchema.parse(JSON.parse(JSON.stringify(BASE_SCENES['base-interior'])))
    expect(room.sectors[0]?.floor).toEqual({ z: 0, surface: 'baseFloor' })
  })

  it('agrees with the reader on every fixture', () => {
    for (const fixture of V2_FIXTURES)
      expect(afSector2Schema.parse(afSector2FileSchema.parse(fixture))).toEqual(
        afSector2Schema.parse(fixture),
      )
  })

  it('refuses another major version, as the reader does', () => {
    expect(afSector2FileSchema.safeParse({ format: 'af-sector/3', name: 'x', sectors: [] }).success).toBe(
      false,
    )
  })

  it('keeps a plane as it is written', () => {
    expect(withPlaneZ(0, 1.5)).toBe(1.5)
    expect(withPlaneZ({ z: 0, slope: [0.1, 0] }, 1.5)).toEqual({ z: 1.5, slope: [0.1, 0] })
    expect(planeZ({ z: 2 })).toBe(2)
    expect(planeZ(3)).toBe(3)
  })

  it('upgrades a /1 file by its format and its walls’ texture only', () => {
    for (const fixture of V1_FIXTURES) {
      const two = migrateAfSector1File(fixture)
      const wallTextures = fixture.sectors.flatMap((sector, s) => [
        ...sector.corners.flatMap((corner, c) =>
          corner[2]?.texture === undefined
            ? []
            : [`sectors[${s}].corners[${c}][2].texture`, `sectors[${s}].corners[${c}][2].surface`],
        ),
        ...(sector.holes ?? []).flatMap((hole, h) =>
          hole.flatMap((corner, c) =>
            corner[2]?.texture === undefined
              ? []
              : [`sectors[${s}].holes[${h}][${c}][2].texture`, `sectors[${s}].holes[${h}][${c}][2].surface`],
          ),
        ),
      ])
      expect(differences(fixture, two).sort()).toEqual(['format', ...wallTextures].sort())
      expect(afSector2Schema.parse(two)).toEqual(migrateAfSector1(fixture))
      expect(JSON.stringify(two)).not.toContain('"texture"')
    }
  })
})
