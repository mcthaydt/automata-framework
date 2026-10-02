import { createAdded, createChanged, createRemoved } from 'koota'
import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { CHANGES_EXPECTED } from './expected'
import { decode, encode, restore, takeSnapshot } from './snapshot'
import { createSim, destroyWorlds, Position, populate, type Sim, StableId, sidOf, tick } from './world'

afterEach(destroyWorlds)

const Added = createAdded()
const Removed = createRemoved()
const Changed = createChanged()

/** Per tick: sorted StableIds reported by Added/Changed/Removed(Position). This is what a render delta would use. */
function trackTicks(sim: Sim, from: number, to: number): number[][] {
  const out: number[][] = []
  // Removed entities are gone, so their StableId can't be read; record the count instead.
  const ids = (q: Iterable<Parameters<typeof sidOf>[0]>) =>
    [...q]
      .filter((e) => e.has(StableId))
      .map(sidOf)
      .sort((a, b) => a - b)
  for (let t = from; t < to; t++) {
    tick(sim, 'sorted')
    const added = ids(sim.world.query(Added(Position)))
    const changed = ids(sim.world.query(Changed(Position)))
    const removed = sim.world.query(Removed(Position)).length
    out.push([t, added.length, ...added, -1, changed.length, removed])
  }
  return out
}

test('Added/Changed/Removed tracking is identical in every engine', async () => {
  const sim = createSim(5)
  populate(sim, 1_000)
  const ticks = trackTicks(sim, 0, 120)
  expect(ticks.some((row) => (row[1] as number) > 0)).toBe(true)
  expect(await sha256Hex(f64Bytes(ticks.flat()))).toBe(CHANGES_EXPECTED)
})

test('tracking after restore vs uninterrupted (finding: does a restore look like "everything added"?)', async () => {
  const a = createSim(5)
  populate(a, 1_000)
  trackTicks(a, 0, 60)
  const straight = trackTicks(a, 60, 120)

  const b = createSim(5)
  populate(b, 1_000)
  trackTicks(b, 0, 60)
  const c = createSim(0)
  restore(decode(encode(takeSnapshot(b))), c)
  const resumed = trackTicks(c, 60, 120)

  const firstTickEqual = JSON.stringify(straight[0]) === JSON.stringify(resumed[0])
  const laterTicksEqual = JSON.stringify(straight.slice(1)) === JSON.stringify(resumed.slice(1))
  console.log(
    `[S1] tracking-after-restore first-tick-equal=${firstTickEqual} later-ticks-equal=${laterTicksEqual}`,
  )
})
