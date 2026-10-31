// The nav golden (M6 spec §4.9, N-a): three clinic walkers hash to one committed value in Node, Chromium, WebKit and
// Firefox, straight and restored at step 300, and one route's points are pinned. A mismatch is investigated, never
// rebaselined.
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { expect, test } from 'vitest'
import { clinicBlocked, clinicGraph, resolvedClinic } from '../testing/clinic'
import { runNavGolden } from '../testing/walk-script'
import { route } from './route'

test('nav: 600 steps of three clinic walkers, straight and restored, match the golden', async ({ task }) => {
  const straight = await runNavGolden()
  const restored = await runNavGolden(300)
  expect(straight.eventCount).toBeGreaterThanOrEqual(5) // not vacuous: arrivals and the unreachable try
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'nav/clinic-walkers', seed, ticks, hash })
})

test('N-a: the ward-to-corridor route is the same points in every engine', () => {
  const blocked = clinicBlocked(resolvedClinic(), { closetDoor: false })
  expect(route({ x: -3, z: 3 }, { x: 0, z: -5 }, clinicGraph(), blocked)).toEqual(WARD_TO_CORRIDOR)
})

// Recorded from Node 24 on 2026-10-31, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = {
  seed: 2026,
  ticks: 600,
  hash: 'f890d0c1a042d8ab',
  events: '26459d9780a85a2c',
  eventCount: 20,
}
const WARD_TO_CORRIDOR = [
  { x: 0, z: 0.3 },
  { x: 0, z: -1.9 },
  { x: 0.3, z: -4 },
  { x: 0, z: -5 },
]
