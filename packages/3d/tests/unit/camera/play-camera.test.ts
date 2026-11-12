// The gameplay camera's rules, as pure functions (the reference game's play camera, ported): the follow shot with its
// central dead zone, the fixed zone's bounded room pan, `depthFollow`, the push-in-only dolly, the peek, the zone's
// enter margin, and the shake as a screen translation. The hand-worked numbers come from a 50 mm lens (26.99° vertical),
// a 30° tilt and a 16 m distance: the half height at the focus is 16·tan(13.496°) = 3.84 m.
import { describe, expect, it } from 'vitest'
import { fovOf } from '#src/features/camera/fov.ts'
import {
  clampPeek,
  FOLLOW_DEAD_ZONE,
  PEEK_REACH,
  PLAY_FRAMING,
  type Shot,
  shakeOffset,
  stepFraming,
  zoneShot,
} from '#src/features/camera/play-camera.ts'
import { type CameraView, cameraView } from '#src/features/camera/sim/camera-view.schema.ts'
import { viewAt } from '#src/features/camera/sim/view-zone.ts'

const LANDSCAPE = 16 / 9
const PORTRAIT = 9 / 16
const FOV = fovOf(50)
const HALF_HEIGHT = 16 * Math.tan((FOV * Math.PI) / 360)
const BOX = { min: [-20, 0, -20], max: [20, 4, 20] } as const

const follow = cameraView('follow')
const hall = cameraView('hall', { look: [0, 1.1, 0], follow: 0.12, bounds: BOX })

const near = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits)
const feet = (x: number, z: number, y = 0) => ({ x, y, z })
const horizontal = (shot: Shot) => Math.hypot(shot.offset.x, shot.offset.z)

describe('a locked-on view with a focus box', () => {
  const boxed = cameraView('boxed', { focusBounds: { min: [-2, 0], max: [3, 4] } })

  it('keeps the look inside the box on the floor, the player’s place however far out', () => {
    for (const [x, z, lx, lz] of [
      [10, 2, 3, 2],
      [-10, 2, -2, 2],
      [1, 20, 1, 4],
      [1, -20, 1, 0],
      [-9, 9, -2, 4],
    ] as const) {
      const look = zoneShot(boxed, feet(x, z), LANDSCAPE, FOV).look
      expect([look.x, look.z]).toEqual([lx, lz])
    }
  })

  it('leaves the look on the player inside the box, and the focus height as it was', () => {
    expect(zoneShot(boxed, feet(1, 2, 2.5), LANDSCAPE, FOV).look).toEqual({ x: 1, y: 3.5, z: 2 })
  })

  it('clamps the look it trails at as well: held at the edge, a player far out leaves it there', () => {
    const look = zoneShot(boxed, feet(40, 2), LANDSCAPE, FOV, { x: 3, y: 1, z: 2 }).look
    expect(look.x).toBe(3)
  })

  it('does nothing to a view without one, or to a fixed zone (which has its bounds)', () => {
    expect(zoneShot(follow, feet(40, 40), LANDSCAPE, FOV).look).toEqual({ x: 40, y: 1, z: 40 })
    const fixed = cameraView('fixed', {
      look: [0, 1, 0],
      follow: 0.5,
      focusBounds: { min: [-1, -1], max: [1, 1] },
      bounds: BOX,
    })
    near(zoneShot(fixed, feet(60, 0), LANDSCAPE, FOV).look.x, 2)
  })
})

describe('the follow shot (follow ≥ 1)', () => {
  it('looks at the player’s focus, 30° down from 16 m behind', () => {
    const shot = zoneShot(follow, feet(2, 3), LANDSCAPE, FOV)
    expect(shot.look).toEqual({ x: 2, y: 1, z: 3 })
    near(shot.offset.y, 16 * Math.sin(Math.PI / 6))
    near(shot.offset.z, -16 * Math.cos(Math.PI / 6))
    near(shot.offset.x, 0)
  })

  it('holds the look inside a dead zone of 0.3 m (0.2 m in portrait) around where it is', () => {
    expect(FOLLOW_DEAD_ZONE).toEqual({ landscape: 0.3, portrait: 0.2 })
    const held = { x: 0, y: 1, z: 0 }
    expect(zoneShot(follow, feet(0.29, 0), LANDSCAPE, FOV, held).look).toEqual(held)
    expect(zoneShot(follow, feet(0, -0.29), LANDSCAPE, FOV, held).look).toEqual(held)
    expect(zoneShot(follow, feet(0.19, 0), PORTRAIT, FOV, held).look).toEqual(held)
  })

  it('past the dead zone trails the player at its edge, not at the player', () => {
    const look = zoneShot(follow, feet(1, 0), LANDSCAPE, FOV, { x: 0, y: 1, z: 0 }).look
    near(look.x, 0.7)
    const portrait = zoneShot(follow, feet(1, 0), PORTRAIT, FOV, { x: 0, y: 1, z: 0 }).look
    near(portrait.x, 0.8)
  })

  it('follows the floor’s height, so stairs move the focus up with the player', () => {
    expect(zoneShot(follow, feet(0, 0, 2.5), LANDSCAPE, FOV).look.y).toBe(3.5)
  })

  it('drops the zone’s x skew: a locked-on shot looks straight on', () => {
    const skewed = cameraView('skewed', { x: 2.2 })
    expect(zoneShot(skewed, feet(0, 0), LANDSCAPE, FOV).offset.x).toBe(0)
  })

  it('pulls back in portrait by min(1.75, 0.85 / aspect) along the same line', () => {
    const wide = zoneShot(follow, feet(0, 0), LANDSCAPE, FOV)
    const narrow = zoneShot(follow, feet(0, 0), PORTRAIT, FOV)
    const pullback = Math.min(1.75, 0.85 / PORTRAIT)
    near(narrow.offset.y, wide.offset.y * pullback)
    near(narrow.offset.z, wide.offset.z * pullback)
    const thin = zoneShot(follow, feet(0, 0), 0.3, FOV)
    near(thin.offset.y, wide.offset.y * 1.75)
  })
})

