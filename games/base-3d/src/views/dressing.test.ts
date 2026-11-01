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
    const withViews = dressing.lights.length + ROOM.embers.length + 1 + 1
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

  it('lights each mushroom cluster and each channel twice', () => {
    expect(dressing.lights.filter((l) => l.kind === 'mushroom')).toHaveLength(dressing.mushrooms.length)
    for (const pit of ROOM.pits ?? []) {
      const lava = dressing.lights.filter((l) => l.kind === 'lava' && l.z > pit.min[1] && l.z < pit.max[1])
      expect(lava).toHaveLength(2)
      for (const light of lava) expect(light.y).toBeLessThan(0)
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

  it('cuts each side wall into bays that cover it exactly, between 1.6 and 2.6 m high', () => {
    const sides = sceneOf(ROOM).walls.filter((w) => w.a.x === w.b.x)
    for (const wall of sides) {
      const bays = dressing.bays.filter((b) => b.a.x === wall.a.x && between(b, wall))
      const length = bays.reduce((sum, b) => sum + Math.abs(b.b.z - b.a.z), 0)
      expect(length).toBeCloseTo(Math.abs(wall.b.z - wall.a.z), 6)
      for (const bay of bays) {
        expect(bay.height).toBeGreaterThanOrEqual(1.6)
        expect(bay.height).toBeLessThanOrEqual(2.6)
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

  it('stands the backdrop outside the walls', () => {
    for (const pine of dressing.pines) expect(Math.abs(pine.x) > 6 || pine.z > 29).toBe(true)
    for (const tower of dressing.towers) expect(tower.z).toBeGreaterThan(40)
    expect(dressing.moon.z).toBeGreaterThan(40)
  })
})

const between = (bay: { a: Plan; b: Plan }, wall: { a: Plan; b: Plan }) => {
  const [lo, hi] = [Math.min(wall.a.z, wall.b.z), Math.max(wall.a.z, wall.b.z)]
  return Math.min(bay.a.z, bay.b.z) >= lo - 1e-9 && Math.max(bay.a.z, bay.b.z) <= hi + 1e-9
}
