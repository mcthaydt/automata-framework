import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { type Camera2dOptions, createCamera2d, SHAKE_DECAY, SHAKE_MAX_OFFSET } from './camera-2d.ts'

const VIEW = { width: 320, height: 180 }
const FRAME = 1 / 60
const still = (): boolean => false

/** The world point drawn at the view's centre: the camera's centre, read back from the transform. */
function centreOf(transform: { x: number; y: number; scale: number }): { x: number; y: number } {
  return {
    x: (VIEW.width / 2 - transform.x) / transform.scale,
    y: (VIEW.height / 2 - transform.y) / transform.scale,
  }
}

function camera(options: Partial<Camera2dOptions> = {}, stage = new Container()) {
  return createCamera2d(stage, { view: VIEW, reducedMotion: still, ...options })
}

describe('camera2d follow (M4 spec §4.10, C-a)', () => {
  it('snaps to the first target rather than travelling from the origin', () => {
    const cam = camera({ follow: { rate: 6 } })
    cam.target(500, 300)
    cam.update(FRAME)
    expect(centreOf(cam.transform)).toEqual({ x: 500, y: 300 })
  })

  it('without follow, sits on the target every frame', () => {
    const cam = camera()
    cam.target(10, 20)
    cam.update(FRAME)
    cam.target(400, -50)
    cam.update(FRAME)
    expect(centreOf(cam.transform)).toEqual({ x: 400, y: -50 })
  })

  it('never overshoots: a rate × Δt above 1 lands on the target (FloorFifty damp)', () => {
    const cam = camera({ follow: { rate: 120 } })
    cam.target(0, 0)
    cam.update(FRAME)
    cam.target(100, 0)
    cam.update(FRAME)
    expect(centreOf(cam.transform).x).toBe(100)
  })

  it('settles a 100 px step within 0.5 px in exactly the frames its rate gives', () => {
    // Each frame keeps (1 − rate·Δt) of the gap: 0.9 at rate 6 and 60 Hz, so ceil(ln 0.005 / ln 0.9) = 51.
    const frames = Math.ceil(Math.log(0.005) / Math.log(1 - 6 * FRAME))
    expect(frames).toBe(51)
    const cam = camera({ follow: { rate: 6 } })
    cam.target(0, 0)
    cam.update(FRAME)
    cam.target(100, 0)
    for (let frame = 0; frame < frames - 1; frame += 1) cam.update(FRAME)
    expect(100 - centreOf(cam.transform).x).toBeGreaterThan(0.5)
    cam.update(FRAME)
    expect(100 - centreOf(cam.transform).x).toBeLessThanOrEqual(0.5)
  })

  it('holds still while the target stays inside the dead zone, then keeps it on the zone edge', () => {
    const cam = camera({ follow: { rate: 1000, deadZone: { width: 40, height: 20 } } })
    cam.target(100, 100)
    cam.update(FRAME)
    cam.target(115, 108)
    cam.update(FRAME)
    expect(centreOf(cam.transform)).toEqual({ x: 100, y: 100 })
    cam.target(150, 100)
    cam.update(FRAME)
    // The zone is 40 wide around the centre, so the target ends 20 px right of it.
    expect(centreOf(cam.transform)).toEqual({ x: 130, y: 100 })
  })
})

describe('camera2d bounds (C-a)', () => {
  const bounds = { x: 0, y: 0, width: 960, height: 540 }

  it('never shows outside the bounds, at every corner', () => {
    const cam = camera({ bounds })
    for (const [x, y] of [
      [-500, -500],
      [2000, -500],
      [2000, 2000],
      [-500, 2000],
    ] as const) {
      cam.target(x, y)
      cam.update(FRAME)
      const { x: cx, y: cy } = centreOf(cam.transform)
      expect(cx - VIEW.width / 2).toBeGreaterThanOrEqual(bounds.x)
      expect(cx + VIEW.width / 2).toBeLessThanOrEqual(bounds.x + bounds.width)
      expect(cy - VIEW.height / 2).toBeGreaterThanOrEqual(bounds.y)
      expect(cy + VIEW.height / 2).toBeLessThanOrEqual(bounds.y + bounds.height)
    }
  })

  it('keeps a zoomed-in view inside the bounds by its smaller visible size', () => {
    const cam = camera({ bounds, zoom: 2 })
    cam.target(0, 0)
    cam.update(FRAME)
    expect(centreOf(cam.transform)).toEqual({ x: VIEW.width / 4, y: VIEW.height / 4 })
  })

  it('centres on bounds smaller than the view', () => {
    const cam = camera({ bounds: { x: 10, y: 20, width: 100, height: 400 } })
    cam.target(1000, 0)
    cam.update(FRAME)
    expect(centreOf(cam.transform)).toEqual({ x: 60, y: 110 })
  })
})

