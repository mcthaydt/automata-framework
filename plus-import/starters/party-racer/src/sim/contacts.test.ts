import { describe, expect, it } from 'vitest'
import { CONTACT_TOLERANCE, type ContactSizes, racerContacts } from './contacts'

// A 1 m racer and a 2.4 m by 0.4 m floor at the origin: the racer rests on top with its centre at y = 0.7.
const sizes: ContactSizes = {
  racerHalfWidth: 0.5,
  racerHalfHeight: 0.5,
  floorHalfWidth: 1.2,
  floorHalfHeight: 0.2,
}
const floor = { index: 3, x: 0, y: 0, vx: 0 }
const leavingTop = 3.75
const contacts = (racer: { x: number; y: number; vx: number; vy: number }, floors = [floor]) =>
  racerContacts(racer, floors, sizes, leavingTop)

describe('racerContacts', () => {
  it('reads a racer landing on the top face as top and foot', () => {
    expect(contacts({ x: 0, y: 0.699, vx: 0, vy: -2 })).toEqual([
      { kind: 'top', floor: 3 },
      { kind: 'foot', floor: 3 },
    ])
  })

  it('counts a top contact unless the racer is already leaving it at half bounce speed', () => {
    expect(contacts({ x: 0, y: 0.7, vx: 0, vy: 3 }).map((c) => c.kind)).toEqual(['top', 'foot'])
    expect(contacts({ x: 0, y: 0.7, vx: 0, vy: 4 }).map((c) => c.kind)).toEqual(['foot'])
  })

  it('reads a racer pressing into the side as side, and one beside it without pressing as nothing', () => {
    expect(contacts({ x: 1.7, y: 0.1, vx: -6, vy: 0 })).toEqual([{ kind: 'side', floor: 3 }])
    expect(contacts({ x: -1.7, y: 0.1, vx: 6, vy: 0 })).toEqual([{ kind: 'side', floor: 3 }])
    expect(contacts({ x: 1.7, y: 0.1, vx: 0, vy: 0 })).toEqual([])
    expect(contacts({ x: 1.7, y: 0.1, vx: 6, vy: 0 })).toEqual([])
  })

  it('measures the side approach against a moving floor', () => {
    // The floor moves right at 2 m/s into a still racer on its right: the racer is approached.
    expect(contacts({ x: 1.7, y: 0.1, vx: 0, vy: 0 }, [{ ...floor, vx: 2 }])).toEqual([
      { kind: 'side', floor: 3 },
    ])
  })

  it('reads a racer rising into the floor from below as underside', () => {
    expect(contacts({ x: 0, y: -0.7, vx: 0, vy: 5 })).toEqual([{ kind: 'underside', floor: 3 }])
    expect(contacts({ x: 0, y: -0.7, vx: 0, vy: -1 })).toEqual([])
  })

  it('touches within the tolerance and not beyond it', () => {
    expect(contacts({ x: 1.7 + CONTACT_TOLERANCE * 0.9, y: 0.1, vx: -6, vy: 0 })).toHaveLength(1)
    expect(contacts({ x: 1.7 + CONTACT_TOLERANCE * 2, y: 0.1, vx: -6, vy: 0 })).toEqual([])
  })

  it('credits the foot band, a floor-high band at the racer bottom, without a solid contact', () => {
    // Rising through the floor's top half: the feet overlap it, the body is moving away from the top.
    expect(contacts({ x: 0, y: 0.6, vx: 0, vy: 7 })).toEqual([{ kind: 'foot', floor: 3 }])
  })

  it('sorts by floor index, then top, side, underside, foot', () => {
    const above = { index: 4, x: 0, y: 1.4, vx: 0 }
    expect(contacts({ x: 0, y: 0.7, vx: 0, vy: 1 }, [above, floor])).toEqual([
      { kind: 'top', floor: 3 },
      { kind: 'foot', floor: 3 },
      { kind: 'underside', floor: 4 },
    ])
  })
})
