// @vitest-environment node
// The bounce goldens (exit 3): checked in Node (sim project) and in Chromium, WebKit and Firefox (sim-browsers).

import { recordGoldenEvidence } from '@automata/evidence/golden'
import { createSim } from '@automata/sim'
import { createRecorder, encodeReplay, type Replay, unpackReplay } from '@automata/sim/replay'
import { expect, test } from 'vitest'
import { nodeCompression, streamCompression } from '#src/testing/compression.ts'
import { bouncePlugin } from '#src/testing/fixtures/bounce.plugin.ts'
import {
  BOUNCE_SEED,
  BOUNCE_TICKS,
  bounceDrive,
  bounceScript,
  bounceSetup,
} from '#src/testing/fixtures/bounce-script.ts'
import { inNode, readGoldenFile, resolveGoldenPath } from '#src/testing/golden-files.ts'
import { replayGolden } from '#src/testing/replay-golden.ts'
import { expectGolden } from '#src/testing/report.ts'
import { simGolden } from '#src/testing/sim-golden.ts'

test('bounce.golden.json: a hash every tick of the bounce run', async () => {
  const report = await simGolden({
    name: 'bounce',
    dir: '../../fixtures/sim',
    plugins: [bouncePlugin],
    seed: BOUNCE_SEED,
    setup: bounceSetup,
    script: bounceScript,
    ticks: BOUNCE_TICKS,
  })
  expectGolden(report)
  expect(report.kind === 'pass' || report.kind === 'written').toBe(true)
})

test('bounce.replay: the bounce run as a replay with a reference snapshot every tick', async () => {
  const report = await replayGolden({
    file: '../../fixtures/sim/__goldens__/bounce.replay',
    plugins: [bouncePlugin],
    record: { seed: BOUNCE_SEED, setup: bounceSetup, drive: bounceDrive },
  })
  expectGolden(report)
})

test('bounce.replay and bounce.golden.json pin the same run', async () => {
  const replay = await committedReplay()
  const text = await readGoldenFile(resolveGoldenPath('../../fixtures/sim/__goldens__/bounce.golden.json'))
  if (!text) throw new Error('bounce.golden.json is missing')
  const golden = JSON.parse(new TextDecoder().decode(text)) as {
    hashes: Array<{ tick: number; hash: string }>
  }
  expect(golden.hashes).toHaveLength(BOUNCE_TICKS)
  expect(replay.reference?.hashes).toEqual(golden.hashes.map((h) => h.hash))
})

/** The encoded bytes with the header fields that never take part in a comparison neutralized (spec §3.3). */
const comparable = (replay: Replay): Uint8Array =>
  encodeReplay({ ...replay, header: { ...replay.header, framework: '', meta: {} } })

async function committedReplay(): Promise<Replay> {
  const bytes = await readGoldenFile(resolveGoldenPath('../../fixtures/sim/__goldens__/bounce.replay'))
  if (!bytes) throw new Error('bounce.replay is missing')
  return unpackReplay(bytes, inNode() ? nodeCompression : streamCompression)
}

test('this engine re-records the bounce run to the committed replay’s exact bytes (before deflate)', async ({
  task,
}) => {
  const sim = await createSim({ seed: BOUNCE_SEED, plugins: [bouncePlugin] })
  bounceSetup(sim)
  const recorder = createRecorder(sim, { reference: { snapshotEvery: 1 }, meta: { engine: navigatorName() } })
  const startTick = sim.tick
  bounceDrive(recorder, sim)
  const here = recorder.finish()
  const run = { scenario: 'testing/bounce', seed: sim.seed, ticks: sim.tick - startTick, hash: sim.hash() }
  sim.dispose()
  expect(comparable(here)).toEqual(comparable(await committedReplay()))
  // The hash this engine computed, for the evidence file (DX.9); the bytes above already match the golden.
  recordGoldenEvidence(task, run)
})

test('a release that bumps SIM_VERSION in the header does not change the comparison', async () => {
  const committed = await committedReplay()
  const bumped = { ...committed, header: { ...committed.header, framework: '9.9.9' } }
  expect(encodeReplay(bumped)).not.toEqual(encodeReplay(committed))
  expect(comparable(bumped)).toEqual(comparable(committed))
})

const navigatorName = (): string => (inNode() ? 'node' : globalThis.navigator.userAgent)
