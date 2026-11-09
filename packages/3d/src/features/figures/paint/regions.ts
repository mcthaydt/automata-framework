import { GROUP } from '../body/mesh.ts'
export const isArm = (gr: number): gr is 3 | 4 => gr === GROUP.armL || gr === GROUP.armR
export const isLeg = (gr: number): gr is 5 | 6 => gr === GROUP.legL || gr === GROUP.legR
/** Whether two body regions can lie against each other and want a line between: an arm and the trunk, a hand and a
 * leg, two legs, two arms. The hips are where the legs grow from: none there. */
export function touching(a: number, b: number): boolean {
  if (a === b) return false
  if (a === GROUP.torso || b === GROUP.torso) return isArm(a) || isArm(b)
  return (isArm(a) || isLeg(a)) && (isArm(b) || isLeg(b))
}
/** The cell's texel density: the cast's presets are 36.9 texels a metre at 64 (or 48) texels wide. */
export const densityOf = (w: number): number => Math.max(1, Math.round(w / 64))
