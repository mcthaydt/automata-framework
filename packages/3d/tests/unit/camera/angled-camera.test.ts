// The gameplay camera on a real `@pixi/3d` camera, as the reference game's rules set it (Owner, 2026-11-10): a 50 mm lens
// in every view and a 30° home tilt; it follows the player with a time constant of 1/7 s and a dead zone; the player
// turns it in 45° steps and it eases round; automatic framing is a push-in dolly only (0.75–1×, 0.25× a second, held
// under reduce motion); a peek is an offset of at most 1.2 m; gameplay shake is a screen translation; and nothing ever
// yaws, pitches or rolls it by itself.
import { Camera3D, Matrix4 } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { angledCamera } from '#src/features/camera/angled-camera.ts'
import { eyeOf, type Vec3 } from '#src/features/camera/camera-pose.ts'
import { fovOf } from '#src/features/camera/fov.ts'
import { type CameraView, cameraView } from '#src/features/camera/sim/camera-view.schema.ts'
import { mapStick, Q16 } from '#src/features/camera/sim/stick-mapper.ts'

const hall = cameraView('hall')
const crypt = cameraView('crypt', { tiltDeg: 40, distance: 9 })
const VIEWS: CameraView[] = [hall, crypt]
const FRAME = 1 / 60
const DEGREES = Math.PI / 180

function rig(
  options: { reduced?: boolean; warn?: (m: string) => void; views?: CameraView[]; aspect?: number } = {},
) {
  const camera = new Camera3D()
  const warnings: string[] = []
  const made = angledCamera({
    camera,
    views: options.views ?? VIEWS,
    initial: options.views?.[0]?.id ?? 'hall',
    aspect: () => options.aspect ?? 16 / 9,
    reducedMotion: () => options.reduced ?? false,
    warn: options.warn ?? ((message) => warnings.push(message)),
    viewportHeight: () => 180,
  })
  return { camera, rig: made, warnings }
}

const positionOf = (camera: Camera3D): Vec3 => ({
  x: camera.position.x,
  y: camera.position.y,
  z: camera.position.z,
})

/** A camera's local axes from its transform: it faces its local −z, its right is local +x and its up local +y. */
function axesOf(camera: Camera3D): { forward: Vec3; right: Vec3; up: Vec3 } {
  camera.updateLocalTransform()
  const m = (camera.localTransform as unknown as { elements: ArrayLike<number> }).elements
  return {
    right: { x: m[0] ?? 0, y: m[1] ?? 0, z: m[2] ?? 0 },
    up: { x: m[4] ?? 0, y: m[5] ?? 0, z: m[6] ?? 0 },
    forward: { x: -(m[8] ?? 0), y: -(m[9] ?? 0), z: -(m[10] ?? 0) },
  }
}

const forwardOf = (camera: Camera3D): Vec3 => axesOf(camera).forward

const expectNear = (actual: Vec3, expected: Vec3, digits = 4) => {
  expect(actual.x).toBeCloseTo(expected.x, digits)
  expect(actual.y).toBeCloseTo(expected.y, digits)
  expect(actual.z).toBeCloseTo(expected.z, digits)
}

const FOCUS = { x: 0, y: 1, z: 0 }
/** The default view's eye for a focus and a heading: 30° down, 16 m back. */
const homeEye = (focus: Vec3, headingDeg = 0) => eyeOf(focus, headingDeg, 30, 16)

/** The heading the eye shows around the focus, in degrees [0, 360): the eye sits behind the focus. */
const headingOf = (camera: Camera3D, focus: Vec3 = FOCUS): number => {
  const degrees = Math.atan2(focus.x - camera.position.x, focus.z - camera.position.z) / DEGREES
  return (degrees + 360) % 360
}

/** The follow's ease for `seconds` of frame: 1 − e^(−t/lag), the default lag being 1/7 s. */
const ease = (seconds: number, lag = 1 / 7) => 1 - Math.exp(-seconds / lag)

