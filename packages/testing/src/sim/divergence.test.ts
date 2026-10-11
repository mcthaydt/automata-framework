// Exit 7 (M2.3 spec §7): a golden checked against a twin that diverges at one tick says which tick and which field.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSim } from '@mcthaydt/automata-sim'
import { createRecorder, packReplay } from '@mcthaydt/automata-sim/replay'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { nodeCompression } from './compression'
import { bouncePlugin } from './fixtures/bounce.plugin'
import { BOUNCE_DIVERGE_SID, bounceDivergedPlugin } from './fixtures/bounce-diverged.plugin'
import { BOUNCE_SEED, bounceDrive, bounceSetup } from './fixtures/bounce-script'
import { writeGoldenFile } from './golden-files'
import { replayGolden } from './replay-golden'
import { formatGoldenReport } from './report'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'af-diverge-'))
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(dir, { recursive: true, force: true })
})

test('the committed bounce golden, checked with the diverged twin, names tick 137 and the ball’s vx', async () => {
  const report = await replayGolden({
    file: './fixtures/__goldens__/bounce.replay',
    plugins: [bounceDivergedPlugin],
  })
  expect(report).toMatchObject({ kind: 'diverged', firstTick: 137, lastGoodTick: 120, exact: true })
  if (report.kind !== 'diverged') return
  expect(report.diffTick).toBeUndefined()
  expect(report.differences[0]).toMatchObject({
    kind: 'entity',
    sid: BOUNCE_DIVERGE_SID,
    at: `entity ${BOUNCE_DIVERGE_SID} bounce.ball.vx`,
  })
  expect(formatGoldenReport(report).split('\n').slice(0, 2)).toEqual([
    'bounce.replay diverged at tick 137 (last matching check: tick 120)',
    `  entity ${BOUNCE_DIVERGE_SID} bounce.ball.vx: ${report.differences[0]?.expected} ≠ ${report.differences[0]?.actual}`,
  ])
})

test('with a snapshot every 10 ticks, the tick is still exact and the diff is taken at tick 140', async () => {
  const file = join(dir, 'bounce.replay')
  vi.stubEnv('AUTOMATA_UPDATE_GOLDENS', '1')
  await replayGolden({
    file,
    plugins: [bouncePlugin],
    record: { seed: BOUNCE_SEED, setup: bounceSetup, drive: bounceDrive, snapshotEvery: 10 },
  })
  vi.unstubAllEnvs()
  const report = await replayGolden({ file, plugins: [bounceDivergedPlugin] })
  expect(report).toMatchObject({
    kind: 'diverged',
    firstTick: 137,
    lastGoodTick: 120,
    exact: true,
    diffTick: 140,
  })
  if (report.kind === 'diverged')
    expect(report.differences[0]).toMatchObject({ at: `entity ${BOUNCE_DIVERGE_SID} bounce.ball.vx` })
})

test('a replay without reference data reports the window between checks, not exact', async () => {
  const sim = await createSim({ seed: BOUNCE_SEED, plugins: [bouncePlugin] })
  bounceSetup(sim)
  const recorder = createRecorder(sim)
  bounceDrive(recorder, sim)
  const replay = recorder.finish()
  sim.dispose()
  const file = join(dir, 'elsewhere.replay')
  await writeGoldenFile(file, await packReplay(replay, nodeCompression))
  expect(await replayGolden({ file, plugins: [bounceDivergedPlugin] })).toEqual({
    kind: 'diverged',
    name: 'elsewhere.replay',
    firstTick: 180,
    lastGoodTick: 120,
    exact: false,
    differences: [],
  })
})
