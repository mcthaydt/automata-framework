import { recordGoldenEvidence } from '@automataframework/evidence/golden'
import { expect, it } from 'vitest'
import { GOLDEN_GOAL_TICK, GOLDEN_HASH } from '#src/testing/golden.ts'
import { runGolden } from '#src/testing/golden-run.ts'

// The same run as golden.test.ts, in Chromium, WebKit and Firefox: the hash must match Node's bit for bit. The node
// project runs this file too, so it records the evidence file's hash for all four engines (DX.9).
it('the golden route ends on the recorded hash in this browser', async ({ task }) => {
  const result = await runGolden()
  expect(result.goalTicks).toEqual([GOLDEN_GOAL_TICK])
  expect(result.hash).toBe(GOLDEN_HASH)
  // The hash this engine computed, for the evidence file (DX.9).
  const { seed, ticks, hash } = result
  recordGoldenEvidence(task, { scenario: 'emberwick/golden-route', seed, ticks, hash })
})
