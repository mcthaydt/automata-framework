// The level port moved this package's golden hash, and only because a snapshot's header carries a hash of every
// resource's schema (`schemaHash`) and the sector-map resource's schema is now `af-sector/2`'s. This pins that nothing
// else moved: with the header's schema hash zeroed, the state's bytes hash to the values the TOML-era code produced
// (measured on the commit before the port), every 100 steps of the golden script.
import { stateHash } from '@automata/sectors/testing'
import { expect, test } from 'vitest'
import { runSystemsGolden } from '#src/testing/patrol-script.ts'

const BEFORE_THE_PORT = [
  '4c4815f66a2b068f',
  '0b114c42cb1ba852',
  '1b7029fe645bb5bf',
  '9a9c3a752ed61e39',
  'a703bfcfa787ed05',
  '6dc328166026b846',
]

test('systems: the golden script’s state is the same bytes as before the level port', async () => {
  const seen: string[] = []
  await runSystemsGolden(undefined, (sim) => {
    if (sim.tick % 100 === 0) seen.push(stateHash(sim))
  })
  expect(seen).toEqual(BEFORE_THE_PORT)
})
