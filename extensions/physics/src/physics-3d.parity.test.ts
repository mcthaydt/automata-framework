import { recordGoldenEvidence } from '@automata/evidence/golden'
import { expect, test } from 'vitest'
import { runScene } from './testing/run-scene'
import { createScene3D, sceneCommands } from './testing/scene-3d'

// M2.1 spec §7: the mixed 3D scene hashes to one committed golden in Node, Chromium, WebKit and Firefox, with
// and without a restore at tick 150. A mismatch is investigated, never rebaselined per engine.
test('3D physics: 300 ticks, straight and restored at 150, match the golden in every engine', async ({
  task,
}) => {
  const commands = sceneCommands
  const straight = await runScene(createScene3D, commands, 300)
  const restored = await runScene(createScene3D, commands, 300, 150)
  expect(straight.eventCount).toBeGreaterThan(10) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
  // The hash this engine computed, for the evidence file (DX.9).
  const { seed, ticks, hash } = straight
  recordGoldenEvidence(task, { scenario: 'physics/scene-3d', seed, ticks, hash })
})

// Recorded from Node 24 on 2026-10-11, then confirmed unchanged in Chromium, WebKit and Firefox. Re-recorded
// once for the audit fixes: physics bytes v2 carry contacts, events are paired and ended-first, and the scene
// now makes component edits and has a tilted lone ramp; gravity joined the schema hash (spec §10.8).
const EXPECTED = {
  seed: 2026,
  ticks: 300,
  hash: '5ab771a640ac4b78',
  events: '770efcd4f89ac854',
  eventCount: 194,
}
