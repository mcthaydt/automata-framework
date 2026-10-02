import { afterEach, expect, test } from 'vitest'
import { sha256Hex } from '../shared/hash'
import { SNAPSHOT_SORTED_EXPECTED } from './expected'
import { decode, encode, restore, takeSnapshot } from './snapshot'
import { createSim, destroyWorlds, type Order, populate, type Sim, tick } from './world'

afterEach(destroyWorlds)

const stateHash = (sim: Sim) => sha256Hex(encode(takeSnapshot(sim)))

/** Runs 300 ticks straight vs. 150 ticks -> encode -> decode -> restore into a fresh world -> 150 more ticks. */
async function compare(order: Order) {
  const straight = createSim(99)
  populate(straight, 3_000)
  for (let t = 0; t < 300; t++) tick(straight, order)

  const first = createSim(99)
  populate(first, 3_000)
  for (let t = 0; t < 150; t++) tick(first, order)
  const snap = takeSnapshot(first)
  const bytes = encode(snap)
  const resumed = createSim(0)
  restore(decode(bytes), resumed)
  for (let t = 150; t < 300; t++) tick(resumed, order)

  return { straight: await stateHash(straight), resumed: await stateHash(resumed), snap, bytes }
}

test('sorted-by-StableId iteration: byte snapshot -> restore -> continue == uninterrupted, in every engine', async () => {
  const { straight, resumed, snap, bytes } = await compare('sorted')
  expect(snap.rows.length).toBeGreaterThan(3_000) // Review Focus #1
  expect(snap.rows.some((row) => row.contains.length > 0)).toBe(true) // Review Focus #4: relations are in the snapshot
  expect(encode(decode(bytes))).toEqual(bytes) // byte round trip is lossless
  expect(resumed).toBe(straight)
  expect(straight).toBe(SNAPSHOT_SORTED_EXPECTED)
})

test('native iteration across restore (finding for the facade ordering rule)', async () => {
  const { straight, resumed } = await compare('native')
  console.log(`[S1] native-order-survives-restore=${straight === resumed}`)
})
