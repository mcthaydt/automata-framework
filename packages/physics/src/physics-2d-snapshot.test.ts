import { expect, test } from 'vitest'
import { runScene } from './testing/run-scene'
import { createScene2D, sceneCommands2D } from './testing/scene-2d'

test('2D: a restore at tick 150 continues identically to the straight run (state and events)', async () => {
  const straight = await runScene(createScene2D, sceneCommands2D, 300)
  const restored = await runScene(createScene2D, sceneCommands2D, 300, 150)
  expect(straight.eventCount).toBeGreaterThan(0)
  expect(restored).toEqual(straight)
})
