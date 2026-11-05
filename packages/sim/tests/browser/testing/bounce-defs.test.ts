// @vitest-environment node
// DX spec §3.2's contract test: the bounce plugin written as one flat `defs` list is the same plugin. It must pass
// the committed bounce.golden.json (same schema hash, same hash every tick) in Node and in the three browsers.
import { createSim, definePlugin } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { Kick } from '#src/testing/fixtures/bounce.command.ts'
import { Ball } from '#src/testing/fixtures/bounce.component.ts'
import { bouncePlugin } from '#src/testing/fixtures/bounce.plugin.ts'
import { BounceStats } from '#src/testing/fixtures/bounce.resource.ts'
import { BounceKick, BounceMove, BounceSpawn } from '#src/testing/fixtures/bounce.system.ts'
import { BOUNCE_SEED, BOUNCE_TICKS, bounceScript, bounceSetup } from '#src/testing/fixtures/bounce-script.ts'
import { expectGolden } from '#src/testing/report.ts'
import { simGolden } from '#src/testing/sim-golden.ts'

const bounceFromDefs = definePlugin({
  name: 'bounce',
  defs: [Ball, Kick, BounceStats, BounceKick, BounceMove, BounceSpawn],
})

test('the bounce plugin as a defs list has the keyed plugin’s schema hash', async () => {
  const schemaHashOf = async (plugin: typeof bouncePlugin) => {
    const sim = await createSim({ seed: BOUNCE_SEED, plugins: [plugin] })
    const { schemaHash } = sim.describeSnapshot().header
    sim.dispose()
    return schemaHash
  }
  expect(await schemaHashOf(bounceFromDefs)).toBe(await schemaHashOf(bouncePlugin))
})

test('the bounce plugin as a defs list passes bounce.golden.json', async () => {
  const report = await simGolden({
    name: 'bounce',
    dir: '../../fixtures/sim',
    plugins: [bounceFromDefs],
    seed: BOUNCE_SEED,
    setup: bounceSetup,
    script: bounceScript,
    ticks: BOUNCE_TICKS,
  })
  expectGolden(report)
  expect(report.kind).toBe('pass')
})