describe('angledCamera: the default gameplay camera', () => {
  it('is a 50 mm lens, 26.99° vertical, in every view', () => {
    const { camera, rig: r } = rig()
    expect(r.lensMm).toBe(50)
    r.follow(0, 0, 0)
    r.update(FRAME)
    expect(camera.fov).toBeCloseTo(26.99, 2)
    r.activate('crypt', 'cut')
    r.update(FRAME)
    expect(camera.fov).toBe(fovOf(50))
  })

  it('stands 30° down and 16 m back from a focus 1 m above the player, looking at it', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS))
    const forward = forwardOf(camera)
    expect(forward.z).toBeGreaterThan(0)
    expect(Math.asin(-forward.y) / DEGREES).toBeCloseTo(30, 3)
  })

  it('follows the player’s height: the focus is 1 m above the floor the player stands on', () => {
    const { camera, rig: r } = rig()
    r.follow(1, 2.5, 1)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye({ x: 1, y: 3.5, z: 1 }))
  })
})

describe('the active view', () => {
  it('is the one the rig started in, then the one activated, and an unknown id leaves it', () => {
    const { rig: r } = rig()
    expect(r.active()).toBe('hall')
    r.activate('crypt', 'cut')
    expect(r.active()).toBe('crypt')
    r.activate('nowhere', 'cut')
    expect(r.active()).toBe('crypt')
  })
})

describe('the follow', () => {
  it('snaps on the first follow, then trails with a time constant of 1/7 s and never overshoots', () => {
    const { camera, rig: r } = rig()
    r.follow(2, 0, 3)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye({ x: 2, y: 1, z: 3 }))
    // Far enough past the dead zone that the look chases the player; the eye eases to where the look settles.
    r.follow(12, 0, 3)
    r.update(1 / 7)
    const gap = 10 - 0.3
    const expected = 2 + gap * ease(1 / 7)
    expect(positionOf(camera).x).toBeCloseTo(expected, 3)
    let last = positionOf(camera).x
    for (let frame = 0; frame < 120; frame++) {
      r.update(FRAME)
      const x = positionOf(camera).x
      expect(x).toBeGreaterThanOrEqual(last - 1e-9)
      expect(x).toBeLessThanOrEqual(12 - 0.3 + 1e-6)
      last = x
    }
    expect(last).toBeCloseTo(12 - 0.3, 2)
  })

  it('holds still while the player moves inside the 0.3 m dead zone (0.2 m in portrait)', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const rest = positionOf(camera)
    for (const x of [0.1, 0.25, -0.2, 0.29]) {
      r.follow(x, 0, 0)
      r.update(FRAME)
      expectNear(positionOf(camera), rest, 9)
    }
    r.follow(0.6, 0, 0)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    // It settles 0.3 m from the player, not on them.
    expect(positionOf(camera).x).toBeCloseTo(0.3, 3)

    const narrow = rig({ aspect: 9 / 16 })
    narrow.rig.follow(0, 0, 0)
    narrow.rig.update(FRAME)
    const narrowRest = positionOf(narrow.camera)
    narrow.rig.follow(0.19, 0, 0)
    narrow.rig.update(FRAME)
    expectNear(positionOf(narrow.camera), narrowRest, 9)
  })

  it('under reduced motion the follow has no lag', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.follow(4, 0, 0)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye({ x: 3.7, y: 1, z: 0 }))
  })

  it('keeps the look dead centre: the eye and the look ease together, so the camera does not turn while it catches up', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const before = forwardOf(camera)
    r.follow(8, 0, 5)
    for (let frame = 0; frame < 20; frame++) {
      r.update(FRAME)
      expectNear(forwardOf(camera), before, 6)
    }
  })

  it('keeps a locked-on look inside the view’s bounds when it has them', () => {
    const boxed = cameraView('room', { bounds: { min: [-1, 0, -1], max: [1, 2, 1] } })
    const { camera, rig: r } = rig({ views: [cameraView('hall'), boxed] })
    r.activate('room', 'cut')
    r.follow(6, 0, 0)
    r.frame({ x: 8, y: 0, z: 0 })
    r.update(FRAME)
    // Framing a lock-on clamps to the bounds; the dead zone then holds it a little off the player.
    expect(positionOf(camera).x).toBeLessThanOrEqual(1 + 1e-6)
  })

  it('frames a lock-on target by leaning toward it, and lets go with frame()', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.frame({ x: 4, y: 0, z: 0 })
    for (let frame = 0; frame < 120; frame++) r.update(FRAME)
    expect(positionOf(camera).x).toBeGreaterThan(0.1)
    expect(positionOf(camera).x).toBeLessThan(4 * 0.35 + 1e-6)
    r.frame()
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expect(Math.abs(positionOf(camera).x)).toBeLessThan(0.31)
  })
})

