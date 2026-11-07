// The `occlude` content shape (M3 spec §4.2): how the angled camera treats a static mesh or a sector wall. `cut` goes
// (a wall leaves a floor-level trim), `fade` is drawn at 25% opacity, `never` always stays. Walls are `cut` when they
// say nothing, floors `never`, props taller than 1.5 m `fade`. Presentation only: the sim never reads it. The sector
// format owns it (M6-D17), so @automata/3d's pure `./camera-view` entry and the 3D level editor both re-export it.
import { z } from 'zod'

export const OCCLUDES = ['cut', 'fade', 'never'] as const
export type Occlude = (typeof OCCLUDES)[number]
export const occludeSchema: z.ZodEnum<{ cut: 'cut'; fade: 'fade'; never: 'never' }> = z.enum(OCCLUDES)
