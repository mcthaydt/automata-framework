// Exit 4 on the physics scenes (M2.3 spec §7): snapshot -> restore -> continue equals the straight run over 200
// cases each, in 2D and 3D, restoring both into a fresh sim and into one that has moved on. About 15 s and 19 s
// in Node on a cloud container (2026-10-11); under the 60 s the spec allows before a project of their own.
import { snapshotRoundTripProperty } from '@automata/sim/testing/property'
import { expect, test } from 'vitest'
import { sceneCommands2D, scenePlugins2D, spawnScene2D } from '#src/testing/scene-2d.ts'
import { sceneCommands, scenePlugins3D, spawnScene3D } from '#src/testing/scene-3d.ts'

test('2D scene: 200 snapshot round trips equal the straight run', async () => {
  const { failures } = await snapshotRoundTripProperty({
    plugins: scenePlugins2D(),
    setup: (sim) => spawnScene2D(sim),
    script: (tick) => sceneCommands2D(tick),
  })
  expect(failures.map((f) => f.report)).toEqual([])
}, 300_000)

test('3D scene: 200 snapshot round trips equal the straight run', async () => {
  const { failures } = await snapshotRoundTripProperty({
    plugins: scenePlugins3D(),
    setup: (sim) => spawnScene3D(sim),
    script: (tick) => sceneCommands(tick),
  })
  expect(failures.map((f) => f.report)).toEqual([])
}, 300_000)