describe('camera2d transform', () => {
  it('writes scale = zoom and the centring offset to the container it was given, and nothing else', () => {
    const stage = new Container()
    const child = new Container()
    child.position.set(42, 7)
    stage.addChild(child)
    const cam = camera({ zoom: 1.5 }, stage)
    cam.target(200, 100)
    cam.update(FRAME)
    expect(cam.transform).toEqual({ x: 160 - 200 * 1.5, y: 90 - 100 * 1.5, scale: 1.5 })
    expect([stage.position.x, stage.position.y, stage.scale.x, stage.scale.y]).toEqual([
      160 - 300,
      90 - 150,
      1.5,
      1.5,
    ])
    // Presentation only: a child keeps the coordinates the sim gave it (FloorFifty worldToLogical).
    expect([child.position.x, child.position.y]).toEqual([42, 7])
  })
})

describe('camera2d shake (C-b)', () => {
  /** The shake offset from the camera's resting centre, per frame, for `frames` frames after `shake(trauma)`. */
  function offsets(options: Partial<Camera2dOptions>, trauma: number, frames: number, seed?: number) {
    const cam = createCamera2d(new Container(), { view: VIEW, reducedMotion: still, ...options }, seed)
    cam.target(480, 270)
    cam.update(FRAME)
    cam.shake(trauma)
    const out: { x: number; y: number }[] = []
    for (let frame = 0; frame < frames; frame += 1) {
      cam.update(FRAME)
      const centre = centreOf(cam.transform)
      out.push({ x: centre.x - 480, y: centre.y - 270 })
    }
    return out
  }

  it('moves the view, the same way every run for the same seed', () => {
    const first = offsets({}, 1, 10, 7)
    expect(first.some(({ x, y }) => x !== 0 || y !== 0)).toBe(true)
    expect(offsets({}, 1, 10, 7)).toEqual(first)
    expect(offsets({}, 1, 10, 8)).not.toEqual(first)
  })

  it('stays within SHAKE_MAX_OFFSET × trauma² and is still after the trauma decays (1 / SHAKE_DECAY s)', () => {
    const frames = offsets({}, 0.5, 90)
    for (const { x, y } of frames) {
      expect(Math.abs(x)).toBeLessThanOrEqual(SHAKE_MAX_OFFSET * 0.25)
      expect(Math.abs(y)).toBeLessThanOrEqual(SHAKE_MAX_OFFSET * 0.25)
    }
    // 0.5 trauma decays at SHAKE_DECAY per second: gone after 0.5 / 1.5 s, 20 frames.
    expect(Math.ceil((0.5 / SHAKE_DECAY) * 60)).toBe(20)
    for (const { x, y } of frames.slice(21)) expect([x, y]).toEqual([0, 0])
  })

  it('moves nothing under reduced motion', () => {
    for (const { x, y } of offsets({ reducedMotion: () => true }, 1, 30)) expect([x, y]).toEqual([0, 0])
  })

  it('never shakes the view outside the bounds', () => {
    const bounds = { x: 0, y: 0, width: 960, height: 540 }
    const cam = createCamera2d(new Container(), { view: VIEW, reducedMotion: still, bounds }, 3)
    cam.target(0, 0)
    cam.update(FRAME)
    for (let frame = 0; frame < 30; frame += 1) {
      cam.shake(1)
      cam.update(FRAME)
      const { x, y } = centreOf(cam.transform)
      expect(x - VIEW.width / 2).toBeGreaterThanOrEqual(0)
      expect(y - VIEW.height / 2).toBeGreaterThanOrEqual(0)
    }
  })
})
