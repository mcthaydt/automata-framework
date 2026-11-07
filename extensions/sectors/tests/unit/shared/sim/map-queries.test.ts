// The map's queries: where a point is, the floor under it, and whether a walk is blocked. The step rule
// is the sector format's `STEP`: a lower strip of exactly 0.25 m is climbed, anything taller is a wall.
import { opening, STEP, walkBlocker } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { pieceSpans } from '#src/shared/sim/pieces.ts'
import { resolveLevel } from '#src/shared/sim/resolve.ts'
import { clinicMap } from '#src/testing/clinic.ts'

/** Two rooms side by side, 4 m square, joined by a portal on x = 4; the east room's floor is `step` higher. */
const twoRooms = (step: number, eastWall: object = {}) =>
  resolveLevel({
    sectors: [
      {
        id: 'west',
        zone: 'ward',
        floor: { z: 0 },
        ceiling: { z: 3 },
        light: 1,
        corners: [
          [0, 0],
          [4, 0, { next: 'east', ...eastWall }],
          [4, 4],
          [0, 4],
        ],
      },
      {
        id: 'east',
        zone: 'hall',
        floor: { z: step },
        ceiling: { z: 3 },
        light: 1,
        corners: [
          [4, 0],
          [8, 0],
          [8, 4],
          [4, 4, { next: 'west', ...eastWall }],
        ],
      },
    ],
  })

describe('sectorAt and floorAt', () => {
  const clinic = resolveLevel(clinicMap())

  it('names the sector under a point, leaving a hole to the sector it holds', () => {
    expect(clinic.sectorAt({ x: 0, z: 3 })?.id).toBe('hall')
    expect(clinic.sectorAt({ x: 3, z: 2 })?.id).toBe('counter')
    expect(clinic.floorAt({ x: 3, z: 2 })).toBe(1.1)
  })

  it('is undefined outside the map', () => {
    expect(clinic.sectorAt({ x: 100, z: 100 })).toBeUndefined()
    expect(clinic.floorAt({ x: 100, z: 100 })).toBeUndefined()
  })
})

describe('the step rule and segmentBlocked', () => {
  it('builds a portal’s lower strip only when the far floor is higher, and its opening between them', () => {
    expect(pieceSpans({ floor: 0, ceiling: 3 }, { floor: 0.5, ceiling: 2.5 })).toEqual([
      { y0: 0, y1: 0.5, kind: 'lower' },
      { y0: 2.5, y1: 3, kind: 'upper' },
    ])
    expect(pieceSpans({ floor: 0, ceiling: 3 }, undefined)).toEqual([{ y0: 0, y1: 3, kind: 'wall' }])
    expect(opening({ sector: { floor: 0, ceiling: 3 }, next: { floor: 0.5, ceiling: 2.5 } })).toEqual({
      y0: 0.5,
      y1: 2.5,
    })
  })

  it('climbs a step of exactly STEP and is stopped by a taller one', () => {
    expect(walkBlocker({ y0: 0, y1: STEP, kind: 'lower' })).toBe(false)
    expect(walkBlocker({ y0: 0, y1: STEP + 0.01, kind: 'lower' })).toBe(true)
    expect(walkBlocker({ y0: 2, y1: 3, kind: 'upper' })).toBe(false)
  })

  it('blocks a walk through a solid wall or a tall step, not through a low one or a plain portal', () => {
    const across = [
      { x: 2, z: 2 },
      { x: 6, z: 2 },
    ] as const
    expect(twoRooms(0).segmentBlocked(...across)).toBe(false)
    expect(twoRooms(STEP).segmentBlocked(...across)).toBe(false)
    expect(twoRooms(0.5).segmentBlocked(...across)).toBe(true)
    expect(twoRooms(0).segmentBlocked({ x: 2, z: 2 }, { x: 2, z: -1 })).toBe(true)
  })

  it('blocks at a blocking masked portal, and keeps a margin from walls', () => {
    expect(twoRooms(0, { mask: 'bars', block: true }).segmentBlocked({ x: 2, z: 2 }, { x: 6, z: 2 })).toBe(
      true,
    )
    const alongSouth = [
      { x: 1, z: 0.3 },
      { x: 3, z: 0.3 },
    ] as const
    expect(twoRooms(0).segmentBlocked(...alongSouth)).toBe(false)
    expect(twoRooms(0).segmentBlocked(...alongSouth, 0.35)).toBe(true)
  })
})
