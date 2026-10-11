import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineComponent, definePlugin } from '@mcthaydt/automata-sim'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { bouncePlugin } from './fixtures/bounce.plugin'
import { bounceDivergedPlugin } from './fixtures/bounce-diverged.plugin'
import { BOUNCE_SEED, bounceScript, bounceSetup } from './fixtures/bounce-script'
import { writeGoldenFile } from './golden-files'
import { simGolden } from './sim-golden'

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
  expect(text.split('\n').length).toBeGreaterThan(40)
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
