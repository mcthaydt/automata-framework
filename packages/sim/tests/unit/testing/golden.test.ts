// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineComponent, definePlugin, defineResource, defineSystem } from '@mcthaydt/automata-sim'
import { ReplayRecordError } from '@mcthaydt/automata-sim/replay'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { Ball } from '#src/testing/fixtures/bounce.component.ts'
import { bouncePlugin } from '#src/testing/fixtures/bounce.plugin.ts'
import { bounceDivergedPlugin } from '#src/testing/fixtures/bounce-diverged.plugin.ts'
import { BOUNCE_SEED, bounceDrive, bounceScript, bounceSetup } from '#src/testing/fixtures/bounce-script.ts'
import { writeGoldenFile } from '#src/testing/golden-files.ts'
import { replayGolden } from '#src/testing/replay-golden.ts'
import { simGolden } from '#src/testing/sim-golden.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'af-golden-'))
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(dir, { recursive: true, force: true })
})
const updating = () => vi.stubEnv('AUTOMATA_UPDATE_GOLDENS', '1')

const bounce = (over: Partial<Parameters<typeof simGolden>[0]> = {}) =>
  simGolden({
    name: 'bounce',
    dir,
    plugins: [bouncePlugin],
    seed: BOUNCE_SEED,
    setup: bounceSetup,
    script: bounceScript,
    ticks: 200,
    every: 10,
    ...over,
  })
const goldenFile = () => join(dir, '__goldens__', 'bounce.golden.json')

test('simGolden: missing, then written with the update flag, then pass', async () => {
  expect(await bounce()).toEqual({ kind: 'missing', name: 'bounce.golden.json', file: goldenFile() })
  updating()
  const written = await bounce()
  expect(written).toMatchObject({ kind: 'written', name: 'bounce.golden.json', file: goldenFile() })
  vi.unstubAllEnvs()
  expect(await bounce()).toEqual({ kind: 'pass', name: 'bounce.golden.json', checks: 20 })

  // Reviewable in a diff: sorted keys, one hash per line, and the setup that made it.
  const text = await readFile(goldenFile(), 'utf8')
  const json = JSON.parse(text)
  expect(Object.keys(json)).toEqual([
    'contentHash',
    'every',
    'hashes',
    'name',
    'schemaHash',
    'seed',
    'tickHz',
    'ticks',
  ])
  expect(json.hashes).toHaveLength(20)
  expect(json.hashes[0]).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{16}$/), tick: 10 })
  expect(
    text.split('\n').filter((line) => /^ {4}\{"hash":"[0-9a-f]{16}","tick":\d+\}/.test(line)),
  ).toHaveLength(20)
})

test('simGolden: a changed run reports the first differing recorded tick', async () => {
  updating()
  await bounce()
  vi.unstubAllEnvs()
  expect(await bounce({ plugins: [bounceDivergedPlugin] })).toEqual({
    kind: 'diverged',
    name: 'bounce.golden.json',
    firstTick: 140,
    lastGoodTick: 130,
    exact: false,
    differences: [],
  })
  const exact = await bounce({ every: 1 }).catch((e: unknown) => e)
  expect(exact).toMatchObject({ kind: 'setup-changed', field: 'every', expected: 10, actual: 1 })
})

test('simGolden: a changed component is schema-changed; other content is content-changed', async () => {
  updating()
  await bounce()
  vi.unstubAllEnvs()
  const extra = definePlugin({ name: 'extra', components: [defineComponent('extra.thing', { n: 'u32' })] })
  expect(await bounce({ plugins: [bouncePlugin, extra] })).toMatchObject({ kind: 'schema-changed' })
  expect(await bounce({ content: { level: 2 } })).toMatchObject({ kind: 'content-changed' })
})

test('simGolden: a difference at the first recorded tick has the setup’s last tick as lastGoodTick', async () => {
  // The setup steps the sim five ticks before spawning, so the recording starts at tick 5.
  const steppedSetup = (vx: number) => (sim: Parameters<typeof bounceSetup>[0]) => {
    for (let t = 0; t < 5; t++) sim.step([])
    sim.spawn([[Ball, { x: 100, y: 200, vx, vy: 3 }]])
  }
  updating()
  await bounce({ setup: steppedSetup(7), every: 1 })
  vi.unstubAllEnvs()
  expect(await bounce({ setup: steppedSetup(8), every: 1 })).toMatchObject({
    kind: 'diverged',
    firstTick: 6,
    lastGoodTick: 5,
    exact: true,
  })
})

test('simGolden: a file that is not a simGolden file is an error naming it', async () => {
  updating()
  await bounce()
  vi.unstubAllEnvs()
  const json = JSON.parse(await readFile(goldenFile(), 'utf8'))
  await writeFile(goldenFile(), JSON.stringify({ ...json, hashes: [{ tick: 'ten', hash: 'x' }] }))
  await expect(bounce()).rejects.toThrow(/bounce\.golden\.json is not a simGolden file/)
  await writeFile(goldenFile(), '{"hashes": [')
  await expect(bounce()).rejects.toThrow(/bounce\.golden\.json is not a simGolden file/)
})

