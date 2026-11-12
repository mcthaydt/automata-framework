import { describe, expect, it } from 'vitest'
import { dot, wrapAngle, type V3 } from '../../../src/lib/math'
import {
  checkPose,
  densityFor,
  gameplay,
  lookAt,
  project,
  viewOf,
  zoomOf,
} from '../../../src/features/stage/pose'
import { viewFrom } from '../../../src/features/view/camera'

/** The camera pose the host passes in (src/features/stage/pose.ts): its axes, its projection, the zoom it gives a figure. */
const deg = Math.PI / 180,
  D1 = 96 / 2.6 // texels a metre at density 1

describe('the camera pose', () => {
  it('lookAt builds unit, orthogonal axes, y up', () => {
    const p = lookAt([0, 5, 10], [0, 0, 0], { f: 1000 }, [640, 480])
    for (let i = 0; i < 3; i++) expect(p.right[i]).toBeCloseTo([1, 0, 0][i], 12) // not toEqual: right's y is −0
    for (const [a, b] of [
      [p.right, p.up],
      [p.up, p.fwd],
      [p.fwd, p.right],
    ])
      expect(dot(a, b)).toBeCloseTo(0, 12)
    expect(p.up[1]).toBeGreaterThan(0)
  })
  it("viewOf is PR #22's viewFrom", () => {
    for (const [eye, target, at] of [
      [
        [0, 4, 10],
        [0, 1, 0],
        [0, 0, 0],
      ],
      [
        [5, 3, 2],
        [1, 1, -1],
        [2, 0, -2],
      ],
    ] as V3[][]) {
      const v = viewOf(lookAt(eye, target, { f: 1000 }, [640, 480]), at),
        w = viewFrom(eye, target, at)
      expect(v.azimuth).toBeCloseTo(w.azimuth, 12)
      expect(v.pitch).toBeCloseTo(w.pitch, 12)
    }
  })
  it('viewOf under an orthographic pose takes the bearing from fwd, the same for every figure', () => {
    const p = lookAt(
      [3, 1 + 20 * Math.sin(18 * deg), 20 * Math.cos(18 * deg)],
      [3, 1, 0],
      { pixelsPerMetre: D1 },
      [64, 96],
    )
    expect(viewOf(p, [0, 0, 0]).azimuth).toBeCloseTo(0, 12)
    expect(viewOf(p, [-4, 0, 2]).azimuth).toBeCloseTo(0, 12)
    expect(viewOf(p, [0, 0, 0]).pitch).toBeCloseTo(18 * deg, 12)
  })
  it('project: the target lands on the principal point; +right is +x, +up is −y', () => {
    const p = lookAt([0, 0, 10], [0, 0, 0], { f: 1000 }, [640, 480])
    expect(project(p, [0, 0, 0])).toEqual([320, 240, 10])
    expect(project(p, [1, 0, 0])[0]).toBeCloseTo(420, 9)
    expect(project(p, [0, 1, 0])[1]).toBeCloseTo(140, 9)
    const o = lookAt([0, 0, 10], [0, 0, 0], { pixelsPerMetre: 50 }, [640, 480])
    expect(project(o, [1, 1, -7])).toEqual([370, 190, 17])
  })
  it("project goes by the pose's own principal point", () => {
    const p = { ...lookAt([0, 0, 10], [0, 0, 0], { f: 1000 }, [640, 480]), cx: 300, cy: 260 }
    expect(project(p, [0, 0, 0])).toEqual([300, 260, 10])
  })
  it('zoomOf: pixels per D1 texel', () => {
    expect(
      zoomOf(lookAt([0, 0, 10], [0, 0, 0], { pixelsPerMetre: 2 * D1 }, [64, 96]), [5, 0, 5]),
    ).toBeCloseTo(2, 12)
    expect(zoomOf(lookAt([0, 0, 16], [0, 0, 0], { f: 1000 }, [640, 480]), [0, 0, 0])).toBeCloseTo(
      1000 / 16 / D1,
      12,
    )
  })
  it('densityFor', () => {
    expect([1, 2, 3, 4, 8, 6].map((z) => densityFor(z))).toEqual([1, 2, 1, 4, 4, 2])
    expect([0.4, 1.69, 2.5, 4.2, 9.9].map((z) => densityFor(z))).toEqual([1, 1, 2, 4, 4])
    expect(densityFor(2, 1)).toBe(1)
    expect(densityFor(8, 2)).toBe(2)
    expect(densityFor(2 + 1e-12)).toBe(2) // within 1e-9 of a whole number counts as whole
  })
  it("the gameplay pose is The Last Light's", () => {
    const p = gameplay([0, 0.6, 0])
    expect(p.f).toBeCloseTo(1000, 9)
    expect(p.size).toEqual([640, 480])
    expect(p.eye[0]).toBeCloseTo(0, 12)
    expect(p.eye[1]).toBeCloseTo(0.6 + 8, 12)
    expect(p.eye[2]).toBeCloseTo(16 * Math.cos(30 * deg), 12)
    expect(viewOf(p, [0, 0, 0]).pitch).toBeCloseTo(30 * deg, 12)
    expect(zoomOf(p, [0, 0.6, 0])).toBeCloseTo(1.6927, 3)
    // compared through wrapAngle: step 4's azimuth is +π and wrapAngle(π) is −π
    for (let k = 0; k < 8; k++)
      expect(wrapAngle(viewOf(gameplay([0, 0.6, 0], k), [0, 0, 0]).azimuth - (k * Math.PI) / 4)).toBeCloseTo(
        0,
        9,
      )
  })
  it('gameplay takes a frame size: the same field of view, a longer focal length', () => {
    const p = gameplay([0, 0.6, 0], 0, [1280, 960])
    expect(p.size).toEqual([1280, 960])
    expect(p.f).toBeCloseTo(2000, 9)
    expect(zoomOf(p, [0, 0.6, 0])).toBeCloseTo(2 * 1.6927, 3)
  })
  it('checkPose names what is wrong', () => {
    const ok = gameplay([0, 0.6, 0])
    expect(() => checkPose(ok)).not.toThrow()
    expect(() => checkPose({ ...ok, pixelsPerMetre: 40 })).toThrow(/f.*pixelsPerMetre/)
    expect(() => checkPose({ ...ok, f: undefined })).toThrow(/f.*pixelsPerMetre/)
    expect(() => checkPose({ ...ok, right: [2, 0, 0] })).toThrow(/right/)
    expect(() => checkPose({ ...ok, up: ok.right })).toThrow(/up/)
    expect(() => checkPose({ ...ok, size: [640.5, 480] })).toThrow(/size/)
    expect(() => checkPose({ ...ok, size: [0, 480] })).toThrow(/size/)
    expect(() => checkPose({ ...ok, right: [-1, 0, 0] as V3 })).toThrow(/handed/) // a mirrored pose: right × up is +fwd
  })
})
