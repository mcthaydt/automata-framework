// The natural stand: head over the shoulders, a trace of contrapposto, and the body's sideways curve. Covers
// `relaxed`, `STAND_SLIDE`, `STAND_LIFT`, `sideBend` and `standElbow`, checked through `base`, since the builder has no stand function of its own.

import { beforeAll, describe, expect, it } from 'vitest'
import { at, J } from '#src/features/figures/body/rig.ts'
import type { Gait } from '#src/features/figures/content/gait.schema.ts'
import type { Stand } from '#src/features/figures/content/stand.schema.ts'
import type { FigureDef } from '#src/features/figures/figure/figure.schema.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { base, relaxed } from '#src/features/figures/motion/base.ts'
import { euler, position } from '#src/shared/math/math.ts'
import { type FixtureFigures, fixtureFigures } from '#src/testing/fixture-library.ts'
import { AT_REST } from '#src/testing/motion-states.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})
const gait = (): Gait => {
  const found = fixture.gaits.bounce
  if (!found) throw new Error('no gait bounce')
  return found
}
const def = (extra: Partial<FigureDef['sliders']> = {}): FigureDef => {
  const found = fixture.figures.wick
  if (!found) throw new Error('no figure wick')
  return { ...found, sliders: { ...found.sliders, ...extra } }
}
/** Level hips and shoulders, so a roll in the pose can only be the body's own. */
const square: Stand = { weight: 'R', shift: 0, roll: 0, under: 0.25, free: [0, 0, 0, 0], chest: [0, 0, 0] }
const standing = (figure: FigureDef, g: Gait, stand: Stand = square) =>
  base(skeleton(figure), g, { ...AT_REST, stand })

describe('the relaxed stand', () => {
  it('leans into the weight leg by 0.4 of the gait, the free foot a quarter ahead, and the chest a third as far', () => {
    const g = gait()
    const stand = relaxed(g)
    expect(stand.weight).toBe('R')
    expect(stand.shift).toBeCloseTo(g.stance * 0.4, 12)
    expect(stand.roll).toBeCloseTo(g.stance * 1.4 * 0.4, 12)
    expect(stand.free).toEqual([g.stanceLead * 0.25, 0.01, 0.11, 0])
    expect(stand.chest?.[0]).toBeCloseTo(g.stance * 0.3 * 0.4, 12)
  })
})

describe('the head over the shoulders', () => {
  it('slides the neck back 3 cm at the figure’s scale in a stand, and not at all walking', () => {
    const figure = def()
    const k = skeleton(figure).genes.height / 1.62
    expect(at(standing(figure, gait()).pose.shift, J.neck)[2]).toBeCloseTo(-0.03 * k, 12)
    const walk = base(skeleton(figure), gait(), { ...AT_REST, moving: true, phase: 0.3 })
    expect(at(walk.pose.shift, J.neck)[2]).toBe(0)
  })
})

describe('the stand’s arms', () => {
  it('bends the near elbow by standElbow whole, not the walk’s elbow plus the idle’s', () => {
    const bent = standing(def(), { ...gait(), standElbow: 0.5 }).pose.rot
    expect(at(bent, J['foreArm.L'])).toEqual(euler(-0.5, 0, 0))
    const old = standing(def(), { ...gait(), standElbow: undefined }).pose.rot
    expect(at(old, J['foreArm.L'])).toEqual(euler(-(gait().elbow + gait().idleElbow), 0, 0))
  })

  it('holds the far arm to three quarters of standElbow', () => {
    const g = { ...gait(), standElbow: 0.4 }
    const far = at(standing(def(), g).pose.rot, J['foreArm.R'])
    // The right arm's idle sway is 0.03 sin(1.3) at the clock's start, and the forearm takes its size on top of the bend.
    expect(far[0]).toBeCloseTo(euler(-(0.3 + 0.03 * Math.sin(1.3)), 0, 0)[0], 9)
  })

  it('hangs the arm out by standOut whole, where armOut + standOut would double it', () => {
    const g = { ...gait(), standOut: 0.2 }
    const arm = at(standing(def(), g).pose.rot, J['upperArm.L'])
    expect(arm).toEqual(euler(-g.hang, 0, 0.2))
  })
})

describe('the body’s sideways curve', () => {
  const shoulderHeights = (bodyAsymmetry: number) => {
    const figure = def({ bodyAsymmetry })
    const { world } = standing(figure, gait())
    const y = (side: 'L' | 'R') => position(at(world, J[`upperArm.${side}`]))[1]
    return { drop: y('R') - y('L'), k: skeleton(figure).genes.height / 1.62 }
  }

  it('is nothing at 0', () => {
    expect(Math.abs(shoulderHeights(0).drop)).toBeLessThan(1e-9)
  })

  it('puts the shoulders 3 cm apart at 1, the left the lower, and mirrors at -1', () => {
    const one = shoulderHeights(1)
    expect(one.drop).toBeCloseTo(0.03 * one.k, 3)
    expect(shoulderHeights(-1).drop).toBeCloseTo(-one.drop, 6)
  })
})