describe('the player turns the camera in 45° steps, and nothing else does', () => {
  it('eases to a new heading, the shorter way, and holds it at once under reduced motion', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.heading(350)
    r.update(FRAME)
    // Through 355°, not through 175°: part way after a frame, not there yet.
    const early = headingOf(camera)
    expect(early).toBeGreaterThan(350)
    expect(early).toBeLessThan(359.99)
    for (let frame = 0; frame < 120; frame++) r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS, 350), 2)

    const reduced = rig({ reduced: true })
    reduced.rig.follow(0, 0, 0)
    reduced.rig.update(FRAME)
    reduced.rig.heading(90)
    reduced.rig.update(FRAME)
    expectNear(positionOf(reduced.camera), homeEye(FOCUS, 90))
  })

  it('shows each of the eight headings level: the same pitch, no roll, the horizon flat', () => {
    for (let step = 0; step < 8; step++) {
      const { camera, rig: r } = rig()
      r.follow(0, 0, 0)
      r.heading(step * 45)
      r.update(FRAME)
      expectNear(positionOf(camera), homeEye(FOCUS, step * 45))
      const { forward, right } = axesOf(camera)
      expect(Math.asin(-forward.y) / DEGREES).toBeCloseTo(30, 3)
      expect(right.y).toBeCloseTo(0, 6)
      // Looking along the heading: (sin h, cos h) on the floor, tipped 30° down.
      expect(forward.x).toBeCloseTo(Math.sin(step * 45 * DEGREES) * Math.cos(30 * DEGREES), 4)
      expect(forward.z).toBeCloseTo(Math.cos(step * 45 * DEGREES) * Math.cos(30 * DEGREES), 4)
    }
  })

  it('never yaws, pitches or rolls by itself while the player walks, ducks into a zone and out', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.heading(90)
    r.update(FRAME)
    const start = axesOf(camera)
    let x = 0
    for (let frame = 0; frame < 400; frame++) {
      x += 0.04
      r.follow(x, 0, Math.sin(frame / 20) * 3)
      if (frame === 150) r.activate('hall', 'ease')
      r.update(FRAME)
      const now = axesOf(camera)
      expectNear(now.forward, start.forward, 6)
      expectNear(now.right, start.right, 6)
    }
  })

  it('a heading set while a turn is still easing carries on from where the camera is, without a snap', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.heading(90)
    for (let frame = 0; frame < 5; frame++) r.update(FRAME)
    const mid = headingOf(camera)
    r.heading(135)
    r.update(FRAME)
    expect(Math.abs(headingOf(camera) - mid)).toBeLessThan(20)
    for (let frame = 0; frame < 240; frame++) r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS, 135), 2)
  })

  it('moves the character away from the eye when the stick is up, and screen-right when it is right, through @pixi/3d', () => {
    for (const units of [0, 8_192, 16_384, 24_576, 32_768, 40_960, 49_152, 57_344]) {
      const { camera, rig: r } = rig()
      r.follow(0, 0, 0)
      r.heading((units * 360) / 65_536)
      r.update(FRAME)
      const { forward, right } = axesOf(camera)
      const eye = positionOf(camera)
      const up = mapStick({ x: 0, y: -127 }, units)
      const ahead = { x: up.x / Q16, z: up.z / Q16 }
      expect(Math.hypot(ahead.x - eye.x, ahead.z - eye.z)).toBeGreaterThan(Math.hypot(eye.x, eye.z))
      expect(ahead.x * forward.x + ahead.z * forward.z).toBeGreaterThan(0.85)
      const side = mapStick({ x: 127, y: 0 }, units)
      expect((side.x / Q16) * right.x + (side.z / Q16) * right.z).toBeGreaterThan(0.99)
    }
  })
})

