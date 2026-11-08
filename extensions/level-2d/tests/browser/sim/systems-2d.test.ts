// The 2D systems golden: a guard on a flat level (the Hall, a wall with a gap, the Yard) hunts the player and follows through the
// gap; 600 steps hash to one committed value in Node, Chromium, WebKit and Firefox, straight and restored from a snapshot
// at step 200. A mismatch is investigated, never rebaselined.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runPatrol2dGolden } from '#src/testing/patrol-2d.ts'

test('level-2d: 600 steps of a guard on a flat level, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runPatrol2dGolden()
  const restored = await runPatrol2dGolden(200)
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'level-2d/guard-patrol', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-11-08; confirmed unchanged in Chromium (WebKit and Firefox run in the parity job).
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: 'de5df42656c162d7',
  events: '2de9cdc012815412',
  eventCount: 3,
  hunts: 60,
  follows: 131,
}
