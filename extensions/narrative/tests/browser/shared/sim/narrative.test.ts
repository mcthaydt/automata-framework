// The narrative golden: the clinic's conversations and storylets, played by a fixed script, hash to one
// committed value in Node, Chromium, WebKit and Firefox, straight and restored at step 300. A mismatch is investigated,
// never rebaselined.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runNarrativeGolden } from '#src/testing/talk-script.ts'

test('narrative: 600 steps of talk on the clinic, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runNarrativeGolden()
  const restored = await runNarrativeGolden(300)
  expect(straight.eventCount).toBeGreaterThan(50) // not vacuous
  expect(straight.storylets).toBeGreaterThan(2)
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'narrative/clinic-talk', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: 'f07b6a56c0f4182b',
  events: '50cfecbe4dd669d4',
  eventCount: 94,
  storylets: 9,
}
