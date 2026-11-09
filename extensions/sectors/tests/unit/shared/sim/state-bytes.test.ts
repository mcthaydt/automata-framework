// The level port moved the golden hashes, and only because a snapshot's header carries a hash of every resource's
// schema (`schemaHash`) and the sector-map resource's schema is now `af-sector/2`'s. This pins that nothing else
// moved: with the header's schema hash zeroed, the state's bytes hash to the values the TOML-era code produced
// (measured on the commit before the port), every 100 steps of the walkers script, with and without collider boxes.
import { describe, expect, it } from 'vitest'
import { rooms, yard } from '#src/testing/golden-script.ts'
import { stateHash } from '#src/testing/state-hash.ts'
import { stepWith } from '#src/testing/step-with.ts'
import { createWalkers, load, spawn, walk } from '#src/testing/walkers.ts'

const BEFORE_THE_PORT = {
  plain: [
    '05fb452afd60b2ac',
    '2c1300171e16f8d6',
    '8ecabe95ba4484d8',
    '740cc9739eb6d99f',
    '843b884f44e8f4b7',
    'fb750c5402efd6db',
  ],
  physics: [
    '8056e08f41f9d16d',
    '4a6958ce84bc2d93',
    '77c3de4f00a3fe68',
    'd6c2fe57050062bb',
    '470f0e2c1217c7a7',
    '670bf4f9a24beaff',
  ],
}

describe('the walkers’ state', () => {
  it.each(['plain', 'physics'] as const)('is the same bytes as before the level port (%s)', async (kind) => {
    const sim = await createWalkers({ rooms, yard }, { physics: kind === 'physics' })
    const seen: string[] = []
    while (sim.tick < 600) {
      const t = sim.tick
      const orders =
        t === 0
          ? [load('rooms'), spawn(1, 2), spawn(6, 0.5), spawn(10, 3)]
          : t === 300
            ? [load('yard')]
            : [
                walk(1, 0.5 + (t % 64) / 8, 2),
                walk(2, 4.5 + (t % 32) / 8, 1 + (t % 16) / 8),
                walk(3, 10, -2 + (t % 128) / 16),
              ]
      stepWith(sim, orders)
      if (t % 100 === 0) seen.push(stateHash(sim))
    }
    sim.dispose()
    expect(seen).toEqual(BEFORE_THE_PORT[kind])
  })
})
