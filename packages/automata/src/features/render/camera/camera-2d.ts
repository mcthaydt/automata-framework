// camera2d: a presentation-only 2D camera. It writes the transform of the container it is given
// and never a coordinate the sim produced: children keep their own positions, so what a player sees and what
// the sim resolves never disagree. The follow's approach (`damp`) is a game's own to tune; a game-specific zoom stays in the game.

import type { Container } from 'pixi.js'
import { reducedMotion } from '../../../shared/ui/browser/reduced-motion.ts'

/** Trauma lost per second: a full shake (1) is gone in 2/3 s. */
export const SHAKE_DECAY = 1.5
/** The largest shake offset per axis, in logical px, at trauma 1. */
export const SHAKE_MAX_OFFSET = 8

/** A world-space rectangle, in logical px: `Camera2dOptions.bounds`. */
export interface CameraRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom. */
export interface Camera2dOptions {
  /** The playfield's logical size: the area the camera shows at zoom 1. */
  readonly view: { readonly width: number; readonly height: number }
  /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
  readonly follow?: {
    readonly rate: number
    readonly deadZone?: { readonly width: number; readonly height: number }
  }
  /** The world rect the view never shows outside of. */
  readonly bounds?: CameraRect
  /** Default 1; above 1 shows less of the world. */
  readonly zoom?: number
  /** Default: the player's `prefers-reduced-motion`, read every frame. */
  readonly reducedMotion?: () => boolean
}

/**
 * A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
 * container's transform, never a sim value.
 */
export interface Camera2d {
  /** The world point to follow. The first call snaps to it. */
  target(x: number, y: number): void
  /** Adds trauma, 0..1 (capped at 1); it decays over time. */
  shake(trauma: number): void
  /** Advances one display frame and writes the transform to the container. */
  update(frameSeconds: number): void
  readonly transform: { readonly x: number; readonly y: number; readonly scale: number }
}

/** Moves `value` toward `target` by `rate` per second, without overshooting. */
function damp(value: number, target: number, rate: number, seconds: number): number {
  return value + (target - value) * Math.min(1, rate * seconds)
}

/** The centre that keeps `target` within `half` of it: unchanged while inside, else on the zone's edge. */
function intoZone(centre: number, target: number, half: number): number {
  if (target > centre + half) return target - half
  if (target < centre - half) return target + half
  return centre
}

/** mulberry32: a small seeded generator, so a shake looks the same in every run and in visual tests. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** The centre on one axis that keeps a view `size` wide inside [min, min + extent]; centred when it cannot fit. */
function clampAxis(centre: number, size: number, min: number, extent: number): number {
  if (extent <= size) return min + extent / 2
  return Math.min(Math.max(centre, min + size / 2), min + extent - size / 2)
}

/**
 * A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
 * so a shake looks the same in every run and visual test.
 */
export function createCamera2d(stage: Container, options: Camera2dOptions, seed = 1): Camera2d {
  const zoom = options.zoom ?? 1
  // The world-space size the view shows.
  const visibleWidth = options.view.width / zoom
  const visibleHeight = options.view.height / zoom

  let targetX = 0
  let targetY = 0
  let centreX = 0
  let centreY = 0
  let hasTarget = false
  let trauma = 0
  const noise = mulberry32(seed)
  const isReduced = options.reducedMotion ?? (() => reducedMotion())
  const transform = { x: 0, y: 0, scale: zoom }

  const clamp = (x: number, y: number): { x: number; y: number } => {
    const bounds = options.bounds
    if (bounds === undefined) return { x, y }
    return {
      x: clampAxis(x, visibleWidth, bounds.x, bounds.width),
      y: clampAxis(y, visibleHeight, bounds.y, bounds.height),
    }
  }

  return {
    target(x, y) {
      targetX = x
      targetY = y
      if (!hasTarget) {
        hasTarget = true
        centreX = x
        centreY = y
      }
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount)
    },
    update(frameSeconds) {
      const follow = options.follow
      if (follow === undefined) {
        centreX = targetX
        centreY = targetY
      } else {
        const zone = follow.deadZone
        const wantX = zone === undefined ? targetX : intoZone(centreX, targetX, zone.width / 2)
        const wantY = zone === undefined ? targetY : intoZone(centreY, targetY, zone.height / 2)
        centreX = damp(centreX, wantX, follow.rate, frameSeconds)
        centreY = damp(centreY, wantY, follow.rate, frameSeconds)
      }
      // The camera's own centre stays clamped too, so leaving a corner starts from inside the bounds.
      const clamped = clamp(centreX, centreY)
      centreX = clamped.x
      centreY = clamped.y

      // The shake is added to what is drawn, never to the stored centre, so the follow does not drift with it.
      // Noise is drawn every frame, even under reduced motion, so the sequence does not depend on the setting.
      trauma = Math.max(0, trauma - SHAKE_DECAY * frameSeconds)
      const strength = isReduced() ? 0 : SHAKE_MAX_OFFSET * trauma * trauma
      const noiseX = noise() * 2 - 1
      const noiseY = noise() * 2 - 1
      const shown = clamp(centreX + strength * noiseX, centreY + strength * noiseY)

      transform.x = options.view.width / 2 - shown.x * zoom
      transform.y = options.view.height / 2 - shown.y * zoom
      stage.position.set(transform.x, transform.y)
      stage.scale.set(zoom)
    },
    transform,
  }
}
