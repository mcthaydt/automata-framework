import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { expect, test } from 'vitest'
import { PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { PLACEHOLDER_COURSE_HASH, SCRIPTED_RACE } from '../testing/goldens'
import { runScriptedRace } from '../testing/scripted-race'
import { createCourse } from './course.generator'

// PRODUCT.8b's acceptance: the scripted four-player race hashes to one committed golden in Node, Chromium, WebKit and
// Firefox, straight and restored from a snapshot mid-race, and the course generator's seeded output is pinned in each.
// A mismatch is investigated, never rebaselined per engine.

test('the placeholder course matches its golden in every engine', () => {
  const course = createCourse(PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING)
  expect(hex64(xxhash64(utf8(canonicalJson(course))))).toBe(PLACEHOLDER_COURSE_HASH)
})

test('the scripted four-player race, straight and restored at 260, matches the golden in every engine', async ({
  task,
}) => {
  const straight = await runScriptedRace()
  const restored = await runScriptedRace(260)
  expect(straight.winner).toBeGreaterThanOrEqual(0) // the race finished: not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(SCRIPTED_RACE)
  const { ticks, hash } = straight
  recordGoldenEvidence(task, {
    scenario: 'party-racer/scripted-race',
    seed: PLACEHOLDER_COURSE_SEED,
    ticks,
    hash,
  })
})
