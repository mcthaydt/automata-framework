// The systems golden: the toy watchman's patrol on the clinic hashes to one committed value in
// Node, Chromium, WebKit and Firefox, straight and restored at step 300, and his patrol → hunt switch falls on the same
// step in all four. A mismatch is investigated, never rebaselined.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runSystemsGolden } from '#src/testing/patrol-script.ts'

test('systems: 600 steps of the watchman on the clinic, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runSystemsGolden()
  const restored = await runSystemsGolden(300)
  expect(straight.eventCount).toBeGreaterThan(20) // not vacuous: the noise, his modes, the catch
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'systems/clinic-watchman', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: '8ec637bd430ca3de',
  events: '8c0c735f6411f312',
  eventCount: 160,
  hunts: 380,
}