describe('views', () => {
  it('activates a view with an ease, not at once, and a cut at once', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const start = positionOf(camera)
    const end = eyeOf(FOCUS, 0, 40, 9)
    r.activate('crypt', 'ease')
    r.update(0.1)
    const middle = positionOf(camera)
    expect(middle.y).toBeLessThan(start.y - 0.1)
    expect(middle.y).toBeGreaterThan(end.y + 0.1)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expectNear(positionOf(camera), end, 3)

    r.activate('hall', 'cut')
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS))
  })

  it('under reduced motion, an eased activation is a cut', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.activate('crypt', 'ease')
    r.update(FRAME)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 40, 9))
  })

  it('a cut snaps even into the view it is already in, and nothing is seeded before follow', () => {
    const { camera, rig: r } = rig()
    r.update(FRAME)
    r.update(FRAME)
    r.activate('hall', 'cut')
    r.follow(50, 0, 50)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye({ x: 50, y: 1, z: 50 }))
    r.activate('hall', 'cut')
    r.follow(-20, 0, 5)
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye({ x: -20, y: 1, z: 5 }))
  })

  it('holds a fixed zone’s authored shot, and pans a little toward the player inside its bounds', () => {
    const fixed = cameraView('fixed', {
      look: [0, 1.1, 0],
      follow: 0.12,
      bounds: { min: [-20, 0, -20], max: [20, 4, 20] },
    })
    const { camera, rig: r } = rig({ views: [fixed] })
    r.follow(0, 0, 0)
    r.update(FRAME)
    expectNear(positionOf(camera), eyeOf({ x: 0, y: 1.1, z: 0 }, 0, 30, 16))
    r.follow(60, 0, 0)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    // The look pans toward +x by the 2 m cap, and the eye with it.
    expectNear(positionOf(camera), eyeOf({ x: 2, y: 1.1, z: 0 }, 0, 30, 16), 3)
  })

  it('keeps its last view for an id that names none, and warns once', () => {
    const { camera, rig: r, warnings } = rig()
    r.follow(0, 0, 0)
    r.activate('nowhere', 'ease')
    r.activate('nowhere', 'cut')
    r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('nowhere')
  })

  it('takes new views with setViews', () => {
    const { camera, rig: r } = rig()
    r.setViews([cameraView('hall', { distance: 7 })])
    r.follow(0, 0, 0)
    r.update(FRAME)
    expectNear(positionOf(camera), eyeOf(FOCUS, 0, 30, 7))
  })

  it('refuses an initial view that is not among the views', () => {
    expect(() => angledCamera({ camera: new Camera3D(), views: VIEWS, initial: 'attic' })).toThrow(/attic/)
  })

  it('reports the pose it last wrote, for the occluder rule, and none before the first follow', () => {
    const { camera, rig: r } = rig()
    r.update(FRAME)
    expect(r.pose()).toBeUndefined()
    r.follow(3, 0, 2)
    r.update(FRAME)
    const pose = r.pose()
    expectNear(pose?.eye as Vec3, positionOf(camera))
    expectNear(pose?.look as Vec3, { x: 3, y: 1, z: 2 })
    expectNear(pose?.player as Vec3, { x: 3, y: 0, z: 2 })
    expect(pose?.cut).toBe(true)
    r.update(FRAME)
    expect(r.pose()?.cut).toBe(false)
  })
})

describe('automatic framing is a push-in dolly only', () => {
  const distanceOf = (camera: Camera3D) =>
    Math.hypot(camera.position.x - FOCUS.x, camera.position.y - FOCUS.y, camera.position.z - FOCUS.z)

  it('pushes in to 0.75× the zone’s distance at 0.25× a second, along the same line, lens unchanged', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const fov = camera.fov
    const direction = forwardOf(camera)
    r.framing(0.75)
    // One second in: a quarter of the authored distance covered at most, the camera's own ease trailing behind it.
    for (let frame = 0; frame < 60; frame++) r.update(FRAME)
    const oneSecond = distanceOf(camera)
    expect(oneSecond).toBeGreaterThan(16 * 0.75)
    expect(oneSecond).toBeLessThan(16)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expect(distanceOf(camera)).toBeCloseTo(16 * 0.75, 3)
    expect(camera.fov).toBe(fov)
    expectNear(forwardOf(camera), direction, 6)
  })

  it('takes at least a second to cover the share it is asked for', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.framing(0.75)
    r.update(0.5)
    r.update(0.4)
    // The framing itself is at 1 − 0.25 × 0.9 after 0.9 s; the eased eye can only be behind it.
    expect(distanceOf(camera)).toBeGreaterThan(16 * 0.775 - 1e-6)
  })

  it('never pulls back past the authored distance, nor pushes in past 0.75×', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.framing(1.6)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expect(distanceOf(camera)).toBeCloseTo(16, 4)
    r.framing(0.1)
    for (let frame = 0; frame < 600; frame++) r.update(FRAME)
    expect(distanceOf(camera)).toBeCloseTo(12, 4)
  })

  it('holds the authored distance under reduce motion', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(FRAME)
    r.framing(0.75)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expect(distanceOf(camera)).toBeCloseTo(16, 6)
  })
})