test.each([
  ['tickHz', { tickHz: 30 }, 60, 30],
  ['seed', { seed: 7 }, BOUNCE_SEED, 7],
  ['ticks', { ticks: 100 }, 200, 100],
] as const)('simGolden: another %s is setup-changed naming it', async (field, over, expected, actual) => {
  updating()
  await bounce()
  vi.unstubAllEnvs()
  expect(await bounce(over)).toEqual({
    kind: 'setup-changed',
    name: 'bounce.golden.json',
    field,
    expected,
    actual,
  })
})

test('an interrupted write leaves the old golden whole and no temp file', async () => {
  const file = join(dir, 'x.golden.json')
  await writeFile(file, 'old')
  const written: string[] = []
  const err = await writeGoldenFile(file, new TextEncoder().encode('new'), {
    writeFile: async (path, bytes) => {
      written.push(path)
      await writeFile(path, bytes)
    },
    rename: async () => {
      throw new Error('disk full')
    },
    rm: (path) => rm(path, { force: true }),
  }).catch((e: unknown) => e)
  expect((err as Error).message).toBe('disk full')
  expect(await readFile(file, 'utf8')).toBe('old')
  expect(written).toHaveLength(1)
  await expect(readFile(written[0] as string)).rejects.toThrow(/ENOENT/)
})

// --- replayGolden ---

const replayFile = () => join(dir, '__goldens__', 'bounce.replay')
const replayBounce = (over: Partial<Parameters<typeof replayGolden>[0]> = {}) =>
  replayGolden({
    file: replayFile(),
    plugins: [bouncePlugin],
    record: { seed: BOUNCE_SEED, setup: bounceSetup, drive: bounceDrive },
    ...over,
  })

test('replayGolden: missing, then written (and checked) with the update flag, then pass', async () => {
  expect(await replayBounce()).toEqual({ kind: 'missing', name: 'bounce.replay', file: replayFile() })
  updating()
  const written = await replayBounce()
  expect(written).toMatchObject({ kind: 'written', name: 'bounce.replay', file: replayFile() })
  vi.unstubAllEnvs()
  expect(await replayBounce()).toEqual({ kind: 'pass', name: 'bounce.replay', checks: 5 })
  // A replay needs no record options to be checked.
  expect(await replayGolden({ file: replayFile(), plugins: [bouncePlugin] })).toMatchObject({ kind: 'pass' })
})

test('replayGolden: a drive that spawns outside step is refused as not reproducing, and nothing is written', async () => {
  updating()
  const err = await replayBounce({
    record: {
      seed: BOUNCE_SEED,
      setup: bounceSetup,
      drive: (recorder, sim) => {
        for (let t = 0; t < 50; t++) {
          if (t === 30) sim.spawn([[Ball, { x: 1, y: 1, vx: 1, vy: 1 }]])
          recorder.step([])
        }
      },
    },
  }).catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ReplayRecordError)
  expect((err as Error).message).toMatch(/does not reproduce: diverged at tick 50/)
  await expect(readFile(replayFile())).rejects.toThrow(/ENOENT/)
})

/** A plugin whose resource is replaced every tick: `noise` random numbers, or one long run of one letter. */
function bulkPlugin(kind: 'noise' | 'run') {
  const schema = z.object({ data: z.union([z.array(z.number()), z.string()]) })
  const Bulk = defineResource('bulk.data', schema, () => ({ data: '' }))
  return definePlugin({
    name: 'bulk',
    resources: [Bulk],
    systems: [
      defineSystem({
        name: 'bulk.fill',
        phase: 'gameplay',
        run(ctx) {
          const bulk = ctx.resource(Bulk)
          bulk.data =
            kind === 'noise'
              ? Array.from({ length: 3000 }, () => ctx.rng.nextU32())
              : String.fromCharCode(97 + (ctx.tick % 26)).repeat(100_000)
        },
      }),
    ],
  })
}
const bulkGolden = (kind: 'noise' | 'run', ticks: number) =>
  replayGolden({
    file: replayFile(),
    plugins: [bulkPlugin(kind)],
    record: {
      seed: 1,
      drive: (recorder) => {
        for (let t = 0; t < ticks; t++) recorder.step([])
      },
    },
  })

test('replayGolden: a recording over 512 KiB packed is refused, naming the size and snapshotEvery', async () => {
  updating()
  await expect(bulkGolden('noise', 60)).rejects.toThrow(/packed.*512 KiB.*snapshotEvery/)
  await expect(readFile(replayFile())).rejects.toThrow(/ENOENT/)
})

test('replayGolden: a recording over the inflate cap encoded is refused, however well it packs', async () => {
  updating()
  await expect(bulkGolden('run', 90)).rejects.toThrow(/encoded.*8388608.*snapshotEvery/)
  await expect(readFile(replayFile())).rejects.toThrow(/ENOENT/)
})

test('replayGolden: schema-changed and content-changed name the golden and current hashes', async () => {
  updating()
  await replayBounce()
  vi.unstubAllEnvs()
  const extra = definePlugin({ name: 'extra', components: [defineComponent('extra.thing', { n: 'u32' })] })
  const schema = await replayGolden({ file: replayFile(), plugins: [bouncePlugin, extra] })
  expect(schema).toMatchObject({ kind: 'schema-changed', expected: expect.stringMatching(/^[0-9a-f]{16}$/) })
  const content = await replayGolden({ file: replayFile(), plugins: [bouncePlugin], content: { level: 2 } })
  expect(content).toMatchObject({ kind: 'content-changed' })
  if (content.kind === 'content-changed') expect(content.expected).not.toBe(content.actual)
})
