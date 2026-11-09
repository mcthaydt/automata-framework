// The level port moved this package's golden hash, and only because a snapshot's header carries a hash of every
// resource's schema (`schemaHash`) and the sector-map resource's schema is now `af-sector/2`'s. This pins that nothing
// else moved: with the header's schema hash zeroed, the state's bytes hash to the values the TOML-era code produced
// (measured on the commit before the port), every 100 steps of the golden script.
import { stateHash } from '@automata/sectors/testing'
import { expect, test } from 'vitest'
import { runNarrativeGolden } from '#src/testing/talk-script.ts'

const BEFORE_THE_PORT = [
  'dc7f9520850933d2',
  '1c61f88cccddd8b5',
  '97837955d41edcaf',
  '9cc8234c99d53364',
  '1b11ade1c12c4e90',
  'e33a14abc0cb9110',
]

test('narrative: the golden script’s state is the same bytes as before the level port', async () => {
  const seen: string[] = []
  await runNarrativeGolden(undefined, (sim) => {
    if (sim.tick % 100 === 0) seen.push(stateHash(sim))
  })
  expect(seen).toEqual(BEFORE_THE_PORT)
})