describe('peeking is an offset of at most 1.2 m with no rotation', () => {
  it('moves the camera along the floor by the peek, clamped to 1.2 m, and turns nothing', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const before = axesOf(camera)
    r.peek({ x: 3, z: 4 })
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    const eye = positionOf(camera)
    expect(eye.x).toBeCloseTo(0.72, 3)
    expect(eye.z).toBeCloseTo(homeEye(FOCUS).z + 0.96, 3)
    expect(Math.hypot(eye.x, eye.z - homeEye(FOCUS).z)).toBeCloseTo(1.2, 3)
    const after = axesOf(camera)
    expectNear(after.forward, before.forward, 6)
    expectNear(after.right, before.right, 6)
    r.peek(undefined)
    for (let frame = 0; frame < 300; frame++) r.update(FRAME)
    expectNear(positionOf(camera), homeEye(FOCUS), 3)
  })
})

describe('gameplay shake is a screen translation', () => {
  const metresPerPixel = (distance: number) => (2 * distance * Math.tan((fovOf(50) * DEGREES) / 2)) / 180

  it('moves the picture by whole pixels, 3 at most, with no rotation', () => {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    const rest = positionOf(camera)
    const axes = axesOf(camera)
    r.shake({ x: 10, y: 0 })
    r.update(FRAME)
    const moved = positionOf(camera)
    const delta = { x: moved.x - rest.x, y: moved.y - rest.y, z: moved.z - rest.z }
    // The picture moves right, so the camera moves left: along −right, by three pixels at the focus's distance.
    const along = delta.x * axes.right.x + delta.y * axes.right.y + delta.z * axes.right.z
    expect(along).toBeCloseTo(-3 * metresPerPixel(16), 6)
    const across = delta.x * axes.up.x + delta.y * axes.up.y + delta.z * axes.up.z
    expect(across).toBeCloseTo(0, 9)
    const after = axesOf(camera)
    expectNear(after.forward, axes.forward, 9)
    expectNear(after.right, axes.right, 9)
    r.shake(undefined)
    r.update(FRAME)
    expectNear(positionOf(camera), rest, 9)
  })

  it('is none under reduce motion', () => {
    const { camera, rig: r } = rig({ reduced: true })
    r.follow(0, 0, 0)
    r.update(FRAME)
    const rest = positionOf(camera)
    r.shake({ x: 3, y: 3 })
    r.update(FRAME)
    expectNear(positionOf(camera), rest, 12)
  })
})

describe('the default view frames a figure at 16 m through 50 mm', () => {
  // Through @pixi/3d's own projection: a figure at the followed point, feet to crown, as a share of the frame's height.
  function figureShare(aspect: number): number {
    const { camera, rig: r } = rig()
    r.follow(0, 0, 0)
    r.update(FRAME)
    camera.updateLocalTransform()
    const world = (camera.localTransform as unknown as { elements: ArrayLike<number> }).elements
    const projection = (
      camera.computeProjection(aspect, new Matrix4()) as unknown as { elements: ArrayLike<number> }
    ).elements
    const ndcY = (p: Vec3): number => {
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
  ])(
    'at %s fills about 19% of the frame’s height: the vertical field does not change with the width',
    (_, aspect) => {
      expect(figureShare(aspect)).toBeCloseTo(figureShare(16 / 9), 9)
      expect(figureShare(aspect)).toBeGreaterThan(0.17)
      expect(figureShare(aspect)).toBeLessThan(0.21)
    },
  )
})