describe('a fixed zone (follow < 1) pans a little, inside the room', () => {
  it('stands on the authored look when the player is at it', () => {
    const shot = zoneShot(hall, feet(0, 0), LANDSCAPE, FOV)
    expect(shot.look).toEqual({ x: 0, y: 1.1, z: 0 })
    expect(Math.hypot(shot.offset.y, horizontal(shot))).toBeCloseTo(16, 6)
  })

  it('leaves the look alone inside a quiet region: 0.18 of the screen’s width sideways, 0.244 of its height in depth', () => {
    const sideways = HALF_HEIGHT * LANDSCAPE * 0.18
    expect(zoneShot(hall, feet(sideways * 0.99, 0), LANDSCAPE, FOV).look.x).toBe(0)
    const depth = (HALF_HEIGHT * 0.244) / Math.sin(Math.PI / 6)
    expect(zoneShot(hall, feet(0, depth * 0.99), LANDSCAPE, FOV).look.z).toBe(0)
  })

  it('past it, follows by 0.45 (0.65 in portrait) of the excess, toward the player', () => {
    const quiet = HALF_HEIGHT * LANDSCAPE * 0.18
    const shot = zoneShot(hall, feet(quiet + 1, 0), LANDSCAPE, FOV)
    // Facing +z the screen’s right is −x; the look moves toward the player, so toward +x.
    near(shot.look.x, 0.45)
    // Portrait pulls back first, so the half height is that of the pulled-back distance.
    const pulled = HALF_HEIGHT * Math.min(1.75, 0.85 / PORTRAIT)
    const portrait = zoneShot(hall, feet(pulled * PORTRAIT * 0.18 + 1, 0), PORTRAIT, FOV)
    near(portrait.look.x, 0.65)
  })

  it('pans in depth toward the player too', () => {
    const quiet = (HALF_HEIGHT * 0.244) / Math.sin(Math.PI / 6)
    near(zoneShot(hall, feet(0, quiet + 2), LANDSCAPE, FOV).look.z, 0.9)
    near(zoneShot(hall, feet(0, -(quiet + 2)), LANDSCAPE, FOV).look.z, -0.9)
  })

  it('never pans more than 2 m (4 m in portrait) or a quarter (0.4) of the room', () => {
    near(zoneShot(hall, feet(60, 0), LANDSCAPE, FOV).look.x, 2)
    near(zoneShot(hall, feet(-60, 0), LANDSCAPE, FOV).look.x, -2)
    // A 40 m room: a quarter is 10 m, so the 2 m cap binds. A 6 m room: a quarter is 1.5 m.
    const small = cameraView('small', {
      look: [0, 1, 0],
      follow: 0,
      bounds: { min: [-3, 0, -3], max: [3, 4, 3] },
    })
    near(zoneShot(small, feet(60, 0), LANDSCAPE, FOV).look.x, 1.5)
    near(zoneShot(hall, feet(60, 0), PORTRAIT, FOV).look.x, 4)
  })

  it('keeps the look inside the zone’s bounds', () => {
    const tight = cameraView('tight', {
      look: [0, 1, 0],
      follow: 0.5,
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 4, 0.5] },
    })
    expect(zoneShot(tight, feet(60, 60), LANDSCAPE, FOV).look.x).toBeLessThanOrEqual(0.5)
    expect(zoneShot(tight, feet(60, 60), LANDSCAPE, FOV).look.z).toBeLessThanOrEqual(0.5)
  })

  it('is a still shot with no bounds', () => {
    const still = cameraView('still', { look: [1, 1, 1], follow: 0 })
    expect(zoneShot(still, feet(40, 40), LANDSCAPE, FOV).look).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('only translates: the eye keeps its offset from the look, so no yaw, pitch or roll', () => {
    const rest = zoneShot(hall, feet(0, 0), LANDSCAPE, FOV).offset
    for (const [x, z] of [
      [5, 0],
      [-9, 7],
      [30, -30],
    ] as const)
      expect(zoneShot(hall, feet(x, z), LANDSCAPE, FOV).offset).toEqual(rest)
  })

  it('takes the authored x skew: the camera stands off to the side of the look', () => {
    const closet = cameraView('closet', { look: [2.8, 0.6, -4.4], x: 2.2, follow: 0 })
    near(zoneShot(closet, feet(2.8, -4.4), LANDSCAPE, FOV).offset.x, -0.6)
  })

  it('moves the look in depth by rate per metre from `about` with depthFollow', () => {
    const deep = cameraView('deep', {
      look: [0, 1, 0],
      follow: 0.12,
      depthFollow: { rate: 0.15, about: 2 },
      bounds: BOX,
    })
    // Read with the player inside the quiet region, where the pan adds nothing: look z = rate × (z − about).
    near(zoneShot(deep, feet(0, 0), LANDSCAPE, FOV).look.z, -0.3)
    near(zoneShot(deep, feet(0, 1), LANDSCAPE, FOV).look.z, -0.15)
    near(zoneShot(deep, feet(0, -1), LANDSCAPE, FOV).look.z, -0.45)
  })
})

