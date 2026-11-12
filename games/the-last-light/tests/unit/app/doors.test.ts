import { NavDoors } from '@automata/nav/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { describe, expect, it } from 'vitest'
import { boot } from '#src/testing/harness.ts'

// The supply room's door is the walk's door `closetDoor`, open when the puzzle fact `closetOpen` is true.

describe('the supply room’s door', () => {
  it('is shut to the walk until the puzzle opens it, and then open', async () => {
    const game = await boot()
    expect(game.sim.resource(NavDoors).open.closetDoor).toBe(false)
    game.sim.resource(PuzzleState).facts.closetOpen = true
    game.hold(0.1)
    expect(game.sim.resource(NavDoors).open.closetDoor).toBe(true)
  })
})
