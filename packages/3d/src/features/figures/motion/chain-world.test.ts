import { describe, expect, it } from 'vitest'
import { WICK } from '../../../testing/solve-fixtures.ts'
import { fk, J, PARENTS, restPose } from '../body/rig.ts'
import { chainWorld } from './chain-world.ts'
import { eulerDegrees } from './rotation.ts'

describe('one chain of forward kinematics', () => {
  it("gives exactly fk's transforms for a joint and its ancestors, and nothing else", () => {
    const pose = restPose()
    pose.root = [1, 0, -2]
    pose.yaw = 0.4
    pose.rot[J.pelvis] = eulerDegrees([5, 10, -3])
    pose.rot[J['thigh.L']] = eulerDegrees([-30, 0, 4])
    pose.shift[J.pelvis] = [0, -0.05, 0.01]
    const full = fk(WICK, pose)
    const chain = chainWorld(WICK, pose, J['foot.L'])
    for (let j = J['foot.L']; j >= 0; j = PARENTS[j] as number) expect(chain[j]).toEqual(full[j])
    expect(chain[J.head]).toBeUndefined()
  })
})
