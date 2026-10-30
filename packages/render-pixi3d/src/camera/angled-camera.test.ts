// D3-a and D3-j on a real `@pixi/3d` camera: the lens is 24 mm in every view; activating a view with `ease` reaches it
// in 400 ms and at once under reduced motion; a heading tracked from the sim shows in the same frame; a view entry's
// heading eases over 250 ms; the follow lags inside bounds; an unknown view keeps the last and warns once.
import { Camera3D, Matrix4 } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { type CameraView, cameraView } from '../sim/camera-view.schema.js'
import { mapStick, Q16 } from '../sim/stick-mapper.js'
import { angledCamera } from './angled-camera.js'
import { eyeOf, type Vec3 } from './camera-pose.js'
import { fovOf } from './fov.js'

const hall = cameraView('hall')
const crypt = cameraView('crypt', { tiltDeg: 50, distance: 9 })
const VIEWS: CameraView[] = [hall, crypt]

function rig(options: { reduced?: boolean; warn?: (m: string) => void; views?: CameraView[] } = {}) {
  const camera = new Camera3D()
  const warnings: string[] = []
  const made = angledCamera({
    camera,
    views: options.views ?? VIEWS,
    initial: 'hall',
    aspect: () => 16 / 9,
    reducedMotion: () => options.reduced ?? false,
    warn: options.warn ?? ((message) => warnings.push(message)),
  })
  return { camera, rig: made, warnings }
}

const positionOf = (camera: Camera3D): Vec3 => ({
  x: camera.position.x,
  y: camera.position.y,
  z: camera.position.z,
})

/** The camera's forward direction from its transform (a camera faces its local −z). */
function forwardOf(camera: Camera3D): Vec3 {
  camera.updateLocalTransform()
  const m = (camera.localTransform as unknown as { elements: ArrayLike<number> }).elements
  return { x: -(m[8] ?? 0), y: -(m[9] ?? 0), z: -(m[10] ?? 0) }
}

const expectNear = (actual: Vec3, expected: Vec3, digits = 4) => {
  expect(actual.x).toBeCloseTo(expected.x, digits)
  expect(actual.y).toBeCloseTo(expected.y, digits)
  expect(actual.z).toBeCloseTo(expected.z, digits)
}

const FOCUS = { x: 0, y: 1, z: 0 }

