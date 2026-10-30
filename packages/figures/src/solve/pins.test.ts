import { beforeAll, describe, expect, it } from 'vitest'
import type { RigLimits } from '../library/rig-limits.schema'
import { apply, type V3 } from '../math/math'
import { at, fk, J, restPose } from '../rig/rig'
import { fixtureLimits } from '../testing/fixture-limits'
import { at3, distance, KEEPER, NO_TARGETS, unit, WICK } from '../testing/solve-fixtures'
import { solve } from './solve'
import type { Vec3 } from './targets'

let limits: RigLimits
beforeAll(async () => {
  limits = await fixtureLimits()
})

describe('I-d: pins hold while the pelvis moves', () => {
  it('keeps pinned feet and a hand on a lever within 1e-6 of their pins over 120 frames of a swaying pelvis', () => {
    for (const s of [WICK, KEEPER]) {
      const k = unit(s)
      const base = restPose()
      base.root = [2, 0, -1]
      base.yaw = 0.3
      const rest = fk(s, base)
      const shoulder = at(s.rest, J['upperArm.R'])
      // A lever ahead of the right shoulder and below it, inside the arm's reach and its elbow's limit as the body
      // moves (closer in, the elbow would fold past 150°).
      const lever = apply(at(rest, J.root), [shoulder[0], shoulder[1] - 0.12 * k, 0.3 * k])
      const pins = {
        footL: at3(rest, J['foot.L']) as Vec3,
        footR: at3(rest, J['foot.R']) as Vec3,
        handR: lever as Vec3,
      }
      const pelvis = at(s.rest, J.pelvis)
      for (let frame = 0; frame < 120; frame++) {
        const t = (frame / 120) * 2 * Math.PI
        // Sway, dip and drift within the legs' and the arm's reach, in figure units. The legs hang straight at
        // rest, at the very end of their reach, so the hips always sit at least 0.01 below it.
        const pos: Vec3 = [
          pelvis[0] / k + 0.03 * Math.sin(t),
          pelvis[1] / k - 0.01 - 0.05 * (1 - Math.cos(t)),
          pelvis[2] / k + 0.02 * Math.sin(2 * t),
        ]
        const { world, report } = solve(
          s,
          base,
          { ...NO_TARGETS, effectors: { pelvis: { pos, rot: [0, 8 * Math.sin(t), 3 * Math.cos(t)] } }, pins },
          limits,
        )
        for (const [joint, pin] of [
          [J['foot.L'], pins.footL],
          [J['foot.R'], pins.footR],
          [J['hand.R'], pins.handR],
        ] as const) {
          expect(distance(at3(world, joint), [...pin] as V3) / k).toBeLessThan(1e-6)
        }
        expect(report.reached.footL?.ok && report.reached.footR?.ok && report.reached.handR?.ok).toBe(true)
        expect(report.limited).toEqual([])
      }
    }
  })
})
