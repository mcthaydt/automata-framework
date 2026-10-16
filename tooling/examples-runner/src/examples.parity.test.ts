import { expectGolden, replayGolden } from '@mcthaydt/automata-testing/sim'
import { expect, it } from 'vitest'
import { goldenExamples } from './parity.ts'

// Every example that declares `Golden: <ticks>` replays its sim headless from `__goldens__/<id>.replay`, in Node
// (the node project) and in Chromium, WebKit and Firefox (the browsers project): the hashes must match bit for bit
// (EX spec §4, AGENTS.md). Goldens are recorded only in Node with AUTOMATA_UPDATE_GOLDENS=1; a mismatch is
// investigated, never re-recorded per engine. The runner's stub example keeps this path proven before DX.2.
// The globs are relative to this file, so they work in Node and in a browser alike (no file system there).
const examples = goldenExamples(
  {
    sources: import.meta.glob('../../../examples/*/*.ts', { query: '?raw', import: 'default', eager: true }),
  },
  { modules: import.meta.glob('../../../examples/*/*.ts', { import: 'default' }) },
  '../../../examples/__goldens__',
)
const fixtures = goldenExamples(
  {
    sources: import.meta.glob('./fixtures/examples/*/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  },
  { modules: import.meta.glob('./fixtures/examples/*/*.ts', { import: 'default' }) },
  './fixtures/examples/__goldens__',
)

it('finds the stub example’s golden, so this suite never runs empty', () => {
  expect(fixtures.map((example) => example.id)).toEqual(['core-stub'])
})

for (const example of [...examples, ...fixtures]) {
  it(`${example.id}: ${example.ticks} ticks replay to the recorded hashes`, async () => {
    const game = await example.load()
    const report = await replayGolden({
      file: example.replay,
      plugins: game.sim.plugins,
      record: {
        seed: game.sim.seed,
        ...(game.sim.setup === undefined ? {} : { setup: game.sim.setup }),
        drive: (recorder) => {
          for (let tick = 0; tick < example.ticks; tick++) recorder.step([])
        },
      },
    })
    expectGolden(report)
  })
}