describe('angledCamera', () => {
  it('is a 24 mm lens, 53.13° vertical, in every view', () => {
    const { camera, rig: r } = rig()
    expect(r.lensMm).toBe(24)
    r.follow(0, 0, 0)
    r.update(1 / 60)
    expect(camera.fov).toBeCloseTo(53.13, 2)
    r.activate('crypt', 'cut')
    r.update(1 / 60)
    expect(camera.fov).toBe(fovOf(24))
  })

  it('stands at the Owner’s view behind the followed point, and looks at the focus 1 m above it', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 25, 5))
    const forward = forwardOf(camera)
    expect(forward.z).toBeGreaterThan(0)
    expect(Math.asin(-forward.y) / (Math.PI / 180)).toBeCloseTo(25, 3)
  })

  it('shows a tracked heading in the same frame, with no ease (D3-a)', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.heading(90)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 90, 25, 5))
    // N units of turn are N/65,536 of a turn on screen: one unit is 360/65,536 degrees.
    r.heading(90 + 360 / 65_536)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 90 + 360 / 65_536, 25, 5), 6)
  })

  it('eases a view’s heading over 250 ms, the shorter way, and at once under reduced motion', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.heading(350, 'ease')
    r.update(0.125)
    // Half the time is half the turn (smoothstep), toward 350° through 355°, not through 175°.
    expectNear(positionOf(camera), eyeOf(FOCUS, 355, 25, 5))
    // The renderer tracks the same target every frame: that lets the ease finish.
    r.heading(350)
    r.update(0.1)
    expect(positionOf(camera).x).not.toBeCloseTo(eyeOf(FOCUS, 350, 25, 5).x, 3)
    r.heading(350)
    r.update(0.025)
    expectNear(positionOf(camera), eyeOf(FOCUS, 350, 25, 5))

    const reduced = rig({ reduced: true })
    reduced.rig.follow(0, 0, 0)
    reduced.rig.update(1 / 60)
    reduced.rig.heading(90, 'ease')
    reduced.rig.update(1 / 60)
    expectNear(positionOf(reduced.camera), eyeOf(FOCUS, 90, 25, 5))
  })

  it('a player’s turn during a view entry’s ease shifts the ease’s target instead of snapping (review #245, 3)', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.heading(180, 'ease')
    r.update(0.05)
    const before = positionOf(camera)
    // One degree of turn while the view's heading is still easing in.
    r.heading(181)
    r.update(1 / 60)
    const after = positionOf(camera)
    // No snap: one frame later the camera has moved a little, nowhere near the 181° eye.
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(2)
    expect(
      Math.hypot(after.x - eyeOf(FOCUS, 181, 25, 5).x, after.z - eyeOf(FOCUS, 181, 25, 5).z),
    ).toBeGreaterThan(2)
    r.heading(181)
    r.update(0.25)
    expectNear(positionOf(camera), eyeOf(FOCUS, 181, 25, 5))
  })

  it('a tracked heading with no ease running shows at once', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.heading(10)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 10, 25, 5))
  })

  it('a cut snaps even into the view it is already in, and nothing is seeded before follow (review #245, 1)', () => {
    const { camera, rig: r } = rig()
    // The renderer draws frames before the player's row exists.
    r.update(1 / 60)
    r.update(1 / 60)
    r.activate('hall', 'cut')
    r.follow(50, 0, 50)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf({ x: 50, y: 1, z: 50 }, 0, 25, 5))
    // A reset and a new sim with the player elsewhere: the same view, cut again.
    r.activate('hall', 'cut')
    r.follow(-20, 0, 5)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf({ x: -20, y: 1, z: 5 }, 0, 25, 5))
  })

  it('reports the pose it last wrote, for the occluder rule, and none before the first follow (M3.4c)', () => {
    const { camera, rig: r } = rig()
    r.update(1 / 60)
    expect(r.pose()).toBeUndefined()
    r.follow(3, 0, 2)
    r.update(1 / 60)
    const pose = r.pose()
    expectNear(pose?.eye as Vec3, positionOf(camera))
    expectNear(pose?.look as Vec3, { x: 3, y: 1, z: 2 })
    expectNear(pose?.player as Vec3, { x: 3, y: 0, z: 2 })
  })

  it('under reduced motion the follow has no lag (spec §8)', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.follow(4, 0, 0)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf({ x: 4, y: 1, z: 0 }, 0, 25, 5))
  })

  it('moves the character away from the eye when the stick is up, and screen-right when it is right, through @pixi/3d (review #245, 6)', () => {
    for (const units of [0, 5_000, 16_384, 30_000, 40_960, 61_000]) {
      const { camera, rig: r } = rig()
      r.follow(0, 0, 0)
      r.heading((units * 360) / 65_536)
      r.update(1 / 60)
      camera.updateLocalTransform()
      const m = (camera.localTransform as unknown as { elements: ArrayLike<number> }).elements
      const right = { x: m[0] ?? 0, z: m[2] ?? 0 }
      const forward = { x: -(m[8] ?? 0), z: -(m[10] ?? 0) }
      const eye = positionOf(camera)
      const up = mapStick({ x: 0, y: -127 }, units)
      const ahead = { x: up.x / Q16, z: up.z / Q16 }
      // Away from the eye on the floor, and along the camera's own forward.
      expect(Math.hypot(ahead.x - eye.x, ahead.z - eye.z)).toBeGreaterThan(Math.hypot(eye.x, eye.z))
      expect(ahead.x * forward.x + ahead.z * forward.z).toBeGreaterThan(0.85)
      const side = mapStick({ x: 127, y: 0 }, units)
      expect((side.x / Q16) * right.x + (side.z / Q16) * right.z).toBeGreaterThan(0.99)
    }
  })

  it('activates a view with an ease over 400 ms, not before, and a cut at once (D3-a)', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    const start = positionOf(camera)
    const end = eyeOf(FOCUS, 0, 50, 9)
    r.activate('crypt', 'ease')
    r.update(0.2)
    const middle = positionOf(camera)
    expect(middle.y).toBeGreaterThan(start.y + 0.1)
    expect(middle.y).toBeLessThan(end.y - 0.1)
    r.update(0.19)
    expect(positionOf(camera).y).toBeLessThan(end.y - 1e-4)
    r.update(0.01)
    expectNear(positionOf(camera), end)

    r.activate('hall', 'cut')
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 25, 5))
  })

  it('under reduced motion, an eased activation is a cut', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(1 / 60)
    r.activate('crypt', 'ease')
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 50, 9))
  })

  it('follows with lag: the first follow snaps, then the focus eases toward the player', () => {
    const { camera, rig: r } = rig()
    r.follow(2, 0, 3)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf({ x: 2, y: 1, z: 3 }, 0, 25, 5))
    r.follow(4, 0, 3)
    r.update(0.18)
    // One lag's time closes 1 − 1/e of the gap.
    const reached = 2 + 2 * (1 - Math.exp(-1))
    expectNear(positionOf(camera), eyeOf({ x: reached, y: 1, z: 3 }, 0, 25, 5))
    r.update(5)
    expectNear(positionOf(camera), eyeOf({ x: 4, y: 1, z: 3 }, 0, 25, 5))
  })

  it('keeps the focus inside the view’s bounds', () => {
    const boxed = cameraView('room', { bounds: { min: [-1, 0, -1], max: [1, 2, 1] } })
    const { camera, rig: r } = rig({ views: [cameraView('hall'), boxed] })
    r.activate('room', 'cut')
    r.follow(6, 0, 0)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf({ x: 1, y: 1, z: 0 }, 0, 25, 5))
  })

  it('frames a lock-on target, and lets go with frame()', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.frame({ x: 2, y: 0, z: 0 })
    r.update(10)
    expectNear(positionOf(camera), eyeOf({ x: 0.7, y: 1, z: 0 }, 0, 25, 5))
    r.frame()
    r.update(10)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 25, 5))
  })

  it('keeps its last view for an id that names none, and warns once', () => {
    const { camera, rig: r, warnings } = rig()
    r.follow(0, 0, 0)
    r.activate('nowhere', 'ease')
    r.activate('nowhere', 'cut')
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 25, 5))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('nowhere')
  })

  it('takes new views with setViews', () => {
    const { camera, rig: r } = rig()
    r.setViews([cameraView('hall', { distance: 7 })])
    r.follow(0, 0, 0)
    r.update(1 / 60)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 25, 7))
  })

  it('refuses an initial view that is not among the views', () => {
    expect(() => angledCamera({ camera: new Camera3D(), views: VIEWS, initial: 'attic' })).toThrow(/attic/)
  })
})

