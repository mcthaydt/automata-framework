import { expectGolden, replayGolden } from '@mcthaydt/automata-testing/sim'
import { expect, it } from 'vitest'
import { bodiesSimSetup } from './bodies-sim.ts'
import { GOLDEN_HASH, goldenDrive, runGolden } from './golden.ts'

it('the golden run ends on the recorded hash', async () => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  // The bodies did collide: a run where nothing touched would pin nothing about the physics.
  expect(result.collisions).toBeGreaterThan(10)
  expect(result.hash).toBe(GOLDEN_HASH)
})

it('replays to the same hash twice in one engine', async () => {
  const first = await runGolden()
  const second = await runGolden()
  expect(second.hash).toBe(first.hash)
})

// The same run as a .replay with a reference snapshot every 10 ticks (M2.3; every 30 ticks, as every 10 packs to 497 KB, a hair under the 512 KiB golden cap): when the run changes, the report
// names the first tick that differs and every field that differs there. Recorded in Node with
// AUTOMATA_UPDATE_GOLDENS=1; golden.parity.test.ts checks it in Chromium, WebKit and Firefox.
it('bodies.replay: the golden run replays tick for tick', async () => {
  const report = await replayGolden({
    file: './__goldens__/bodies.replay',
    ...bodiesSimSetup(),
    record: { create: () => bodiesSimSetup().create(), drive: goldenDrive, snapshotEvery: 30 },
  })
  expectGolden(report)
  expect(report.kind === 'pass' || report.kind === 'written').toBe(true)
})
