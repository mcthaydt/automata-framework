// The level port moved this package's golden hash, and only because a snapshot's header carries a hash of every
// resource's schema (`schemaHash`) and the sector-map resource's schema is now `af-sector/2`'s. This pins that nothing
// else moved: with the header's schema hash zeroed, the state's bytes hash to the values the TOML-era code produced
// (measured on the commit before the port), every 100 steps of the golden script.
import { stateHash } from '@automata/sectors/testing'
import { expect, test } from 'vitest'
import { runNavGolden } from '#src/testing/walk-script.ts'

const BEFORE_THE_PORT = [
  '279dded721ae1851',
  'fed703d6ead5a9ef',
  '7f8b61e385095042',
  '316f3aff790b3fd9',
  'd993e4fd34faef1e',
  'f096a5febfe5d167',
]

test('nav: the golden script’s state is the same bytes as before the level port', async () => {
  const seen: string[] = []
  await runNavGolden(undefined, (sim) => {
    if (sim.tick % 100 === 0) seen.push(stateHash(sim))
  })
  expect(seen).toEqual(BEFORE_THE_PORT)
})
