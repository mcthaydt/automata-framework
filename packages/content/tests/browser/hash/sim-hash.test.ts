// The sim hash must be the same everywhere a game runs (M2.2 spec §7, exit criterion 3): the compiler's
// `sim.hash` (Node), the virtual module's `simContentHash` (the same string) and `sim.contentHash` (the sim, in
// every engine). The compiler cannot run in a browser, so the sim-rooms fixture's compiled partition is
// committed beside it as `sim-content.json`; a Node test (sim-partition.test.ts) keeps that file equal to a
// fresh compile.
import { createSim } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import { contentHash } from '#src/hash/content-hash.ts'
import simContent from '#src/testing/fixtures/sim-rooms/sim-content.json'
import { SIM_ROOMS_HASH } from '#src/testing/sim-rooms-hash.ts'

test("the fixture's sim hash equals the sim's contentHash and one committed value in every engine", async () => {
  const sim = await createSim({ seed: 1, content: simContent, plugins: [] })
  try {
    expect(contentHash(simContent)).toBe(SIM_ROOMS_HASH)
    expect(sim.contentHash).toBe(SIM_ROOMS_HASH)
  } finally {
    sim.dispose()
  }
})
