// The bounce goldens (exit 3): checked in Node (sim project) and in Chromium, WebKit and Firefox (sim-browsers).
import { expect, test } from 'vitest'
import { bouncePlugin } from './fixtures/bounce.plugin'
import { BOUNCE_SEED, BOUNCE_TICKS, bounceDrive, bounceScript, bounceSetup } from './fixtures/bounce-script'
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
