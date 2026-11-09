import { createSim, type PluginDef, type Sim } from '@automata/sim'
import { afterEach, expect, test } from 'vitest'
import { body2d, collider2d, physics2d, transform2d } from '#src/entries/2d.ts'
import { BodyKind, body3d, collider3d, physics3d, transform3d } from '#src/entries/3d.ts'

// Gravity is hashed when the factory runs (spec §10.8), so the factory copies and freezes it: a caller that
// mutates its own gravity object afterwards must not change what the sim runs with (audit re-check at 4d9e6f4).

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

async function fallFor10Ticks(plugin: PluginDef, dimension: '2d' | '3d'): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: [plugin] })
  sims.push(sim)
  if (dimension === '3d') sim.spawn([transform3d({ y: 3 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  else sim.spawn([transform2d({ y: 3 }), body2d(BodyKind.dynamic), collider2d.ball(0.5)])
  for (let t = 0; t < 10; t++) sim.step([])
  return sim
}

test('3D: mutating the gravity object after physics3d() changes neither the sim nor its hash', async () => {
  const gravity = { x: 0, y: -9.81, z: 0 }
  const plugin = physics3d({ gravity })
  gravity.y = 0
  const mutated = await fallFor10Ticks(plugin, '3d')
  const reference = await fallFor10Ticks(physics3d(), '3d')
  expect(mutated.hash()).toBe(reference.hash())
})

test('2D: mutating the gravity object after physics2d() changes neither the sim nor its hash', async () => {
  const gravity = { x: 0, y: -9.81 }
  const plugin = physics2d({ gravity })
  gravity.y = 0
  const mutated = await fallFor10Ticks(plugin, '2d')
  const reference = await fallFor10Ticks(physics2d(), '2d')
  expect(mutated.hash()).toBe(reference.hash())
})

test('-0 and 0 gravity are the same schema, since Rapier runs them identically (audit nit)', async () => {
  const negative = await fallFor10Ticks(physics3d({ gravity: { x: -0, y: -9.81, z: -0 } }), '3d')
  const positive = await fallFor10Ticks(physics3d(), '3d')
  positive.restore(negative.snapshot())
  expect(positive.hash()).toBe(negative.hash())
  const negative2d = await fallFor10Ticks(physics2d({ gravity: { x: -0, y: -9.81 } }), '2d')
  const positive2d = await fallFor10Ticks(physics2d(), '2d')
  positive2d.restore(negative2d.snapshot())
  expect(positive2d.hash()).toBe(negative2d.hash())
})
