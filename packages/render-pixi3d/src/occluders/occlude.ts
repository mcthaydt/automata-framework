// The `occlude` content shape (M3 spec §4.2): how the angled camera treats a static mesh or a sector wall. `cut` goes
// (a wall leaves a floor-level trim), `fade` is drawn at 25% opacity, `never` always stays. Walls are `cut` when they
// say nothing, floors `never`, props taller than 1.5 m `fade`. Presentation only: the sim never reads it. Zod only, so
// the pure `./camera-view` entry carries it and the 3D level editor's sector format takes it from there.
import { z } from 'zod'

export const OCCLUDES = ['cut', 'fade', 'never'] as const
export type Occlude = (typeof OCCLUDES)[number]
export const occludeSchema: z.ZodEnum<{ cut: 'cut'; fade: 'fade'; never: 'never' }> = z.enum(OCCLUDES)
