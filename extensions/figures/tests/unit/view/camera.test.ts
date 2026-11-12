import { describe, expect, it } from 'vitest'
import {
  anchorOf,
  checkCentred,
  facing,
  perTexelDepthWarning,
  poseQuaternion,
  texelOf,
  viewFrom,
} from '#src/features/view/camera.ts'
import { BASE } from '#src/shared/base/base-pair.ts'
import { member } from '#src/shared/figure/frames.ts'
import { gameplay, lookAt } from '#src/shared/stage/pose.ts'

/** Turns v by the unit quaternion q. */
const rotate = (q: { x: number; y: number; z: number; w: number }, v: [number, number, number]) => {
  const { x, y, z, w } = q,
    [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy),
    ty = 2 * (z * vx - x * vz),
    tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
}
const deg = Math.PI / 180

describe('the camera as a figure sees it', () => {
  it("is the sheets' view for a camera on +z, 18° down", () => {
    const v = viewFrom([0, 1 + 10 * Math.sin(18 * deg), 10 * Math.cos(18 * deg)], [0, 1, 0], [0, 0, 0])
    expect(v.azimuth).toBeCloseTo(0, 12)
    expect(v.pitch).toBeCloseTo(18 * deg, 12)
  })
  it('turns with the camera round the figure: +x is a quarter turn, -z the back', () => {
    expect(viewFrom([5, 1, 0], [0, 1, 0], [0, 0, 0]).azimuth).toBeCloseTo(Math.PI / 2, 12)
    expect(Math.abs(viewFrom([0, 1, -5], [0, 1, 0], [0, 0, 0]).azimuth)).toBeCloseTo(Math.PI, 12)
    expect(viewFrom([3, 1, 2], [3, 1, -1], [3, 0, -2]).azimuth).toBeCloseTo(0, 12)
  })
})

describe('the quad', () => {
  it('faces the camera square on: its normal points back along the view', () => {
    for (const [az, p] of [
      [0, 18 * deg],
      [1.1, 30 * deg],
      [-2.5, 0],
      [Math.PI, 45 * deg],
    ]) {
      const n = rotate(facing(az, p), [0, 0, 1])
      const toCamera = [Math.sin(az) * Math.cos(p), Math.sin(p), Math.cos(az) * Math.cos(p)]
      for (let i = 0; i < 3; i++) expect(n[i]).toBeCloseTo(toCamera[i], 12)
      // and its up stays in the vertical plane through the camera, leaning away from it
      const up = rotate(facing(az, p), [0, 1, 0])
      expect(up[0] * Math.cos(az) - up[2] * Math.sin(az)).toBeCloseTo(0, 12)
      expect(up[1]).toBeCloseTo(Math.cos(p), 12)
    }
  })
  it("stands on the cell's feet texel, one texel to metres / cell height", () => {
    const cast = member(BASE[0].def, 2)
    expect(anchorOf(cast)).toEqual({ x: 0.5, y: (192 - 13.5) / 192 })
    expect(texelOf(cast)).toBeCloseTo(2.6 / 192, 15)
  })
})

/** The quaternion a camera, or a quad square to it, takes from a pose: local x, y, z onto right, up, −fwd. */
describe('poseQuaternion', () => {
  it("turns local x, y and z onto the pose's right, up and −fwd", () => {
    for (const p of [
      gameplay([0, 0.6, 0]),
      gameplay([1, 0.6, -2], 3),
      lookAt([0, 5, 10], [0, 0, 0], { f: 1000 }, [640, 480]),
      lookAt([-4, -1, -6], [0, 2, 0], { f: 500 }, [64, 64]),
      lookAt([0, 0, 10], [0, 0, 0], { f: 1 }, [8, 8]),
    ]) {
      const q = poseQuaternion(p)
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 12)
      for (const [local, want] of [
        [[1, 0, 0], p.right],
        [[0, 1, 0], p.up],
        [
          [0, 0, 1],
          [-p.fwd[0], -p.fwd[1], -p.fwd[2]],
        ],
      ] as const)
        rotate(q, [...local]).forEach((c, i) => expect(c).toBeCloseTo(want[i], 12))
    }
  })
})

describe("the view's guards", () => {
  it('a pose with an off-centre principal point is an error, a centred or an orthographic one is not', () => {
    const p = gameplay([0, 0.6, 0]),
      [w, h] = p.size
    expect(() => checkCentred(p)).not.toThrow()
    expect(() => checkCentred({ ...p, cx: w / 2, cy: h / 2 })).not.toThrow()
    expect(() => checkCentred({ ...p, cx: w / 2 + 1 })).toThrow(/principal point/)
    expect(() => checkCentred({ ...p, cy: h / 2 - 0.5 })).toThrow(/principal point/)
    expect(() => checkCentred({ size: [w, h], cx: 10, cy: 10 })).not.toThrow() // orthographic: no principal point
  })
  it('the WebGL and WebGPU renderers draw per-texel depth: any other gets a warning naming the fix', () => {
    expect(perTexelDepthWarning(1)).toBeNull()
    expect(perTexelDepthWarning(2)).toBeNull()
    expect(perTexelDepthWarning(4)).toMatch(/type 4.*preference: 'webgl' or 'webgpu'/)
  })
})
