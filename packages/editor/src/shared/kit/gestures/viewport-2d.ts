// The 2D canvas's pan and zoom: where the world is on the screen, and the conversions. An
// immutable value: every method returns a new viewport, so a pinch, a wheel step and a "fit" are plain functions of the
// previous state and the editor can keep the viewport in a Svelte store without cloning.

// `Point` is the field module's: one definition for the kit, exported once from the root entry.
import type { Point } from '@automata/content/level-2d'

export interface Size {
  readonly w: number
  readonly h: number
}

/** A rectangle in world units. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface ViewportLimits {
  readonly minZoom: number
  readonly maxZoom: number
  /** The level, in world units: panning keeps `keep` screen pixels of it in view on each axis. */
  readonly bounds?: Rect | undefined
  readonly keep: number
}

export interface ViewportInit {
  /** The canvas's size in screen pixels. */
  readonly size: Size
  /** Screen position of the world origin. Default (0, 0). */
  readonly pan?: Point
  /** Screen pixels per world unit. Default 1. */
  readonly zoom?: number
  readonly limits?: Partial<ViewportLimits>
}

export interface Viewport2D {
  readonly size: Size
  /** Screen position of the world origin. */
  readonly pan: Point
  /** Screen pixels per world unit. */
  readonly zoom: number
  readonly limits: ViewportLimits
  screenToWorld(point: Point): Point
  worldToScreen(point: Point): Point
  /** Slides the content by a screen delta, so it follows the pointer. */
  panBy(dx: number, dy: number): Viewport2D
  /** Multiplies the zoom by `factor` (clamped to the limits) keeping the world point under `point` where it is. */
  zoomAt(point: Point, factor: number): Viewport2D
  /** Above 100% rounds the zoom to the nearest 1/8 about `point`; at or below 100% leaves it alone. */
  snapZoom(point: Point): Viewport2D
  /** Centres `rect` at the largest zoom that shows all of it inside `padding` screen pixels. */
  fit(rect: Rect, padding?: number): Viewport2D
  /** A new canvas size; the world point at the centre stays at the centre. */
  resize(size: Size): Viewport2D
}

const DEFAULT_LIMITS: ViewportLimits = { minZoom: 1 / 32, maxZoom: 64, keep: 64 }
/** Above 100% the zoom settles on multiples of this fraction, so pixels stay crisp. */
const SNAP_STEP = 8

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/**
 * Pan on one axis so that at least `keep` pixels of the bounds stay in `extent` pixels of screen. A level shorter than
 * `keep` stays whole on screen.
 */
function clampAxis(
  pan: number,
  extent: number,
  origin: number,
  length: number,
  zoom: number,
  keep: number,
): number {
  const kept = Math.min(keep, length * zoom)
  const low = kept - (origin + length) * zoom
  const high = extent - kept - origin * zoom
  return low > high ? (low + high) / 2 : clamp(pan, low, high)
}

function build(size: Size, pan: Point, zoom: number, limits: ViewportLimits): Viewport2D {
  const bounds = limits.bounds
  const settled: Point = bounds
    ? {
        x: clampAxis(pan.x, size.w, bounds.x, bounds.w, zoom, limits.keep),
        y: clampAxis(pan.y, size.h, bounds.y, bounds.h, zoom, limits.keep),
      }
    : pan

  const viewport: Viewport2D = {
    size,
    pan: settled,
    zoom,
    limits,
    screenToWorld: (point) => ({ x: (point.x - settled.x) / zoom, y: (point.y - settled.y) / zoom }),
    worldToScreen: (point) => ({ x: point.x * zoom + settled.x, y: point.y * zoom + settled.y }),

    panBy: (dx, dy) => build(size, { x: settled.x + dx, y: settled.y + dy }, zoom, limits),

    zoomAt(point, factor) {
      const next = clamp(zoom * factor, limits.minZoom, limits.maxZoom)
      const ratio = next / zoom
      return build(
        size,
        { x: point.x - (point.x - settled.x) * ratio, y: point.y - (point.y - settled.y) * ratio },
        next,
        limits,
      )
    },

    snapZoom(point) {
      if (zoom <= 1) return viewport
      return viewport.zoomAt(point, Math.round(zoom * SNAP_STEP) / SNAP_STEP / zoom)
    },

    fit(rect, padding = 0) {
      const room = { w: size.w - 2 * padding, h: size.h - 2 * padding }
      const fits = [
        rect.w > 0 ? room.w / rect.w : undefined,
        rect.h > 0 ? room.h / rect.h : undefined,
      ].filter((fit): fit is number => fit !== undefined)
      const next = fits.length === 0 ? zoom : clamp(Math.min(...fits), limits.minZoom, limits.maxZoom)
      return build(
        size,
        { x: size.w / 2 - (rect.x + rect.w / 2) * next, y: size.h / 2 - (rect.y + rect.h / 2) * next },
        next,
        limits,
      )
    },

    resize(next) {
      const centre = { x: (size.w / 2 - settled.x) / zoom, y: (size.h / 2 - settled.y) / zoom }
      return build(next, { x: next.w / 2 - centre.x * zoom, y: next.h / 2 - centre.y * zoom }, zoom, limits)
    },
  }
  return viewport
}

export function createViewport(init: ViewportInit): Viewport2D {
  const limits: ViewportLimits = { ...DEFAULT_LIMITS, ...init.limits }
  const zoom = clamp(init.zoom ?? 1, limits.minZoom, limits.maxZoom)
  return build(init.size, init.pan ?? { x: 0, y: 0 }, zoom, limits)
}
