import { BodyKind, RigidBody2D } from '@mcthaydt/automata-physics/2d'
import type { Sim } from '@mcthaydt/automata-sim'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { expect, test } from 'vitest'
import { PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { PLACEHOLDER_COURSE_HASH, SCRIPTED_RACE } from '../testing/goldens'
import { runScriptedRace } from '../testing/scripted-race'
import { createCourse } from './course.generator'
import { Racer } from './racer.component'

// PRODUCT.8b's acceptance: the scripted four-player race hashes to one committed golden in Node, Chromium, WebKit and
// Firefox, straight and restored from a snapshot at several points mid-race, and the course generator's seeded output
// is pinned in each. A mismatch is investigated, never rebaselined per engine.

/**
 * Restore points and how many racers must be in the step there: seat 1's dash in the air (120), racers riding the
 * middle floors (230), the end-of-lap hold where most racers are parked (260), the run-in to the finish (470).
 */
const RESTORE_AT = [
  { tick: 120, moving: 3 },
  { tick: 230, moving: 3 },
  { tick: 260, moving: 0 },
  { tick: 470, moving: 3 },
]

/** Racers the step is moving when the sim is restored: a restore with every racer parked would prove little. */
const inMotion = (sim: Sim): number =>
  sim.query(Racer, RigidBody2D).filter((racer) => racer.get(RigidBody2D).kind === BodyKind.dynamic).length

test('the placeholder course matches its golden in every engine', () => {
  const course = createCourse(PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING)
  expect(hex64(xxhash64(utf8(canonicalJson(course))))).toBe(PLACEHOLDER_COURSE_HASH)
})

test('the scripted four-player race, straight and restored mid-race, matches the golden in every engine', async ({
  task,
}) => {
  const straight = await runScriptedRace()
  // Not vacuous: the race finished, and on the way it landed, lapped, fell, reset and wrapped.
  for (const [what, count] of Object.entries(straight.coverage)) expect(count, what).toBeGreaterThan(0)
  for (const { tick, moving: minimum } of RESTORE_AT) {
    let moving = 0
    const restored = await runScriptedRace(tick, (sim) => {
      moving = inMotion(sim)
    })
    expect(moving, `racers in motion at the restore at ${tick}`).toBeGreaterThanOrEqual(minimum)
    expect(restored, `restored at ${tick}`).toEqual(straight)
  }
  expect(straight).toEqual(SCRIPTED_RACE)
  const { ticks, hash } = straight
  recordGoldenEvidence(task, {
    scenario: 'party-racer/scripted-race',
    seed: PLACEHOLDER_COURSE_SEED,
    ticks,
    hash,
  })
})
