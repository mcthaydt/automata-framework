// @vitest-environment node
import { definePlugin, defineResource, defineSystem, type PluginState } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { bouncePlugin } from '#src/sim/fixtures/bounce.plugin.ts'
import { bounceScript, bounceSetup } from '#src/sim/fixtures/bounce-script.ts'
import { snapshotRoundTripProperty } from '#src/sim/property.ts'

test('exit 4: 200 cases of snapshot, restore and continue on the bounce fixture equal the straight run', async () => {
  const started = performance.now()
  const { failures } = await snapshotRoundTripProperty({
    plugins: [bouncePlugin],
    setup: (sim) => bounceSetup(sim),
    script: bounceScript,
  })
  expect(failures).toEqual([])
  console.info(`bounce property: 200 cases in ${Math.round(performance.now() - started)} ms`)
}, 120_000)

/**
 * A plugin whose engine state is a counter it never snapshots: restore keeps whatever count the sim had. The
 * counter is copied into a resource each tick, so the loss shows in the hash.
 */
function leakyPlugin() {
  const schema = z.object({ count: z.number().int() })
  const Seen = defineResource('leaky.seen', schema, () => ({ count: 0 }))
  return definePlugin({
    name: 'leaky',
    resources: [Seen],
    state: async () => {
      let count = 0
      const state: PluginState & { bump(): number } = {
        bump: () => ++count,
        snapshot: () => new Uint8Array(),
        prepareRestore: () => ({ commit: () => {}, discard: () => {} }),
        dispose: () => {},
      }
      return state
    },
    systems: [
      defineSystem({
        name: 'leaky.count',
        phase: 'gameplay',
        run: (ctx) => {
          ctx.resource(Seen).count = (ctx.pluginState as { bump(): number }).bump()
        },
      }),
    ],
  })
}

test('state that restore drops fails, naming the case, its seeds and the variant', async () => {
  const { failures } = await snapshotRoundTripProperty({
    plugins: [leakyPlugin()],
    script: () => [],
    cases: 6,
    maxTicks: 40,
  })
  // Every case with a restore point after tick 0 loses the counter, in either variant.
  expect(failures.length).toBeGreaterThan(0)
  const variants = new Set(failures.map((f) => f.variant))
  expect(variants).toEqual(new Set(['fresh', 'dirty']))
  const first = failures[0] as (typeof failures)[number]
  expect(first.report).toMatch(
    new RegExp(
      `case ${first.case} \\(${first.variant}, simSeed ${first.simSeed}, ticks ${first.ticks}, restore at ${first.at}\\)`,
    ),
  )
  expect(first.report).toMatch(/final hash .* ≠ /)
})
