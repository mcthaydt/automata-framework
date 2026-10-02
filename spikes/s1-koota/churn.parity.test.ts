import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { CHURN_NATIVE_EXPECTED } from './expected'
import {
  createSim,
  destroyWorlds,
  Health,
  live,
  Position,
  populate,
  recycledLive,
  sidOf,
  tick,
} from './world'

afterEach(destroyWorlds)

test('native iteration order (with in-tick churn) is identical in every engine at 10k live entities', async () => {
  const sim = createSim(1234)
  populate(sim, 10_000)
  for (let t = 0; t < 60; t++) tick(sim, 'native')
  const list = live(sim, 'native')
  expect(list.length).toBeGreaterThanOrEqual(10_000) // Review Focus #1: not vacuous
  expect(recycledLive(sim)).toBeGreaterThan(0) // ids really were recycled during the run
  const rows: number[] = [sim.acc]
  for (const e of list)
    rows.push(
      sidOf(e),
      e.id(),
      e.get(Position)?.x ?? Number.NaN,
      e.has(Health) ? (e.get(Health)?.hp ?? -1) : -1,
    )
  expect(await sha256Hex(f64Bytes(rows))).toBe(CHURN_NATIVE_EXPECTED)
})

test('records whether native order is ascending by StableId (informational, for the verdict)', () => {
  const sim = createSim(1234)
  populate(sim, 10_000)
  for (let t = 0; t < 60; t++) tick(sim, 'native')
  const sids = live(sim, 'native').map(sidOf)
  const ascending = sids.every((s, i) => i === 0 || s > (sids[i - 1] as number))
  console.log(
    `[S1] native-ascending-by-stableId=${ascending} live=${sids.length} recycled-live=${recycledLive(sim)}`,
  )
})
