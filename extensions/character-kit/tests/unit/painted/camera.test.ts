import { describe, expect, it } from 'vitest'
import { anchorOf, eyeOf, facing, texelOf, viewFrom } from '#src/features/painted/camera.ts'
import { BASE, member } from '#src/shared/figure-builder/door.ts'

/** Turns v by the unit quaternion q. */
const rotate = (q: { x: number; y: number; z: number; w: number }, v: readonly [number, number, number]) => {
  const { x, y, z, w } = q,
    [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy),
    ty = 2 * (z * vx - x * vz),
    tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
}
const deg = Math.PI / 180

describe('the camera as a painted figure sees it', () => {
  it("is the review sheets' view for a camera on +z, 18° down", () => {
    const v = viewFrom([0, 1 + 10 * Math.sin(18 * deg), 10 * Math.cos(18 * deg)], [0, 1, 0], [0, 0, 0])
    expect(v.azimuth).toBeCloseTo(0, 12)
    expect(v.pitch).toBeCloseTo(18 * deg, 12)
  })
  it('turns with the camera round the figure: +x is a quarter turn, −z the back', () => {
    expect(viewFrom([5, 1, 0], [0, 1, 0], [0, 0, 0]).azimuth).toBeCloseTo(Math.PI / 2, 12)
    expect(Math.abs(viewFrom([0, 1, -5], [0, 1, 0], [0, 0, 0]).azimuth)).toBeCloseTo(Math.PI, 12)
    expect(viewFrom([3, 1, 2], [3, 1, -1], [3, 0, -2]).azimuth).toBeCloseTo(0, 12)
  })
  it("reads a camera's eye and target from its position and rotation (looking down −z)", () => {
    const half = (-30 * deg) / 2 // turned 30° down about x
    const { eye, target } = eyeOf({
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) },
    })
    expect(eye).toEqual([1, 2, 3])
    expect(viewFrom(eye, target, [1, 0, -10]).pitch).toBeCloseTo(30 * deg, 12)
  })
})

describe('the quad', () => {
  it('faces the camera square on: its normal points back along the view, its up leans away', () => {
    for (const [az, p] of [
      [0, 18 * deg],
      [1.1, 30 * deg],
      [-2.5, 0],
      [Math.PI, 45 * deg],
    ] as const) {
      const n = rotate(facing(az, p), [0, 0, 1])
      const toCamera = [Math.sin(az) * Math.cos(p), Math.sin(p), Math.cos(az) * Math.cos(p)]
      for (let i = 0; i < 3; i++) expect(n[i]).toBeCloseTo(toCamera[i] ?? 0, 12)
      const up = rotate(facing(az, p), [0, 1, 0])
      expect((up[0] ?? 0) * Math.cos(az) - (up[2] ?? 0) * Math.sin(az)).toBeCloseTo(0, 12)
      expect(up[1]).toBeCloseTo(Math.cos(p), 12)
    }
  })
  it("stands on the cell's feet texel, one texel to metres / cell height", () => {
    const cast = member(BASE[0]!.def, 2)
    expect(anchorOf(cast)).toEqual({ x: 0.5, y: (192 - 13.5) / 192 })
    expect(texelOf(cast)).toBeCloseTo(2.6 / 192, 15)
  })
})