describe('the default view frames a 1.62 m figure (D3-j)', () => {
  // Through @pixi/3d's own projection: a figure at the followed point, feet to crown, as a share of the frame's height.
  function figureShare(aspect: number): number {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(1 / 60)
    camera.updateLocalTransform()
    const world = (camera.localTransform as unknown as { elements: ArrayLike<number> }).elements
    const projection = (
      camera.computeProjection(aspect, new Matrix4()) as unknown as { elements: ArrayLike<number> }
    ).elements
    const ndcY = (p: Vec3): number => {
      // The view matrix is the inverse of the camera's rigid transform: rotate the offset by its transpose.
      const d = { x: p.x - (world[12] ?? 0), y: p.y - (world[13] ?? 0), z: p.z - (world[14] ?? 0) }
      const viewY = d.x * (world[4] ?? 0) + d.y * (world[5] ?? 0) + d.z * (world[6] ?? 0)
      const viewZ = d.x * (world[8] ?? 0) + d.y * (world[9] ?? 0) + d.z * (world[10] ?? 0)
      return ((projection[5] ?? 0) * viewY) / -viewZ
    }
    return (ndcY({ x: 0, y: 1.62, z: 0 }) - ndcY({ x: 0, y: 0, z: 0 })) / 2
  }

  it.each([
    ['16:9', 16 / 9],
    ['4:3', 4 / 3],
    ['21:9', 21 / 9],
  ])('at %s fills at least 25% of the frame’s height (measured: 28.6%)', (_, aspect) => {
    const share = figureShare(aspect)
    expect(share).toBeGreaterThanOrEqual(0.25)
    expect(share).toBeCloseTo(0.286, 3)
  })
})
