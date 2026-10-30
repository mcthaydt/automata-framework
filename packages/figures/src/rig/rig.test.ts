import { describe, expect, it } from 'vitest'
import { measure } from '../genes/genes'
import { apply, dot, length, normalize, sub, type V3 } from '../math/math'
import { KEEPER_SLIDERS, WICK_SLIDERS } from '../testing/fixture-sliders'
import { at, fk, J, JOINTS, PARENTS, restPose, type Skeleton, skeletonFromGenes } from './rig'
import { twoBoneIK } from './two-bone-ik'

const wick = skeletonFromGenes(measure(WICK_SLIDERS).genes)
const keeper = skeletonFromGenes(measure(KEEPER_SLIDERS).genes)
const origin: V3 = [0, 0, 0]

describe('the shared skeleton (FigureBuilder rig.ts at a1f7246)', () => {
  it('has 27 joints: 20 body joints, a socket per hand, 3 hair pivots and 2 hem pivots, parents first', () => {
    expect(JOINTS).toHaveLength(27)
    for (const [index, parent] of PARENTS.entries()) expect(parent).toBeLessThan(index)
    expect(PARENTS[J.root]).toBe(-1)
    expect(PARENTS[J.hemL]).toBe(J['shin.L'])
    expect(PARENTS[J.hemR]).toBe(J['shin.R'])
    expect(PARENTS[J['socket.R']]).toBe(J['hand.R'])
    for (const hair of ['hair.back', 'hair.L', 'hair.R'] as const) expect(PARENTS[J[hair]]).toBe(J.head)
  })
  it("places the rest joints as the source does (Wick's and the keeper's numbers)", () => {
    // From FigureBuilder's skeleton() at a1f7246, run on Node 24.
    expect(wick.thigh).toBe(0.26109244444444446)
    expect(wick.upperArm).toBe(0.20924399999999999)
    expect(wick.rest[J.head]).toEqual([0, 1.009511111111111, 0.02592592592592593])
    expect(wick.rest[J['hand.L']]).toEqual([0.11802126336000002, 0.5284518518518518, 0])
    expect(wick.rest[J.hemR]).toEqual([-0.06492959999999999, 0.061111111111111116, 0])
    expect(wick.rest[J['hair.back']]).toEqual([0, 1.160711111111111, -0.020643674074074074])
    expect(keeper.foreArm).toBe(0.35011709999999996)
    expect(keeper.rest[J.head]).toEqual([0, 1.6281682222222222, 0.04018518518518519])
  })
  it('puts every joint at its rest position under the rest pose', () => {
    for (const s of [wick, keeper]) {
      const world = fk(s, restPose())
      for (const [index, m] of world.entries()) {
        const rest = at(s.rest, index)
        for (const [axis, v] of apply(m, origin).entries()) expect(v).toBeCloseTo(at(rest, axis), 12)
      }
    }
  })
})

/** The hand's world position after solving the left arm toward `target`. */
function reachLeft(s: Skeleton, target: V3, pole: V3 = [0.5, -0.5, -0.5]): { hand: V3; shoulder: V3 } {
  const pose = restPose()
  const world = fk(s, pose)
  twoBoneIK(s, pose, world, J['upperArm.L'], J['foreArm.L'], J['hand.L'], target, pole, -1)
  const after = fk(s, pose)
  return { hand: apply(at(after, J['hand.L']), origin), shoulder: apply(at(world, J['upperArm.L']), origin) }
}

describe('two-bone IK (ported from The Last Light tests/procedural-figure.test.ts at 92e6704)', () => {
  it('puts the end on any reachable target, for both fixture figures', () => {
    let reachable = 0
    for (const s of [wick, keeper]) {
      const k = s.genes.height / 1.62
      for (const target of [
        [0.3, 0.9, 0.3],
        [-0.1, 0.4, 0.5],
        [0.4, 1.2, -0.1],
      ] as V3[]) {
        const scaled: V3 = [target[0] * k, target[1] * k, target[2] * k]
        const { hand, shoulder } = reachLeft(s, scaled)
        if (length(sub(scaled, shoulder)) >= s.upperArm + s.foreArm) continue
        reachable++
        expect(length(sub(hand, scaled))).toBeLessThan(1e-6)
      }
    }
    // The source's three targets, scaled to each figure: at least four of the six are in reach.
    expect(reachable).toBeGreaterThanOrEqual(4)
  })
  it('extends fully toward a target out of reach, never stretching a bone', () => {
    const { hand, shoulder } = reachLeft(wick, [2, 2, 2])
    const reach = length(sub(hand, shoulder))
    expect(reach).toBeLessThanOrEqual(wick.upperArm + wick.foreArm)
    expect(reach).toBeGreaterThan(wick.upperArm + wick.foreArm - 1e-5)
    // And it points at the target.
    expect(dot(normalize(sub(hand, shoulder)), normalize(sub([2, 2, 2], shoulder)))).toBeCloseTo(1, 9)
  })
  it('stays finite when the pole is parallel to the limb or the target is on its root', () => {
    const shoulder = wick.rest[J['upperArm.L']] as V3
    const below: V3 = [shoulder[0], shoulder[1] - 0.3, shoulder[2]]
    for (const { hand } of [reachLeft(wick, below, [0, -1, 0]), reachLeft(wick, shoulder)]) {
      for (const v of hand) expect(Number.isFinite(v)).toBe(true)
    }
  })
  it("solves to the source's joint rotations", () => {
    // From FigureBuilder's twoBoneIK at a1f7246 on Wick, target [0.2, 0.7, 0.3], pole [0.5, -0.5, -0.5].
    const pose = restPose()
    twoBoneIK(
      wick,
      pose,
      fk(wick, pose),
      J['upperArm.L'],
      J['foreArm.L'],
      J['hand.L'],
      [0.2, 0.7, 0.3],
      [0.5, -0.5, -0.5],
      -1,
    )
    const expected = [
      [-0.29226385665820687, -0.20122554141605997, 0.254831592812911, 0.8995281979335163],
      [-0.24477518718221433, -3.9361292440833634e-17, -2.862639450242446e-17, 0.9695798614554203],
    ]
    for (const [i, joint] of [J['upperArm.L'], J['foreArm.L']].entries()) {
      for (const [axis, v] of at(pose.rot, joint).entries())
        expect(v).toBeCloseTo(at(at(expected, i), axis), 12)
    }
  })
})
