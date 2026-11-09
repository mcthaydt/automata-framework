// The fixture pose library (`figure-poses/*.toml`), read through the content compile so the tests use the poses
// the content holds.

import type { PoseDef } from '../features/figures/motion/pose.schema.ts'
import { compileFixture } from './compile-fixture.ts'

export const FIXTURE_POSE_IDS = [
  'carry',
  'flinch',
  'free',
  'guard-high',
  'guard-low',
  'hands-on-hips',
  'kneel',
  'look-across',
  'look-out',
  'point',
  'reach-out',
  'stand',
] as const

/** The poses `data` holds (a compiled content's data). */
export const posesOf = (data: unknown): Record<string, PoseDef> =>
  (data as Record<string, Record<string, PoseDef>>)['figure-pose'] ?? {}

export async function fixturePoses(): Promise<Record<string, PoseDef>> {
  const result = await compileFixture()
  if (!result.ok) throw new Error(result.message)
  return posesOf(result.content.data)
}
