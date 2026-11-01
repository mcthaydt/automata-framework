// Where the night's dressing goes (art direction spec §4.2, §4.5–§4.7), worked out from the room: every light and prop
// stands where it can be seen and never in Wick's way, the light count stays inside the tiled-lighting budget, and the
// ruined side walls are cut into bays that cover each wall exactly.
import { describe, expect, it } from 'vitest'
import { ROOM } from '../content/room.ts'
import { dressingOf, LIGHT_BUDGET } from './dressing.ts'
import { sceneOf } from './index.ts'

const dressing = dressingOf(ROOM)
type Plan = { readonly x: number; readonly z: number }
const inRoom = ({ x, z }: Plan) =>
  ROOM.rooms.some((r) => x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1])
const inPit = ({ x, z }: Plan) =>
  (ROOM.pits ?? []).some((p) => x > p.min[0] && x < p.max[0] && z > p.min[1] && z < p.max[1])
const clearOf = (spot: Plan, others: readonly Plan[], metres: number) =>
  others.every((o) => Math.hypot(o.x - spot.x, o.z - spot.z) >= metres)
const KEEP_CLEAR = [ROOM.spawn, ...ROOM.embers, ROOM.goal]

describe('the dressing', () => {
  it('is the same every time it is worked out', () => {
    expect(dressingOf(ROOM)).toEqual(dressing)
  })

  it('keeps every light within the budget, counting the embers, the goal and the lantern that come with their views', () => {
    // The embers and the goal carry one each; Wick carries three (his lantern, the rim over his hood, the fill on
    // his back).
    const withViews = dressing.lights.length + ROOM.embers.length + 1 + 3
    expect(withViews).toBeLessThanOrEqual(LIGHT_BUDGET)
    expect(LIGHT_BUDGET).toBeLessThanOrEqual(32)
  })

  it('puts mushroom clusters on the platforms by the walls, clear of the spawn, the embers and the goal', () => {
    expect(dressing.mushrooms.length).toBeGreaterThanOrEqual(8)
    for (const spot of dressing.mushrooms) {
      expect(inRoom(spot), JSON.stringify(spot)).toBe(true)
      expect(inPit(spot)).toBe(false)
      expect(clearOf(spot, KEEP_CLEAR, 1)).toBe(true)
      expect(Math.min(spot.x - -5, 5 - spot.x, 28 - spot.z)).toBeLessThan(0.8)
    }
  })

  it('lights each mushroom cluster, and rims each channel edge with a cool glow instead of lava light', () => {
    expect(dressing.lights.filter((l) => l.kind === 'mushroom')).toHaveLength(dressing.mushrooms.length)
    expect(dressing.lights.every((l) => l.kind === 'mushroom')).toBe(true)
    for (const pit of ROOM.pits ?? []) {
      const rims = dressing.rims.filter((r) => r.z === pit.min[1] || r.z === pit.max[1])
      expect(rims).toHaveLength(2)
      for (const rim of rims) expect([rim.x0, rim.x1]).toEqual([pit.min[0], pit.max[0]])
    }
  })

  it('grows grass on the platforms only, and hangs vines on the channels’ edges', () => {
    expect(dressing.grass.length).toBeGreaterThan(100)
    for (const tuft of dressing.grass) {
      expect(inRoom(tuft)).toBe(true)
      expect(inPit(tuft)).toBe(false)
    }
    expect(dressing.vines.length).toBeGreaterThan(10)
    for (const vine of dressing.vines)
      expect(
        (ROOM.pits ?? []).some((p) => Math.abs(vine.z - p.min[1]) < 0.1 || Math.abs(vine.z - p.max[1]) < 0.1),
      ).toBe(true)
  })

  it('cuts each side wall into low ruined bays that cover it exactly, between 0.5 and 1.3 m high', () => {
    const sides = sceneOf(ROOM).walls.filter((w) => w.a.x === w.b.x)
    for (const wall of sides) {
      const bays = dressing.bays.filter((b) => b.a.x === wall.a.x && between(b, wall))
      const length = bays.reduce((sum, b) => sum + Math.abs(b.b.z - b.a.z), 0)
      expect(length).toBeCloseTo(Math.abs(wall.b.z - wall.a.z), 6)
      for (const bay of bays) {
        expect(bay.height).toBeGreaterThanOrEqual(0.5)
        expect(bay.height).toBeLessThanOrEqual(1.3)
        // The bay faces the room as its wall does.
        expect(Math.sign(bay.b.z - bay.a.z)).toBe(Math.sign(wall.b.z - wall.a.z))
      }
    }
  })

  it('opens the far wall in an arch at least 3 m wide on the room’s centre line', () => {
    const { arch } = dressing
    expect(arch.max - arch.min).toBeGreaterThanOrEqual(3)
    expect((arch.min + arch.max) / 2).toBeCloseTo(0, 6)
    const far = sceneOf(ROOM).walls.find((w) => w.a.z === w.b.z && w.a.z > 20)
    expect(arch.z).toBe(far?.a.z)
  })

  it('floats the room in the night: silhouette islands far off and below, and a large moon high and to the right', () => {
    for (const card of [...dressing.pines, ...dressing.towers]) {
      expect(Math.hypot(card.x, card.z - 14)).toBeGreaterThan(25)
      expect(card.y).toBeLessThan(-3)
    }
    expect(dressing.towers.length).toBeGreaterThan(3)
    expect(dressing.pines.length).toBeGreaterThan(10)
    const { moon } = dressing
    expect(moon.size).toBeGreaterThanOrEqual(16)
    // Facing +z (the start view's heading), screen right is −x.
    expect(moon.x).toBeLessThan(-15)
    // Seen from the start view's eye (3.1 m up, 3 m behind the spawn), the moon's centre is within 12° below the
    // horizon: the top of the frame, which sits 1.5° above it.
    const below = Math.atan2(3.1 - moon.y, Math.hypot(moon.x, moon.z + 3)) * (180 / Math.PI)
    expect(below).toBeGreaterThan(0)
    expect(below).toBeLessThan(12)
  })
})

const between = (bay: { a: Plan; b: Plan }, wall: { a: Plan; b: Plan }) => {
  const [lo, hi] = [Math.min(wall.a.z, wall.b.z), Math.max(wall.a.z, wall.b.z)]
  return Math.min(bay.a.z, bay.b.z) >= lo - 1e-9 && Math.max(bay.a.z, bay.b.z) <= hi + 1e-9
}