describe('automatic framing is a push-in dolly only', () => {
  it('is bounded to 0.75–1× the zone’s distance, at most 0.25× a second', () => {
    expect(PLAY_FRAMING).toEqual({ min: 0.75, max: 1, rate: 0.25 })
  })

  it('moves toward what is wanted at 0.25 a second and no faster', () => {
    near(stepFraming(1, 0.75, 1 / 60, false), 1 - 0.25 / 60)
    near(stepFraming(1, 0.75, 0.5, false), 0.875)
    expect(stepFraming(1, 0.75, 10, false)).toBe(0.75)
  })

  it('never pulls back past the authored distance, nor pushes in past 0.75×', () => {
    expect(stepFraming(0.8, 1.4, 10, false)).toBe(1)
    expect(stepFraming(1, 0.2, 10, false)).toBe(0.75)
    expect(stepFraming(0.75, 0.75, 1, false)).toBe(0.75)
  })

  it('holds the authored distance under reduce motion', () => {
    expect(stepFraming(0.8, 0.75, 1, true)).toBe(1)
  })

  it('ignores a negative frame', () => {
    expect(stepFraming(0.9, 0.75, -1, false)).toBe(0.9)
  })
})

describe('peeking is an offset of at most 1.2 m, with no rotation', () => {
  it('is 1.2 m at most', () => {
    expect(PEEK_REACH).toBe(1.2)
    expect(clampPeek({ x: 0.5, z: 0.5 })).toEqual({ x: 0.5, z: 0.5 })
    const far = clampPeek({ x: 3, z: 4 })
    near(Math.hypot(far.x, far.z), 1.2)
    near(far.x / far.z, 3 / 4)
  })
})

describe('a zone is entered 0.25 m inside it (the hysteresis), and left when the player is outside', () => {
  const west = cameraView('west', { bounds: { min: [-10, 0, -5], max: [0, 4, 5] } })
  const east = cameraView('east', { bounds: { min: [0, 0, -5], max: [10, 4, 5] } })
  const views: CameraView[] = [west, east]

  it('has an enter margin of 0.25 m by default and takes another', () => {
    expect(west.enterMargin).toBe(0.25)
    expect(cameraView('wide', { enterMargin: 0.5 }).enterMargin).toBe(0.5)
  })

  it('does not switch on the threshold, but 0.25 m beyond it', () => {
    expect(viewAt(views, { x: 0.1, z: 0 }, 'west')?.id).toBe('west')
    expect(viewAt(views, { x: 0.249, z: 0 }, 'west')?.id).toBe('west')
    expect(viewAt(views, { x: 0.251, z: 0 }, 'west')?.id).toBe('east')
  })

  it('does not flicker back: the way out is the same margin', () => {
    expect(viewAt(views, { x: -0.1, z: 0 }, 'east')?.id).toBe('east')
    expect(viewAt(views, { x: -0.251, z: 0 }, 'east')?.id).toBe('west')
  })

  it('stays in the current view when no other zone holds the player', () => {
    expect(viewAt(views, { x: 40, z: 0 }, 'west')?.id).toBe('west')
  })

  it('uses a zone’s own margin', () => {
    const wide = cameraView('wide', { bounds: { min: [0, 0, -5], max: [10, 4, 5] }, enterMargin: 1 })
    expect(viewAt([west, wide], { x: 0.9, z: 0 }, 'west')?.id).toBe('west')
    expect(viewAt([west, wide], { x: 1.1, z: 0 }, 'west')?.id).toBe('wide')
  })

  it('has no view for no views', () => {
    expect(viewAt([], { x: 0, z: 0 }, 'west')).toBeUndefined()
  })
})

describe('gameplay shake is a screen translation within the feel limits', () => {
  it('is 3 px at most on each axis, rounded to whole pixels', () => {
    expect(shakeOffset({ x: 10, y: -10 }, false)).toEqual({ x: 3, y: -3 })
    expect(shakeOffset({ x: 1.4, y: 0.4 }, false)).toEqual({ x: 1, y: 0 })
  })

  it('is none under reduce motion', () => {
    expect(shakeOffset({ x: 3, y: 3 }, true)).toEqual({ x: 0, y: 0 })
  })
})
