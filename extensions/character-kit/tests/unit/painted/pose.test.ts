import { Camera3D, Matrix4 } from '@pixi/3d'
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

  it('folds zoom in as @pixi/3d does: perspective divides tan(fov / 2), orthographic divides the size', () => {
    // zoom 2 at 53.13° (tan(fov / 2) = 0.5) and 360 high: f = 180 / (0.5 / 2) = 720. The beta.2 rule, which divided the
    // field of view itself, gave 762.5.
    const zoomed = poseOf(perspectiveCamera([0, 3, 5], 0, 31, FOV, 2), [640, 360])
    expect(zoomed.f).toBeCloseTo(180 / (Math.tan((FOV / 2) * (Math.PI / 180)) / 2), 9)
    expect(zoomed.f).toBeCloseTo(720, 6)
    // A larger zoom magnifies: size 4 m a side at zoom 2 is 2 m, so 640 / (2 * 2) pixels a metre (beta.2 multiplied: 80).
    const ortho = poseOf(orthographicCamera([0, 3, 5], 0, 18, 4, 2), [640, 360])
    expect(ortho.pixelsPerMetre).toBeCloseTo(640 / (2 * (4 / 2)), 12)
    expect(ortho.pixelsPerMetre).toBeCloseTo(160, 9)
  })

  it("agrees with a real Camera3D's projection matrix (P[5] · h / 2 is f, P[0] · w / 2 is pixelsPerMetre)", () => {
    // Read from `@pixi/3d` itself, not written out beside it, so the next beta that moves the rule fails here.
    const [w, h] = [640, 360]
    const matrix = new Matrix4()
    for (const zoom of [1, 1.5, 3]) {
      const camera = new Camera3D({ mode: 'perspective', fov: 47, zoom })
      camera.position.set(0, 3, 5)
      camera.computeProjection(w / h, matrix)
      // The matrix is Float32, so three decimals.
      expect(poseOf(camera, [w, h]).f).toBeCloseTo(((matrix.elements[5] ?? 0) * h) / 2, 3)
      const ortho = new Camera3D({ mode: 'orthographic', orthographicSize: 4.5, zoom })
      ortho.position.set(0, 3, 5)
      ortho.computeProjection(w / h, matrix)
      expect(poseOf(ortho, [w, h]).pixelsPerMetre).toBeCloseTo(((matrix.elements[0] ?? 0) * w) / 2, 3)
    }
  })
})
