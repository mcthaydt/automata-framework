import { expect, it } from 'vitest'
import { GOLDEN_GOAL_TICK, GOLDEN_HASH } from './golden.ts'
import { runGolden } from './golden-run.ts'

// The same run as golden.test.ts, in Chromium, WebKit and Firefox: the hash must match Node's bit for bit.
it('the golden route ends on the recorded hash in this browser', async () => {
  const result = await runGolden()
  expect(result.goalTicks).toEqual([GOLDEN_GOAL_TICK])
  expect(result.hash).toBe(GOLDEN_HASH)
})
