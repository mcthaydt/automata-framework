import { expect, it } from 'vitest'
import { moveCommand } from './base-sim.ts'
import { GOLDEN_GOAL_TICK, GOLDEN_HASH } from './golden.ts'
import { runGolden } from './golden-run.ts'

// The golden route replayed through the game `startGame` runs (game.ts): its sim spec and its input map, fed
// the route as key presses. The hash is the one recorded before Emberwick moved onto `startGame` (DX.3).
it('the golden route reaches the goal on the recorded tick and ends on the recorded hash', async () => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  expect(result.goalTicks).toEqual([GOLDEN_GOAL_TICK])
  expect(result.hash).toBe(GOLDEN_HASH)
})

it('sends the move command the hand-written wiring sent, every tick', async () => {
  const result = await runGolden()
  const expected = result.inputs.map((input, tick) => moveCommand({ tick } as never, input))
  expect(result.commands).toEqual(expected)
})

it('replays to the same hash twice in one engine', async () => {
  const first = await runGolden()
  const second = await runGolden()
  expect(second.hash).toBe(first.hash)
})
