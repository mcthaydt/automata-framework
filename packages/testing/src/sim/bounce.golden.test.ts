// The bounce goldens (exit 3): checked in Node (sim project) and in Chromium, WebKit and Firefox (sim-browsers).
import { createSim } from '@mcthaydt/automata-sim'
import { createRecorder, encodeReplay, type Replay, unpackReplay } from '@mcthaydt/automata-sim/replay'
import { expect, test } from 'vitest'
import { nodeCompression, streamCompression } from './compression'
import { bouncePlugin } from './fixtures/bounce.plugin'
import { BOUNCE_SEED, BOUNCE_TICKS, bounceDrive, bounceScript, bounceSetup } from './fixtures/bounce-script'
import { inNode, readGoldenFile, resolveGoldenPath } from './golden-files'
import { replayGolden } from './replay-golden'
import { expectGolden } from './report'
import { simGolden } from './sim-golden'

test('bounce.golden.json: a hash every tick of the bounce run', async () => {
  const report = await simGolden({
    name: 'bounce',
    dir: './fixtures',
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
    file: './fixtures/__goldens__/bounce.replay',
    plugins: [bouncePlugin],
    record: { seed: BOUNCE_SEED, setup: bounceSetup, drive: bounceDrive },
  })
  expectGolden(report)
})

/** The encoded bytes with the header fields that never take part in a comparison neutralized (spec §3.3). */
const comparable = (replay: Replay): Uint8Array =>
  encodeReplay({ ...replay, header: { ...replay.header, framework: '', meta: {} } })

async function committedReplay(): Promise<Replay> {
  const bytes = await readGoldenFile(resolveGoldenPath('./fixtures/__goldens__/bounce.replay'))
  if (!bytes) throw new Error('bounce.replay is missing')
  return unpackReplay(bytes, inNode() ? nodeCompression : streamCompression)
}

test('this engine re-records the bounce run to the committed replay’s exact bytes (before deflate)', async () => {
  const sim = await createSim({ seed: BOUNCE_SEED, plugins: [bouncePlugin] })
  bounceSetup(sim)
  const recorder = createRecorder(sim, { reference: { snapshotEvery: 1 }, meta: { engine: navigatorName() } })
  bounceDrive(recorder, sim)
  const here = recorder.finish()
  sim.dispose()
  expect(comparable(here)).toEqual(comparable(await committedReplay()))
})

test('a release that bumps SIM_VERSION in the header does not change the comparison', async () => {
  const committed = await committedReplay()
  const bumped = { ...committed, header: { ...committed.header, framework: '9.9.9' } }
  expect(encodeReplay(bumped)).not.toEqual(encodeReplay(committed))
  expect(comparable(bumped)).toEqual(comparable(committed))
})

const navigatorName = (): string => (inNode() ? 'node' : globalThis.navigator.userAgent)
