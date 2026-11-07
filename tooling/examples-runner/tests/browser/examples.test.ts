import { expectGolden, replayGolden } from '@mcthaydt/automata-sim/testing'
import { expect, it } from 'vitest'
import { goldenExamples } from '#src/parity.ts'

// Every example that declares `Golden: <ticks>` replays its sim headless from `__goldens__/<id>.replay`, in Node
// (the node project) and in Chromium, WebKit and Firefox (the browsers project): the hashes must match bit for bit
// (EX spec §4, AGENTS.md). Goldens are recorded only in Node with AUTOMATA_UPDATE_GOLDENS=1; a mismatch is
// investigated, never re-recorded per engine. The runner's stub example keeps this path proven before DX.2.
// The globs are relative to this file, so they work in Node and in a browser alike (no file system there).
const examples = goldenExamples(
  {
    sources: import.meta.glob('../../../../examples/*/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  },
  { modules: import.meta.glob('../../../../examples/*/*.ts', { import: 'default' }) },
  '../../../../examples/__goldens__',
)
const fixtures = goldenExamples(
  {
    sources: import.meta.glob('../fixtures/examples/*/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  },
  { modules: import.meta.glob('../fixtures/examples/*/*.ts', { import: 'default' }) },
  '../fixtures/examples/__goldens__',
)

it('finds the stub example’s golden, so this suite never runs empty, and lists the pending one', () => {
  expect(fixtures.map(({ id, pending }) => ({ id, pending }))).toEqual([
    { id: 'core-later', pending: 'OPEN.1' },
    { id: 'core-stub', pending: undefined },
  ])
})

// A pending example is reported as skipped, with the tasks it waits for, and never imported (EX spec §7).
for (const example of [...examples, ...fixtures]) {
  const title = `${example.id}: ${example.ticks} ticks replay to the recorded hashes`
  it.skipIf(example.pending !== undefined)(
    example.pending === undefined ? title : `${title} (pending: ${example.pending})`,
    async () => {
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
    },
  )
}
