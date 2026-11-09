import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runScene } from '#src/testing/run-scene.ts'
import { createScene2D, sceneCommands2D } from '#src/testing/scene-2d.ts'

// M2.1 spec §7: the mixed 2D scene hashes to one committed golden in Node, Chromium, WebKit and Firefox, with
// and without a restore at tick 150. A mismatch is investigated, never rebaselined per engine.
test('2D physics: 300 ticks, straight and restored at 150, match the golden in every engine', async ({
  task,
}) => {
  const commands = sceneCommands2D
  const straight = await runScene(createScene2D, commands, 300)
  const restored = await runScene(createScene2D, commands, 300, 150)
  expect(straight.eventCount).toBeGreaterThan(10) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  // The hash this engine computed, for the evidence file (DX.9).
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'physics/scene-2d', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-11, then confirmed unchanged in Chromium, WebKit and Firefox. Re-recorded
// once for the audit fixes: physics bytes v2 carry contacts, events are paired and ended-first, and the scene
// now makes component edits and has a tilted lone ramp; gravity joined the schema hash (spec §10.8).
const EXPECTED = {
  seed: 2026,
  ticks: 300,
  hash: '46042079c99bfdf1',
  events: '4fc381ee4c45b8dd',
  eventCount: 470,
}
