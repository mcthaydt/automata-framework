import { describe, expect, it } from 'vitest'
import { poseOf } from '#src/features/painted/pose.ts'
import { orthographicCamera, perspectiveCamera } from '../../fixtures/cameras.ts'

const FOV = 53.13010235415598 // fovOf(24): the 24 mm lens, vertical
const PPM = 192 / 2.6 // the painter's own scale: a D2 cell shows 2.6 m in 192 texels

describe('a camera as the figure builder sees it', () => {
  it('has its three axes from its quaternion: a camera at [0, 3, 5] looking at the origin', () => {
    const pitchDeg = (Math.atan2(3, 5) * 180) / Math.PI
    const pose = poseOf(perspectiveCamera([0, 3, 5], 0, pitchDeg), [640, 360])
    const length = Math.hypot(3, 5)
    expect(pose.eye).toEqual([0, 3, 5])
    expect(pose.fwd[0]).toBeCloseTo(0, 12)
    expect(pose.fwd[1]).toBeCloseTo(-3 / length, 12)
    expect(pose.fwd[2]).toBeCloseTo(-5 / length, 12)
    expect(pose.right[0]).toBeCloseTo(1, 12)
    expect(pose.right[1]).toBeCloseTo(0, 12)
    expect(pose.right[2]).toBeCloseTo(0, 12)
    // The builder's own handedness: right × up = −fwd.
    const [r, u] = [pose.right, pose.up]
    const cross = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]]
    for (const axis of [0, 1, 2]) expect(cross[axis]).toBeCloseTo(-(pose.fwd[axis] ?? 0), 12)
  })

  it('has a focal length from a perspective camera and no pixelsPerMetre', () => {
    const pose = poseOf(perspectiveCamera([0, 3, 5], 0, 31), [640, 360])
    expect(pose.f).toBeCloseTo(360, 2)
    expect(pose.pixelsPerMetre).toBeUndefined()
    expect(pose.size).toEqual([640, 360])
  })

  it('has pixelsPerMetre from an orthographic camera and no focal length', () => {
    const pose = poseOf(orthographicCamera([0, 3, 5], 0, 18, 320 / PPM), [640, 360])
    expect(pose.pixelsPerMetre).toBeCloseTo(PPM, 9)
    expect(pose.f).toBeUndefined()
  })

  it('folds zoom in as Camera3D.computeProjection does: perspective divides the field of view, orthographic multiplies the size', () => {
    // zoom 2 at 53.13° and 360 high: f = 180 / tan(fov / 2 / 2) = 762.5, not 720.
    const zoomed = poseOf(perspectiveCamera([0, 3, 5], 0, 31, FOV, 2), [640, 360])
    expect(zoomed.f).toBeCloseTo(180 / Math.tan((FOV / 2 / 2) * (Math.PI / 180)), 9)
    expect(zoomed.f).toBeCloseTo(762.5, 1)
    const ortho = poseOf(orthographicCamera([0, 3, 5], 0, 18, 4, 2), [640, 360])
    expect(ortho.pixelsPerMetre).toBeCloseTo(640 / (2 * 4 * 2), 12)
  })

  it("agrees with the camera's own projection matrix (P[5] · h / 2 is f, P[0] · w / 2 is pixelsPerMetre)", () => {
    // Camera3D.computeProjection's perspective matrix has P[5] = 1 / tan(fov / zoom / 2) and its orthographic one
    // P[0] = 1 / size, with size = zoom · orthographicSize and the aspect on the vertical. Written out, not imported:
    // this file runs in Node, where Pixi is not loaded.
    const [w, h] = [640, 360]
    const camera = perspectiveCamera([0, 3, 5], 0, 31, 47, 1.5)
    const p5 = 1 / Math.tan(((camera.fov / camera.zoom) * (Math.PI / 180)) / 2)
    expect(poseOf(camera, [w, h]).f).toBeCloseTo((p5 * h) / 2, 9)
    const ortho = orthographicCamera([0, 3, 5], 0, 18, 4.5, 1.25)
    const p0 = 1 / (ortho.zoom * ortho.orthographicSize)
    expect(poseOf(ortho, [w, h]).pixelsPerMetre).toBeCloseTo((p0 * w) / 2, 9)
  })
})
