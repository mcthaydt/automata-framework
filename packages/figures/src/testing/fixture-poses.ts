// The fixture pose library (`figure-poses/*.toml`), read through the content compile so the tests use the poses
// the content holds.

import type { PoseDef } from '../pose/pose.schema'
import { compileFixture } from './compile-fixture'

export const FIXTURE_POSE_IDS = [
  'carry',
  'guard-high',
  'guard-low',
  'hands-on-hips',
  'kneel',
  'point',
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
