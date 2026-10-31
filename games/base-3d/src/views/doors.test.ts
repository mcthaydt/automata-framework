// The doors' markers (G3-r, DESIGN.md §6.5, GAME-3D.1f part 5): each kind says what opens it. A small-key door shows a
// keyhole plate, the boss door a large one, a clear-room door bars, and a switch door a link drawn on the floor to its
// switch; a plain door is a bare slab. Review images: docs/evidence/owner-visual/2026-10-31-game-3d-1f-doors/.
import { describe, expect, it } from 'vitest'
import { type DoorPart, doorParts } from './doors.ts'

/** A doorway 2 m wide across x at z = 4, 0.3 m deep. */
const box = { minX: -1, minZ: 3.85, maxX: 1, maxZ: 4.15 }
const roles = (parts: readonly DoorPart[]) => [...new Set(parts.map((part) => part.role))].sort()
const size = (part: DoorPart | undefined, axis: 0 | 1 | 2) =>
  part === undefined ? 0 : part.max[axis] - part.min[axis]

describe('doorParts (G3-r)', () => {
  it('draws each lock kind with its own marker on the slab', () => {
    expect(roles(doorParts({ ...box, lock: 'none' }))).toEqual(['slab'])
    expect(roles(doorParts({ ...box, lock: 'small-key' }))).toEqual(['keyhole', 'slab'])
    expect(roles(doorParts({ ...box, lock: 'boss-key' }))).toEqual(['boss-plate', 'slab'])
    expect(roles(doorParts({ ...box, lock: 'clear' }))).toEqual(['bar', 'slab'])
    expect(roles(doorParts({ ...box, lock: 'switch', link: { x: -3, z: 2 } }))).toEqual(['link', 'slab'])
  })

  it('fills the doorway with the slab, floor to lintel', () => {
    const [slab] = doorParts({ ...box, lock: 'none' })
    expect(slab).toMatchObject({ min: [-1, 0, 3.85], max: [1, 2.2, 4.15] })
  })

  it('puts a keyhole plate on both faces at hand height, and the boss plate larger', () => {
    const keyholes = doorParts({ ...box, lock: 'small-key' }).filter((part) => part.role === 'keyhole')
    expect(keyholes).toHaveLength(2)
    for (const plate of keyholes) expect((plate.min[1] + plate.max[1]) / 2).toBeCloseTo(1.2)
    // One proud of each face of the slab.
    expect(keyholes.map((plate) => plate.max[2] > 4.15 || plate.min[2] < 3.85)).toEqual([true, true])
    const boss = doorParts({ ...box, lock: 'boss-key' }).find((part) => part.role === 'boss-plate')
    expect(size(boss, 0)).toBeGreaterThan(2 * size(keyholes[0], 0))
    expect(size(boss, 1)).toBeGreaterThan(2 * size(keyholes[0], 1))
  })

  it('stands three bars across a clear door, evenly, floor to lintel', () => {
    const bars = doorParts({ ...box, lock: 'clear' }).filter((part) => part.role === 'bar')
    expect(bars.map((bar) => (bar.min[0] + bar.max[0]) / 2)).toEqual([-0.5, 0, 0.5])
    for (const bar of bars) expect(bar).toMatchObject({ min: [expect.any(Number), 0, expect.any(Number)] })
  })

  it('runs a switch door’s link along the floor from its foot to the switch, one leg per axis', () => {
    const link = doorParts({ ...box, lock: 'switch', link: { x: -3, z: 2 } }).filter(
      (part) => part.role === 'link',
    )
    expect(link).toHaveLength(2)
    for (const leg of link) expect(leg.max[1]).toBeLessThanOrEqual(0.05)
    // From the door's middle (0, 4) along z to z = 2, then along x to x = −3.
    expect(Math.min(...link.map((leg) => leg.min[0]))).toBeCloseTo(-3 - 0.05)
    expect(Math.min(...link.map((leg) => leg.min[2]))).toBeCloseTo(2 - 0.05)
    expect(Math.max(...link.map((leg) => leg.max[2]))).toBeCloseTo(4 + 0.05)
  })

  it('gives each kind’s marker its own colour', () => {
    const colour = (lock: Parameters<typeof doorParts>[0]['lock']) =>
      doorParts({ ...box, lock, link: { x: 0, z: 0 } }).find((part) => part.role !== 'slab')?.colour
    const colours = [colour('small-key'), colour('boss-key'), colour('clear'), colour('switch')]
    expect(new Set(colours).size).toBe(4)
  })
})
