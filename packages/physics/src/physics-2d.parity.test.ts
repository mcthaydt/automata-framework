import { expect, test } from 'vitest'
import { runScene } from './testing/run-scene'
import { createScene2D, sceneCommands2D } from './testing/scene-2d'

// M2.1 spec §7: the mixed 2D scene hashes to one committed golden in Node, Chromium, WebKit and Firefox, with
// and without a restore at tick 150. A mismatch is investigated, never rebaselined per engine.
test('2D physics: 300 ticks, straight and restored at 150, match the golden in every engine', async () => {
  const commands = sceneCommands2D
  const straight = await runScene(createScene2D, commands, 300)
  const restored = await runScene(createScene2D, commands, 300, 150)
  expect(straight.eventCount).toBeGreaterThan(10) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
})

// Recorded from Node 24 on 2026-10-11, then confirmed unchanged in Chromium, WebKit and Firefox. Re-recorded
// once for the audit fixes: physics bytes v2 carry contacts, events are paired and ended-first, and the scene
// now makes component edits.
const EXPECTED = { hash: '3aae6703654193a0', events: '34b4ae01d937afca', eventCount: 463 }
