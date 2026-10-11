import { expect, test } from 'vitest'
import { runScene } from './testing/run-scene'
import { createScene3D, sceneCommands } from './testing/scene-3d'

// M2.1 spec §7: the mixed 3D scene hashes to one committed golden in Node, Chromium, WebKit and Firefox, with
// and without a restore at tick 150. A mismatch is investigated, never rebaselined per engine.
test('3D physics: 300 ticks, straight and restored at 150, match the golden in every engine', async () => {
  const commands = sceneCommands
  const straight = await runScene(createScene3D, commands, 300)
  const restored = await runScene(createScene3D, commands, 300, 150)
  expect(straight.eventCount).toBeGreaterThan(10) // not vacuous
  expect(restored).toEqual(straight)
  expect(straight).toEqual(EXPECTED)
})

// Recorded from Node 24 on 2026-10-11, then confirmed unchanged in Chromium, WebKit and Firefox.
const EXPECTED = { hash: '580a47f5c068b59f', events: 'edfd8f5d5412b6b3', eventCount: 158 }
