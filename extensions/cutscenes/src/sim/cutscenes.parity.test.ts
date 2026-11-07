// The cutscenes golden (M6 spec §4.9, CS-a, X-b): 600 steps of cutscenes started in turn, input sent throughout and skips
// now and then hash to one committed value in Node, Chromium, WebKit and Firefox, straight and restored at step 300. A
// mismatch is investigated, never rebaselined.
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runCutsceneGolden } from '../testing/cut-script'

test('cutscenes: 600 steps of the clinic’s scripts, straight and restored, match the golden', async ({
  task,
}) => {
  const straight = await runCutsceneGolden()
  const restored = await runCutsceneGolden(300)
  // Not vacuous: cutscenes started, ended played out and skipped, some input was ignored and some was taken.
  expect(straight.started).toBeGreaterThanOrEqual(5)
  expect(straight.ended).toBeGreaterThanOrEqual(5)
  expect(straight.hits).toBeGreaterThan(0)
  expect(straight.hits).toBeLessThan(TICKS / 5)
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'cutscenes/clinic-scripts', seed, ticks, hash })
})

const TICKS = 600
// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: '9347cb3f5d5d978e',
  events: '1393abf2f96abd27',
  eventCount: 22,
  started: 11,
  ended: 11,
  hits: 14,
}
