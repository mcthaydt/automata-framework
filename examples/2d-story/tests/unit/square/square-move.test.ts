import { createSim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { Move } from '#src/features/square/move.command.ts'
import { squarePlugin } from '#src/features/square/square.plugin.ts'
import { SPEED, SQUARE_SIZE } from '#src/shared/constants.ts'
import { Hero } from '#src/shared/hero.component.ts'
import { LEVEL } from '#src/shared/level/level.ts'
import { Square } from '#src/shared/square.component.ts'

// The sim is plain code, so its test needs no browser: make a sim on the level, send it commands, read what it holds.
const OPEN = { x: 100, y: 50 }
const ON_THE_START = { x: LEVEL.start.x, y: LEVEL.start.y - SQUARE_SIZE / 2 }

async function squareAfter(moves: readonly { x?: number; y?: number }[], from = OPEN) {
  const sim = await createSim({ seed: 1, tickHz: 60, plugins: [squarePlugin], content: LEVEL })
  sim.spawn([
    [Square, from],
    [Hero, { frozen: false }],
  ])
  for (const payload of moves)
    sim.step([
      { tick: sim.tick, source: 0, seq: sim.tick, type: Move.id, payload: { x: 0, y: 0, ...payload } },
    ])
  const [square] = sim.query(Square)
  const result = { position: square?.get(Square), hash: sim.hash() }
  sim.dispose()
  return result
}

describe('2D Story: the square', () => {
  it('moves one step in the direction the player holds', async () => {
    const { position } = await squareAfter([{ x: 1 }])
    expect(position).toEqual({ x: OPEN.x + SPEED, y: OPEN.y })
  })

  it('stays put when the player holds nothing', async () => {
    const { position } = await squareAfter([{}])
    expect(position).toEqual(OPEN)
  })

  it('stops at the floor', async () => {
    const { position } = await squareAfter([{ y: 1 }, { y: 1 }], ON_THE_START)
    expect(position).toEqual(ON_THE_START)
  })

  it('ends in the same state every time the same moves are played', async () => {
    const moves = [{ x: 1 }, { y: -1 }, { x: -1, y: 1 }]
    expect((await squareAfter(moves)).hash).toBe((await squareAfter(moves)).hash)
  })
})
