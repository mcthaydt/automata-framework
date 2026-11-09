import { describe, expect, it } from 'vitest'
import { measure } from '#src/features/figures/body/genes.ts'
import { at, fk, J, restPose, skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { twoBoneIK } from '#src/features/figures/body/two-bone-ik.ts'
import { placeHems } from '#src/features/figures/motion/hems.ts'
import { apply, invertRigid, position } from '#src/shared/math/math.ts'

// A hem hangs part of the way from the hip's plumb to the ankle. Standing it hangs half way (the knee is over the foot);
// a figure whose knee is out in front of its foot, sitting, needs the hem on the ankle all the way, and says so.

const s = skeletonFromGenes(measure({}).genes)

/** A rest pose with the left foot planted on the floor well forward of its hip, so the plumb and the ankle part ways. */
function forwardFoot() {
  const pose = restPose()
  const world = fk(s, pose)
  const hip = position(at(world, J['thigh.L']))
  twoBoneIK(
    s,
    pose,
    world,
    J['thigh.L'],
    J['shin.L'],
    J['foot.L'],
    [hip[0], s.genes.ankle, hip[2] + 0.15],
    [0, 0, 1],
    1,
  )
  return pose
}
/** Where the left hem and ankle are along the root's z after the hems are placed. */
function placed(follow?: number): { hem: number; ankle: number } {
  const pose = forwardFoot()
  placeHems(s, pose, fk(s, pose), undefined, follow)
  const world = fk(s, pose)
  const toRoot = invertRigid(at(world, J.root))
  return {
    hem: apply(toRoot, position(at(world, J.hemL)))[2],
    ankle: apply(toRoot, position(at(world, J['foot.L'])))[2],
  }
}

describe('placeHems', () => {
  it('lets the hem follow the ankle all the way when told to', () => {
    const { hem, ankle } = placed(1)
    expect(hem).toBeCloseTo(ankle, 6)
  })
  it('hangs it part way from the hip to the ankle when it is not told, with the foot out in front', () => {
    const { hem, ankle } = placed()
    expect(Math.abs(hem - ankle)).toBeGreaterThan(0.01)
  })
  it('is the same with no follow as before the option existed', () => {
    expect(placed(undefined)).toEqual(placed())
  })
})
