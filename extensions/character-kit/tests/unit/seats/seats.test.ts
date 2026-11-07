import { BASE_PAIR } from '@automata/3d/base'
import { apply, type Gait, invertRigid, J, measure, position, skeletonFromGenes } from '@automata/3d/figures'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Seat } from '#src/features/seats/seat.schema.ts'
import { SIT, seated } from '#src/features/seats/seated.ts'
import { kitFixture } from '#src/testing/kit-fixture.ts'

// No figure sits by default, so this is what keeps the seats from being cut as dead. For every seat, on the base man (a
// shorter body cannot reach the floor from a fixed seat), the hips land on the seat (its height plus the thigh's flesh
// under the hip joint, less what a slump sinks them) and both ankles stand on the floor, in the root's space; and a seat is
// drawn the same every time it is asked for.

const SEAT_IDS = ['leanIn', 'mouse', 'reachClick', 'slump', 'toMouth', 'triumph', 'typing', 'upright']
let seats: Readonly<Record<string, Seat>> = {}
let gait: Gait
beforeAll(async () => {
  const fixture = await kitFixture()
  seats = fixture.seats
  const bounce = fixture.gaits.bounce
  if (!bounce) throw new Error('the fixture has no bounce gait')
  gait = bounce
})
const s = skeletonFromGenes(measure(BASE_PAIR.man.sliders).genes)
const k = s.genes.height / 1.62
const kebab = (id: string) => id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const inRoot = (world: ReturnType<typeof seated>['world'], joint: number) => {
  const root = world[J.root]
  if (!root) throw new Error('no root')
  const m = world[joint]
  if (!m) throw new Error('no joint')
  return apply(invertRigid(root), position(m))
}

describe('every seat', () => {
  it('the fixture has the eight seats the source has', () => {
    expect(Object.keys(seats).sort()).toEqual(SEAT_IDS.map(kebab).sort())
  })
  for (const id of SEAT_IDS)
    it(kebab(id), () => {
      const seat = seats[kebab(id)]
      if (!seat) throw new Error(`no seat ${id}`)
      const { world, pose } = seated(s, gait, seat, 0.3)
      for (const side of ['L', 'R'] as const) {
        expect(inRoot(world, J[`thigh.${side}`])[1], `${side} hip`).toBeCloseTo(
          seat.height + SIT * k - 0.03 * k * (seat.slump ?? 0),
          2,
        )
        expect(Math.abs(inRoot(world, J[`foot.${side}`])[1] - s.genes.ankle), `${side} ankle`).toBeLessThan(
          0.001,
        )
      }
      expect(seated(s, gait, seat, 0.3).pose).toEqual(pose)
    })
  it('typing hands bob out of step; hands in the lap do not', () => {
    const typing = seats.typing
    const upright = seats.upright
    if (!typing || !upright) throw new Error('no seats')
    const hand = (seat: Seat, t: number, side: 'L' | 'R') =>
      inRoot(seated(s, gait, seat, t).world, J[`hand.${side}`])[1]
    const bobs = [0, 0.05, 0.1, 0.15, 0.2].map((t) => hand(typing, t, 'L'))
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeGreaterThan(0.001)
    expect(Math.abs(hand(upright, 0, 'L') - hand(upright, 0.07, 'L'))).toBeLessThan(0.01)
  })
  it('the hems ride the ankles, however far the knee is forward of the foot', () => {
    const seat = seats.upright
    if (!seat) throw new Error('no upright seat')
    const { world } = seated(s, gait, seat, 0)
    for (const side of ['L', 'R'] as const) {
      const hem = inRoot(world, J[`hem${side}`])
      const ankle = inRoot(world, J[`foot.${side}`])
      expect(hem[2], `${side} hem`).toBeCloseTo(ankle[2], 6)
    }
  })
})
