import { beforeAll, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { R2_SNAPSHOT_EXPECTED, R2_STATE_EXPECTED, R3_SNAPSHOT_EXPECTED, R3_STATE_EXPECTED } from './expected'
import { initRapier, type RunOut, run2d, run3d } from './scene'

beforeAll(() => initRapier())

async function check(run: (ticks: number, restoreAt?: number) => RunOut, bodies: number) {
  const straight = run(300)
  const restored = run(300, 150)
  expect(straight.bodies).toBe(bodies) // Review Focus #1
  const state = await sha256Hex(f64Bytes(straight.state))
  const snap = await sha256Hex(straight.snapshot)
  expect(await sha256Hex(f64Bytes(restored.state))).toBe(state) // mid-run restore changes nothing
  expect(await sha256Hex(restored.snapshot)).toBe(snap) // ...not even the snapshot bytes
  expect(await sha256Hex(straight.roundTripSnapshot)).toBe(snap) // restore(s).takeSnapshot() == s, byte for byte
  return { state, snap, bytes: straight.snapshot.length }
}

test('3D (balls, cuboids, revolute chain): state and snapshot bytes identical in every engine', async () => {
  const r = await check(run3d, 67)
  console.log(`[S2] 3d state=${r.state} snapshot=${r.snap} snapshot-bytes=${r.bytes}`)
  expect(r.state).toBe(R3_STATE_EXPECTED)
  expect(r.snap).toBe(R3_SNAPSHOT_EXPECTED)
})

test('2D (balls, cuboids, revolute chain): state and snapshot bytes identical in every engine', async () => {
  const r = await check(run2d, 67)
  console.log(`[S2] 2d state=${r.state} snapshot=${r.snap} snapshot-bytes=${r.bytes}`)
  expect(r.state).toBe(R2_STATE_EXPECTED)
  expect(r.snap).toBe(R2_SNAPSHOT_EXPECTED)
})
