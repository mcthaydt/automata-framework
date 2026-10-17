import { expectGolden, replayGolden } from '@mcthaydt/automata-testing/sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { expect, it } from 'vitest'
import { bodiesSimSetup } from './bodies-sim.ts'
import { GOLDEN_HASH, runGolden } from './golden.ts'

// The same run as golden.test.ts, in Chromium, WebKit and Firefox: the hash must match Node's bit for bit.
it('the golden run ends on the recorded hash in this browser', async ({ task }) => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  expect(result.hash).toBe(GOLDEN_HASH)
  // The hash this engine computed, for the evidence file (DX.9).
  const { seed, ticks, hash } = result
  recordGoldenEvidence(task, { scenario: 'physics-bodies-2d/golden-run', seed, ticks, hash })
})

it('bodies.replay replays tick for tick in this browser', async () => {
  const { plugins, content } = bodiesSimSetup()
  const report = await replayGolden({ file: './__goldens__/bodies.replay', plugins, content })
  expectGolden(report)
  expect(report.kind).toBe('pass')
})
