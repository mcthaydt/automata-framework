import { expect, it } from 'vitest'
import { GOLDEN_GOAL_TICK, GOLDEN_HASH } from './golden.ts'
import { runGolden } from './golden-run.ts'

it('the golden route reaches the goal on the recorded tick and ends on the recorded hash', async () => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  expect(result.goalTicks).toEqual([GOLDEN_GOAL_TICK])
  expect(result.hash).toBe(GOLDEN_HASH)
})

it('replays to the same hash twice in one engine', async () => {
  const first = await runGolden()
  const second = await runGolden()
  expect(second.hash).toBe(first.hash)
})
