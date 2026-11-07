// The fixture clips (`figure-clips/*.toml`), the actions that compile to clips (`figure-actions/*.toml`) and the poses
// they name, read through the content compile.

import type { FigureClipDef } from '../features/figures/clips/clip.schema.ts'
import { clipsWithActions } from '../features/figures/clips/figure-action.ts'
import type { PoseDef } from '../features/figures/motion/pose.schema.ts'
import { compileFixture } from './compile-fixture.ts'
import { posesOf } from './fixture-poses.ts'

/** The clips written as clips. */
export const FIXTURE_CLIP_IDS = ['jab', 'raise-guard', 'roll', 'slash'] as const
/** The clips written as actions: what `reach`, `look` and `flinch` are. */
export const FIXTURE_ACTION_IDS = ['flinch', 'look', 'reach'] as const

/** The clips `data` holds, the compiled actions among them (a compiled content's data). */
export const clipsOf = (data: unknown): Record<string, FigureClipDef> => {
  const kinds = data as Record<string, Record<string, never> | undefined>
  return clipsWithActions(kinds['figure-clip'] ?? {}, kinds['figure-action'] ?? {})
}

export async function fixtureClips(): Promise<{
  clips: Record<string, FigureClipDef>
  poses: Record<string, PoseDef>
}> {
  const result = await compileFixture()
  if (!result.ok) throw new Error(result.message)
  return { clips: clipsOf(result.content.data), poses: posesOf(result.content.data) }
}
