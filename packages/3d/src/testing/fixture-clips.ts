// The fixture clips (`figure-clips/*.toml`) and the poses they name, read through the content compile.

import type { FigureClipDef } from '../features/figures/clips/clip.schema.ts'
import type { PoseDef } from '../features/figures/motion/pose.schema.ts'
import { compileFixture } from './compile-fixture.ts'
import { posesOf } from './fixture-poses.ts'

export const FIXTURE_CLIP_IDS = ['flinch', 'jab', 'look', 'raise-guard', 'reach', 'roll', 'slash'] as const

/** The clips `data` holds (a compiled content's data). */
export const clipsOf = (data: unknown): Record<string, FigureClipDef> =>
  (data as Record<string, Record<string, FigureClipDef>>)['figure-clip'] ?? {}

export async function fixtureClips(): Promise<{
  clips: Record<string, FigureClipDef>
  poses: Record<string, PoseDef>
}> {
  const result = await compileFixture()
  if (!result.ok) throw new Error(result.message)
  return { clips: clipsOf(result.content.data), poses: posesOf(result.content.data) }
}
