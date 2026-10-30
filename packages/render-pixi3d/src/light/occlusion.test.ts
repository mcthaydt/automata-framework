// Ported from The Last Light `tests/indirect-light.test.ts` at 92e6704 ("bakes occlusion from the sector map: wall
// bases, inside corners and the foot of furniture"), on a fixture room: the sector walls become planes, the bench a box.
import { describe, expect, it } from 'vitest'
import { contactShade, segmentBlocked } from './occlusion.js'
import { sceneLightingSchema } from './scene-lighting.schema.js'

// A room: the floor at y 0, the south wall at z 6.9 facing north, the east wall at x 4.9 facing west, a bench and a
// desk standing on the floor.
const room = sceneLightingSchema.parse({
  ambient: 0.2,
  planes: [
    { x: 0, y: 0, z: 0, normal: [0, 1, 0], width: 10, height: 14 },
    { x: 0, y: 1.5, z: 6.9, normal: [0, 0, -1], width: 10, height: 3 },
    { x: 4.9, y: 1.5, z: 0, normal: [-1, 0, 0], width: 14, height: 3 },
  ],
  boxes: [
    { id: 'bench', x: -2.85, y: 0, z: 3.35, width: 1.6, height: 0.6, depth: 0.5 },
    { id: 'desk', x: 3.45, y: 0, z: 1.35, width: 1.2, height: 0.8, depth: 0.8 },
  ],
})
const at = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => ({ x, y, z, nx, ny, nz })

describe('contactShade (ported occlusion)', () => {
  it('darkens wall bases, inside corners and the foot of furniture', () => {
    const open = contactShade(at(0, 0, 4, 0, 1, 0), room)
    expect(open).toBeGreaterThan(0.95)
    // The floor against the south wall, and in the south-east corner.
    const edge = contactShade(at(0, 0, 6.8, 0, 1, 0), room)
    const corner = contactShade(at(4.8, 0, 6.8, 0, 1, 0), room)
    expect(edge).toBeLessThan(open * 0.8)
    expect(corner).toBeLessThan(edge)
    // The east wall low down and in the corner, against its middle at eye height.
    const wallMid = contactShade(at(4.9, 1.6, 3, -1, 0, 0), room)
    const wallFoot = contactShade(at(4.9, 0.05, 3, -1, 0, 0), room)
    const wallCorner = contactShade(at(4.9, 1.6, 6.8, -1, 0, 0), room)
    expect(wallFoot).toBeLessThan(wallMid)
    expect(wallCorner).toBeLessThan(wallMid)
    // Beside the bench's footprint.
    expect(contactShade(at(-2.85, 0, 3.8, 0, 1, 0), room)).toBeLessThan(
      contactShade(at(-2.85, 0, 4.6, 0, 1, 0), room),
    )
  })

  it('never falls below 0.3 and is 1 in an empty room', () => {
    expect(contactShade(at(4.85, 0, 6.85, 0, 1, 0), room)).toBeGreaterThanOrEqual(0.3)
    expect(contactShade(at(0, 0, 0, 0, 1, 0), sceneLightingSchema.parse({ ambient: 0 }))).toBe(1)
  })
})

describe('segmentBlocked', () => {
  it('is blocked by a box between the ends, not by one beside them, and not by an ignored one', () => {
    expect(segmentBlocked(3.45, 0.5, 2.1, 3.45, 0.5, 0.6, room)).toBe(true)
    expect(segmentBlocked(1, 0.5, 2.1, 1, 0.5, 0.6, room)).toBe(false)
    expect(segmentBlocked(3.45, 0.5, 2.1, 3.45, 0.5, 0.6, room, ['desk'])).toBe(false)
  })

  it('is blocked by a plane it crosses inside its rectangle, from either side, and not past its edge', () => {
    expect(segmentBlocked(0, 1, 6, 0, 1, 8, room)).toBe(true)
    expect(segmentBlocked(0, 1, 8, 0, 1, 6, room)).toBe(true)
    expect(segmentBlocked(0, 4, 6, 0, 4, 8, room)).toBe(false)
    expect(segmentBlocked(0, 1, 6, 0, 1, 6.5, room)).toBe(false)
  })
})
