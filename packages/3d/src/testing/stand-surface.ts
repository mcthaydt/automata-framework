// The dressed figure's outermost surface, as a hand finds the cloth it rests on: shared by the stand tests and
// the golden recorder, which place the same hands on the same outfits.

import { GROUP } from '../features/figures/body/mesh.ts'
import { reach } from '../features/figures/body/reach.ts'
import type { Skeleton } from '../features/figures/body/rig.ts'
import type { Built } from '../features/figures/figure/build.ts'
import type { Surface } from '../features/figures/motion/stands.ts'

/**
 * `reach` is a pure function of the cloth, the rest pose and the ray, and a figure's stands cast the same rays
 * again and again (each hold re-casts the body's openings; most stands share their hands' rays), so each
 * figure's casts are remembered by the ray's exact coordinates: every cast still returns `reach`'s own value.
 */
export const surfaceOf = (s: Skeleton, built: Built): Surface => {
  const skip: number[] = [GROUP.head, GROUP.armL, GROUP.armR, GROUP.item]
  const cloth = built.parts.filter((p) => !skip.includes(p.group))
  const cast = new Map<string, number>()
  return (origin, dir) => {
    const ray = `${origin.join()} ${dir.join()}`
    const known = cast.get(ray)
    if (known !== undefined) return known
    const far = reach(cloth, s.rest, origin, dir)
    cast.set(ray, far)
    return far
  }
}
