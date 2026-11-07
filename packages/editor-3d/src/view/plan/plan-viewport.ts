// The plan's camera, grid and snap values (ED3D spec §4.3 and ED3D-D11, ED3D.4 step 1). The camera is the view state's
// `{ x, z, zoom }`: the centre of the canvas in metres and a zoom where 1 is 32 px to a metre. The pan and the zoom
// themselves are the editor kit's `Viewport2D`, so the plan and the 2D editor move the same way; this file only says
// how the plan's metres sit in it (a plan point `{ x, z }` is the viewport's `{ x, y: z }`, so z runs down the screen)
// and gives the plan its limits (4 to 400 px to a metre, Last Light's). Every function is a value in, a value out.

import type { Point } from '@automata/3d/level'
import {
  createViewport,
  type Rect,
  type Point as ScreenPoint,
  type Size,
  type Viewport2D,
  type ViewportLimits,
} from '@automata/editor/kit/core'
import { roundJsonNumber } from '@automata/editor/kit/documents'
import type { ViewState } from '../../model/view-store'
import type { GeometryLayer } from '../../profile/level-profile'

/** Screen pixels to a metre at camera zoom 1. */
export const PLAN_PX_PER_M = 32

export const PLAN_LIMITS: ViewportLimits = { minZoom: 4, maxZoom: 400, keep: 64 }

type Camera = ViewState['camera']

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** The viewport that shows `camera` in a canvas of `size`; a zoom past the limits is held at the limit. */
export function planViewport(camera: Camera, size: Size): Viewport2D {
  const zoom = clamp(camera.zoom * PLAN_PX_PER_M, PLAN_LIMITS.minZoom, PLAN_LIMITS.maxZoom)
  return createViewport({
    size,
    zoom,
    pan: { x: size.w / 2 - camera.x * zoom, y: size.h / 2 - camera.z * zoom },
    limits: PLAN_LIMITS,
  })
}

/** The camera that a viewport shows: what a drag, a pinch or a fit writes back to the view state. */
export function cameraOf(viewport: Viewport2D): Camera {
  const centre = viewport.screenToWorld({ x: viewport.size.w / 2, y: viewport.size.h / 2 })
  return { x: centre.x, z: centre.y, zoom: viewport.zoom / PLAN_PX_PER_M }
}

/** Where the plan point is on the canvas. */
export const toScreen = (viewport: Viewport2D, point: Point): ScreenPoint =>
  viewport.worldToScreen({ x: point.x, y: point.z })

/** The plan point that a canvas position shows. */
export function toWorld(viewport: Viewport2D, point: ScreenPoint): Point {
  const world = viewport.screenToWorld(point)
  return { x: world.x, z: world.y }
}

/** What a level with no sector shows: a 10 m box round the origin. */
const EMPTY_BOUNDS: Rect = { x: -5, y: -5, w: 10, h: 10 }

/**
 * The box that holds every sector's outline in metres (`y` is z). Holes lie inside their outline, so the outlines are
 * enough.
 */
export function levelBounds(layers: readonly GeometryLayer[]): Rect {
  const corners = layers.flatMap((layer) => layer.map.sectors.flatMap((sector) => sector.points[0] ?? []))
  if (corners.length === 0) return EMPTY_BOUNDS
  const xs = corners.map((corner) => corner.x)
  const zs = corners.map((corner) => corner.z)
  const [x, z] = [Math.min(...xs), Math.min(...zs)]
  return { x, y: z, w: Math.max(...xs) - x, h: Math.max(...zs) - z }
}

/** The camera that centres `bounds` and shows all of it inside `padding` px of the canvas edge. */
export function fitPlan(bounds: Rect, size: Size, padding = 24): Camera {
  return cameraOf(planViewport({ x: 0, z: 0, zoom: 1 }, size).fit(bounds, padding))
}

/**
 * The camera that centres `bounds` in `usable` (a rectangle of the canvas, in pixels) and shows all of it inside
 * `padding` px of that rectangle's edge. `usable` is what a bar of tools along the top and a sheet along the bottom
 * leave of the canvas: the plan is drawn under them, but the level should sit clear of them. With `usable` the whole
 * canvas it is `fitPlan`.
 */
export function fitInto(bounds: Rect, usable: Rect, size: Size, padding = 24): Camera {
  const inner = fitPlan(bounds, { w: usable.w, h: usable.h }, padding)
  // The room's centre is the inner camera's. The canvas centre sits off the usable area's centre by (dx, dy) px, so
  // the camera that puts the room at the area's centre is that far from the room, the other way.
  const px = planViewport(inner, size).zoom
  const dx = usable.x + usable.w / 2 - size.w / 2
  const dy = usable.y + usable.h / 2 - size.h / 2
  return { x: inner.x - dx / px, z: inner.z - dy / px, zoom: inner.zoom }
}

/** Grid lines are never nearer than this on screen; zoomed out the step doubles until they are not. */
const MIN_LINE_GAP_PX = 16
const FALLBACK_STEP = 0.25
/** Every fourth line is drawn heavier. */
const MAJOR_EVERY = 4

/** The step of the drawn grid: `base` doubled as often as it takes for the lines to be 16 px apart. */
export function gridStep(base: number, pxPerMetre: number): number {
  let step = base > 0 ? base : FALLBACK_STEP
  while (step * pxPerMetre < MIN_LINE_GAP_PX) step *= 2
  return step
}

export interface GridLine {
  /** The line's position in metres. */
  readonly m: number
  readonly major: boolean
}

export interface GridLines {
  readonly step: number
  /** The vertical lines, by x. */
  readonly xs: readonly GridLine[]
  /** The horizontal lines, by z. */
  readonly zs: readonly GridLine[]
}

/** A line that falls on the edge of the view, give or take float noise, is in it: `0.3 / 0.1` is `2.9999999999999996`. */
const EDGE_TOLERANCE = 1e-9

function linesBetween(from: number, to: number, step: number): GridLine[] {
  const first = Math.ceil(from / step - EDGE_TOLERANCE)
  const last = Math.floor(to / step + EDGE_TOLERANCE)
  const lines: GridLine[] = []
  for (let index = first; index <= last; index++) {
    lines.push({ m: roundJsonNumber(index * step) + 0, major: index % MAJOR_EVERY === 0 })
  }
  return lines
}

/** The grid lines that fall in the canvas, with positions written to four decimals like the level's own numbers. */
export function gridLines(viewport: Viewport2D, base: number): GridLines {
  const step = gridStep(base, viewport.zoom)
  const topLeft = viewport.screenToWorld({ x: 0, y: 0 })
  const bottomRight = viewport.screenToWorld({ x: viewport.size.w, y: viewport.size.h })
  return {
    step,
    xs: linesBetween(topLeft.x, bottomRight.x, step),
    zs: linesBetween(topLeft.y, bottomRight.y, step),
  }
}

/** The modifier keys that change the snap: shift is fine, alt is off. */
export interface SnapKeys {
  readonly shiftKey?: boolean | undefined
  readonly altKey?: boolean | undefined
}

/** The step a dragged value is rounded to, in metres: 5 cm, 1 cm with shift, none with alt. */
export function snapStep(keys: SnapKeys = {}): number {
  if (keys.altKey) return 0
  return keys.shiftKey ? 0.01 : 0.05
}

/** `value` rounded to the nearest `step` (to 0.1 mm when there is none), never `-0`. */
export function snapValue(value: number, step: number): number {
  const snapped = step > 0 ? Math.round(value / step) * step : value
  return roundJsonNumber(snapped) + 0
}
