import { describe, expect, it } from 'vitest'
import { obstaclesOf } from '#src/features/room/obstacles.ts'
import { WORLD } from '#src/features/room/room.ts'

// The blockout owns a prop's footprint: what stands on the floor stops Ada, and the footprint is the box of the prop's drawn
// parts, found from the level. What hangs on a wall, sits on a desk or stands on a shelf does not.

const obstacles = obstaclesOf(WORLD.pieces)
const byId = (id: string) => obstacles.find((obstacle) => obstacle.id === id)

describe('the footprints of the ward’s props', () => {
  it('gives a floor prop the box of its blockout on the plan', () => {
    // The bed's drawn parts, measured on the built level: -4.65 to -3.55 across, -0.68 to 1.48 down the plan.
    const bed = byId('bed')
    expect(bed).toBeDefined()
    expect(bed?.x0).toBeCloseTo(-4.65, 1)
    expect(bed?.x1).toBeCloseTo(-3.55, 1)
    expect(bed?.z0).toBeCloseTo(-0.68, 1)
    expect(bed?.z1).toBeCloseTo(1.48, 1)
  })

  it('gives every floor-standing piece of furniture one', () => {
    for (const id of [
      'bench',
      'wheelchair',
      'trolley',
      'gurney',
      'nightstand',
      'filing-1',
      'drawers',
      'water-cooler',
    ])
      expect(byId(id), id).toBeDefined()
  })

  // The old hall has papers dropped about its floor (`dress.ts` at 92e6704, seven of them): a walker steps over a sheet.
  it('gives none to a sheet of paper lying on the floor', () => {
    for (let i = 1; i <= 7; i++) {
      expect(
        WORLD.props.some((prop) => prop.id === `floor-paper-${i}`),
        `floor-paper-${i} is in the level`,
      ).toBe(true)
      expect(byId(`floor-paper-${i}`), `floor-paper-${i}`).toBeUndefined()
    }
  })

  it('gives none to what is on a wall, a desk, a shelf or the ceiling', () => {
    for (const id of [
      'clock',
      'wall-tv',
      'key-cabinet',
      'desk-lamp',
      'ledger',
      'pendant-lamp',
      'strip-light-1',
      'stock-boxes-1',
      'stock-canisters-2',
    ])
      expect(byId(id), id).toBeUndefined()
  })

  it('is rounded to a millimetre, so every engine reads the same box', () => {
    for (const { x0, z0, x1, z1 } of obstacles)
      for (const value of [x0, z0, x1, z1]) expect(Math.round(value * 1000) / 1000).toBe(value)
  })
})
