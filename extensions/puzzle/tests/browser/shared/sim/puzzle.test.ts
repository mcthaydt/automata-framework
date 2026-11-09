// The puzzle golden (M6 spec §4.9): the clinic played by a fixed verb script hashes to one committed value in Node,
// Chromium, WebKit and Firefox, straight and restored at step 300. A mismatch is investigated, never rebaselined.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runPuzzleGolden } from '#src/testing/verb-script.ts'

test('puzzle: 600 steps of verbs on the clinic, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runPuzzleGolden()
  const restored = await runPuzzleGolden(300)
  expect(straight.eventCount).toBeGreaterThan(50) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'puzzle/clinic-verbs', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: 'cd73a8d0b545c212',
  events: 'c68abe4a8668112f',
  eventCount: 621,
}
