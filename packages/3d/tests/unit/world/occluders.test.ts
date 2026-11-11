// The light's occluders, derived from a built world: a wall face, a floor and a ceiling are planes, and a prop's parts
// are boxes, so lamps and the sun cast shadows and the contact darkening finds a wall's foot with no hand-written list.
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import { box } from '#src/features/world/mesh.ts'
import { worldOccluders } from '#src/features/world/occluders.ts'
import { part } from '#src/features/world/props/piece.ts'
import { registerPropGenerator } from '#src/features/world/props/prop-generator-registry.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import type { AfSector2, AfSectorEntry2 } from '#src/shared/level/af-sector-2.schema.ts'
import { segmentBlocked } from '#src/shared/render/light/occlusion.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'

registerPropGenerator('occ.glow', () => ({
  pieces: [part(box([0, 1, 0], [0.2, 0.2, 0.2]), 'wood', 'bulb', { noCast: true })],
}))
registerPropGenerator('occ.speck', () => ({
  pieces: [part(box([0, 0, 0], [0.005, 0.005, 0.005]), 'wood', 'dust')],
}))

const LIB: WorldLibrary = {
  swatches: { wood: {}, oakFloor: {}, plasterWarm: {}, trimWhite: {} },
  props: {
    crate: { kind: 'box', swatch: 'wood', size: [0.6, 0.5, 0.6] },
    glow: { kind: 'occ.glow' },
    speck: { kind: 'occ.speck' },
  },
}
const room = (corners: [number, number][], extra: Partial<AfSectorEntry2> = {}): AfSectorEntry2 => ({
  id: 'a',
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners,
  ...extra,
})
const SQUARE: [number, number][] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
]
const level = (sector: AfSectorEntry2, props: AfSector2['props'] = []): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [sector],
  props,
})
const occluders = (lv: AfSector2) => worldOccluders(buildWorld(lv, LIB).pieces)

describe('planes from a room', () => {
  const { planes } = occluders(level(room(SQUARE)))
  const upright = planes.filter((p) => Math.abs(p.normal[1]) < 0.1)
  it('stands a plane on each wall face, as wide as the face and as high as the room, facing into it', () => {
    expect(upright).toHaveLength(4)
    for (const p of upright) {
      expect(p.width).toBeCloseTo(4)
      expect(p.height).toBeCloseTo(3)
      expect(p.y).toBeCloseTo(1.5)
      expect(p.normal[0] * (2 - p.x) + p.normal[2] * (2 - p.z)).toBeGreaterThan(0)
    }
  })
  it('lays a plane on the floor facing up and one under the ceiling facing down, each as large as the room', () => {
    const floor = planes.find((p) => p.normal[1] > 0.9)!
    const ceiling = planes.find((p) => p.normal[1] < -0.9)!
    expect([floor.x, floor.y, floor.z, floor.width, floor.height]).toEqual([2, 0, 2, 4, 4])
    expect([ceiling.x, ceiling.y, ceiling.z, ceiling.width, ceiling.height]).toEqual([2, 3, 2, 4, 4])
  })
  it('leaves no ceiling plane where the sky is', () => {
    const open = occluders(level(room(SQUARE, { ceiling: { z: 3, sky: true } })))
    expect(open.planes.some((p) => p.normal[1] < -0.9)).toBe(false)
  })
  it('gives no plane for a floor that is not a rectangle, since a rectangle would cover ground outside the room', () => {
    const ell = room([
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ])
    const { planes: p } = occluders(level(ell))
    expect(p.some((q) => Math.abs(q.normal[1]) > 0.9)).toBe(false)
    expect(p.filter((q) => Math.abs(q.normal[1]) < 0.1)).toHaveLength(6)
  })
  it('is something the lighting schema reads', () => {
    expect(() => sceneLightingSchema.parse({ ambient: 0.1, ...occluders(level(room(SQUARE))) })).not.toThrow()
  })
})

describe('boxes from props', () => {
  const lv = level(room(SQUARE), [
    { id: 'c1', use: 'crate', at: [2, 2] },
    { id: 'g1', use: 'glow', at: [1, 1] },
    { id: 's1', use: 'speck', at: [3, 3] },
  ] as AfSector2['props'])
  const { boxes } = occluders(lv)
  it('makes a box of each part that casts, standing where the part stands', () => {
    expect(boxes).toHaveLength(1)
    const [crate] = boxes
    expect([crate!.x, crate!.y, crate!.z]).toEqual([2, 0, 2])
    expect(crate!.width).toBeCloseTo(0.6)
    expect(crate!.height).toBeCloseTo(0.5)
    expect(crate!.depth).toBeCloseTo(0.6)
    expect(crate!.id).toContain('c1')
  })
  it('leaves out a glowing part (it casts nothing) and a speck too small to shade anything', () => {
    expect(boxes.map((b) => b.id).join()).not.toMatch(/g1|s1/)
  })
  it('shadows the floor under it from a lamp over it, and not the floor beside it', () => {
    const o = { boxes, planes: [] as never[] }
    expect(segmentBlocked(2, 0.03, 2, 2, 2.5, 2, o)).toBe(true)
    expect(segmentBlocked(3.5, 0.03, 2, 2, 2.5, 2, o)).toBe(false)
  })
  it('is something the lighting schema reads', () => {
    expect(() => sceneLightingSchema.parse({ ambient: 0.1, boxes })).not.toThrow()
  })
})
