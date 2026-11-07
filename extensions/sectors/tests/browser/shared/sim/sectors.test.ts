// The sectors golden: the walkers script hashes to one committed value in Node, Chromium, WebKit and
// Firefox, straight and restored at step 450. A mismatch is investigated, never rebaselined per engine.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runGolden } from '#src/testing/golden-script.ts'

test('sectors: 600 steps of walkers and a scene change, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runGolden()
  const restored = await runGolden(450)
  expect(straight.eventCount).toBeGreaterThan(20) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'sectors/walkers', seed, ticks, hash })
})

test('sectors with physics: the same script with collider boxes matches its golden', async ({ task }) => {
  const straight = await runGolden(undefined, { physics: true })
  const restored = await runGolden(450, { physics: true })
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED_PHYSICS)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'sectors/walkers-physics', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox. The events are the
// plain run's: the boxes change the state, not what the walkers do.
const EXPECTED_PHYSICS = {
  seed: 2026,
  ticks: 600,
  hash: 'a1d684b93a0dacc6',
  events: 'e72945926e02b3ad',
  eventCount: 50,
}

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: '8ed8ca2ef8c3b55c',
  events: 'e72945926e02b3ad',
  eventCount: 50,
}
