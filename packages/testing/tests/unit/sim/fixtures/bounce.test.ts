// @vitest-environment node
import { createRng, createSim, deriveSeed } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { bouncePlugin } from '#src/sim/fixtures/bounce.plugin.ts'
import { BOUNCE_DIVERGE_TICK, bounceDivergedPlugin } from '#src/sim/fixtures/bounce-diverged.plugin.ts'
import { BOUNCE_SEED, bounceScript, bounceSetup } from '#src/sim/fixtures/bounce-script.ts'

async function run(plugin: typeof bouncePlugin, ticks: number): Promise<string[]> {
  const sim = await createSim({ seed: BOUNCE_SEED, plugins: [plugin] })
  bounceSetup(sim)
  const rng = createRng(deriveSeed(BOUNCE_SEED, 'script'))
  const hashes: string[] = []
  for (let t = 0; t < ticks; t++) {
    sim.step(bounceScript(sim.tick, rng))
    hashes.push(sim.hash()) // hashes[i] is the hash at tick i + 1
  }
  sim.dispose()
  return hashes
}

test('the diverged twin has the same schema and first differs in the hash at tick 137', async () => {
  const a = await createSim({ seed: 1, plugins: [bouncePlugin] })
  const b = await createSim({ seed: 1, plugins: [bounceDivergedPlugin] })
  expect(b.describeSnapshot().header.schemaHash).toBe(a.describeSnapshot().header.schemaHash)
  a.dispose()
  b.dispose()

  expect(BOUNCE_DIVERGE_TICK).toBe(136)
  const straight = await run(bouncePlugin, 200)
  const diverged = await run(bounceDivergedPlugin, 200)
  expect(diverged.slice(0, 136)).toEqual(straight.slice(0, 136)) // ticks 1..136
  expect(diverged[136]).not.toBe(straight[136]) // tick 137
})

test('the bounce run spawns, bounces and takes kicks', async () => {
  const sim = await createSim({ seed: BOUNCE_SEED, plugins: [bouncePlugin] })
  bounceSetup(sim)
  const rng = createRng(deriveSeed(BOUNCE_SEED, 'script'))
  let kicks = 0
  for (let t = 0; t < 300; t++) {
    const commands = bounceScript(sim.tick, rng)
    kicks += commands.length
    expect(sim.step(commands).rejected).toEqual([])
  }
  const view = sim.describeSnapshot()
  expect(kicks).toBeGreaterThan(5)
  expect(view.entities.length).toBeGreaterThan(3)
  expect((view.resources['bounce.stats'] as { bounces: number }).bounces).toBeGreaterThan(5)
  sim.dispose()
})
