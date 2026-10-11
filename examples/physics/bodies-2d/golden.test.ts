import { expect, it } from 'vitest'
import { GOLDEN_HASH, runGolden } from './golden.ts'

it('the golden run ends on the recorded hash', async () => {
  const result = await runGolden()
  expect(result.rejected).toBe(0)
  // The bodies did collide: a run where nothing touched would pin nothing about the physics.
  expect(result.collisions).toBeGreaterThan(10)
  expect(result.hash).toBe(GOLDEN_HASH)
})

it('replays to the same hash twice in one engine', async () => {
  const first = await runGolden()
  const second = await runGolden()
  expect(second.hash).toBe(first.hash)
})
