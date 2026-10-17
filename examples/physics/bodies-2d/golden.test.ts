import { expectGolden, replayGolden } from '@mcthaydt/automata-testing/sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { expect, it } from 'vitest'
import { bodiesSimSetup } from './bodies-sim.ts'
import { GOLDEN_HASH, goldenDrive, runGolden } from './golden.ts'

it('the golden run ends on the recorded hash', async ({ task }) => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  // The bodies did collide: a run where nothing touched would pin nothing about the physics.
  expect(result.collisions).toBeGreaterThan(10)
  expect(result.hash).toBe(GOLDEN_HASH)
  // The hash this engine computed, for the evidence file (DX.9).
  const { seed, ticks, hash } = result
  recordGoldenEvidence(task, { scenario: 'physics-bodies-2d/golden-run', seed, ticks, hash })
})

it('replays to the same hash twice in one engine', async () => {
  const first = await runGolden()
  const second = await runGolden()
  expect(second.hash).toBe(first.hash)
})

// The same run as a .replay (M2.3), with a reference snapshot every 30 ticks: when the run changes, the report
// names the first tick that differs and every field that differs there. Every 10 ticks would pack to 497 KB, so
// close to the 512 KiB golden cap that any growth would break it; every 30 is 175 KB. Recorded in Node with
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
