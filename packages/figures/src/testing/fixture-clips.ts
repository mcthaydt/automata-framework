// The fixture clips (`figure-clips/*.toml`) and the poses they name, read through the content compile.

import type { FigureClipDef } from '../clip/clip.schema'
import type { PoseDef } from '../pose/pose.schema'
import { compileFixture } from './compile-fixture'
import { posesOf } from './fixture-poses'

export const FIXTURE_CLIP_IDS = ['jab', 'raise-guard'] as const

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
