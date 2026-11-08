import { type AgentDef, SystemsPursuit } from '@automata/systems/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { CELL, createPatrol2d, type Patrol2d, runPatrol2dGolden } from '#src/testing/patrol-2d.ts'

// Enemy behaviour in a 2D level, through the real systems: the level is 12 cells by 6, a Hall on the left and a Yard on the
// right, a wall between them one cell thick with a two-cell gap, and a guard who patrols the Hall. One metre is one 16 px
// cell, so a guard at a metre a second walks 16 px a second.

let game: Patrol2d | undefined
afterEach(() => {
  game?.sim.dispose()
  game = undefined
})
const open = async (guardAt?: { x: number; z: number }): Promise<Patrol2d> => {
  game = await createPatrol2d(guardAt)
  return game
}

describe('systems in a 2D level', () => {
  it('patrols its points, which are in metres, at its metres a second times the cell in pixels (Review Focus 7)', async () => {
    const g = await open()
    g.run(1) // settles on its first stop
    const before = g.guardPx()
    g.run(1)
    const after = g.guardPx()
    // The patrol speed is 1 m/s, so a second is one cell.
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeCloseTo(CELL, 0)
    expect(g.mode()).toBe('patrol')
  })

  it('sees the player across open cells', async () => {
    const g = await open()
    g.putPlayer(3.5, 3)
    g.run(0.1)
    expect(g.mode()).toBe('hunt')
  })

  it('loses the player behind a solid cell', async () => {
    const g = await open({ x: 5, z: 0.5 })
    g.putPlayer(8, 0.5) // the wall's cells are at x 6 to 7, rows 0 and 1
    g.run(0.5)
    expect(g.mode()).toBe('patrol')
  })

  // Schematic says "Walls and closed doors block its view" and offers no setting: in this game's places sight is the
  // walking query, so a solid cell blocks it whatever `wallsOnly` says.
  it.each([
    ['leaves wallsOnly out', undefined],
    ['says wallsOnly is true', true],
    ['says wallsOnly is false', false],
  ] as const)(
    'a guard that %s is blocked by a solid cell and sees across open ones',
    async (_, wallsOnly) => {
      const sight = wallsOnly === undefined ? { range: 4.5 } : { range: 4.5, wallsOnly }
      const agent: AgentDef = {
        id: 'guard',
        modes: ['stand', 'seen'],
        initial: 'stand',
        speed: { stand: 0, seen: 0 },
        senses: [{ sight }],
        transitions: [{ from: 'stand', to: 'seen', when: [{ sees: true }], priority: 10, do: [] }],
      }
      const behind = await createPatrol2d({ x: 5, z: 0.5 }, { agent })
      try {
        behind.putPlayer(8, 0.5) // the wall's cells are at x 6 to 7, rows 0 and 1
        behind.run(0.5)
        expect(behind.mode()).toBe('stand')
      } finally {
        behind.sim.dispose()
      }
      const across = await createPatrol2d({ x: 2, z: 3 }, { agent })
      try {
        across.putPlayer(4.5, 3)
        across.run(0.5)
        expect(across.mode()).toBe('seen')
      } finally {
        across.sim.dispose()
      }
    },
  )

  it('follows the player through the gap, into the touching area', async () => {
    const g = await open()
    g.putPlayer(4, 3)
    g.run(0.1)
    expect(g.mode()).toBe('hunt')
    g.walkPlayerTo(9, 3)
    g.run(12)
    expect(g.areaOf('player')).toBe('yard')
    expect(g.areaOf('guard')).toBe('yard')
    // He got there by the contract's edge: the middle of the wall the Hall and the Yard share.
    expect(g.sim.resource(SystemsPursuit).last).toMatchObject({ portal: 'hall>yard', x: 6, z: 3 })
  })

  it('does the same thing every run, whole or restored from a snapshot into a new sim', async () => {
    const whole = await runPatrol2dGolden()
    expect(await runPatrol2dGolden(200)).toEqual(whole)
    expect(whole.eventCount).toBeGreaterThanOrEqual(3) // not vacuous: hunts, follows, hunts again
    expect(whole.hunts).toBeGreaterThan(0)
    expect(whole.follows).toBeGreaterThan(whole.hunts)
  })
})
