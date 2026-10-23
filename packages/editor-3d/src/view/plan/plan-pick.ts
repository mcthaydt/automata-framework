// What a pointer on the plan touches (ED3D.4 step 3, ED3D spec §5.3 flows 2 and 3 and ED3-n): the wall or the sector under
// it, and the corner near it. The reach is in screen pixels and the pointer kind sets it, so a finger is as easy to aim as
// a mouse and the same metre is a different hit at another zoom. Everything is read from the geometry layers and the
// selection ids; hidden and locked layers are told in `options`, as the view state holds them.
import type { PointerKind, Point as ScreenPoint, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { Point } from '../../format/sector.schema'
import { type Edge, insideSector, polygonArea } from '../../geometry/sectors'
import type { GeometryLayer } from '../../profile/level-profile'
import type { SelectionOf } from '../selection-of'
import { toScreen, toWorld } from './plan-viewport'

/** How far from a wall or a corner a pointer still touches it, in pixels: a 44 px target for a finger. */
export const PICK_RADIUS: Readonly<Record<PointerKind, number>> = { touch: 22, pen: 12, mouse: 8 }

export interface PickOptions {
  /** The reach in pixels, usually `PICK_RADIUS[kind]`. */
  readonly radius: number
  /** Layers that are not hit (they are not drawn either): `sectors` or `walls`. */
  readonly hidden?: readonly string[] | undefined
  /** Layers that are drawn and not hit. */
  readonly locked?: readonly string[] | undefined
}

export type PlanHit =
  | {
      readonly kind: 'wall'
      /** What the wall selects: its corner's wall, or the sector for a wall that belongs to no corner. */
      readonly selection: string
      readonly sector: string
      /** The point of the wall nearest the pointer, in metres. */
      readonly at: Point
      /** From the pointer to `at`, in pixels. */
      readonly distance: number
    }
  | { readonly kind: 'sector'; readonly selection: string; readonly sector: string }

export interface CornerHit {
  readonly sector: string
  /** The index of the corner in the sector's outline in the document. */
  readonly corner: number
  readonly at: Point
  /** In pixels. */
  readonly distance: number
}

/** Two distances closer than this (a thousandth of a pixel) are the same: a portal pair's walls lie on one line. */
const SAME_DISTANCE = 1e-3

/** Whether a layer is hidden or locked, so that nothing of it is hit or snapped to. */
export const isLayerOff = (options: Pick<PickOptions, 'hidden' | 'locked'>, layer: string): boolean =>
  options.hidden?.includes(layer) === true || options.locked?.includes(layer) === true

interface WallCandidate {
  readonly edge: Edge
  readonly selection: string
  readonly at: Point
  readonly distance: number
  /** Whether the pointer is on the side of the wall that its own sector is on. */
  readonly inward: boolean
}

/** The wall of the candidates the pointer is nearest, or on the side of when two lie on one line. */
function better(candidate: WallCandidate, best: WallCandidate | undefined): boolean {
  if (best === undefined) return true
  if (candidate.distance < best.distance - SAME_DISTANCE) return true
  return Math.abs(candidate.distance - best.distance) <= SAME_DISTANCE && candidate.inward && !best.inward
}

export type WallHit = Extract<PlanHit, { readonly kind: 'wall' }>

/**
 * The wall within `radius` pixels of `at` that the pointer is nearest, or on the side of when two lie on one line.
 * Walls that nothing selects (an opening connector's) are not answered.
 */
export function wallNear(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  viewport: Viewport2D,
  at: ScreenPoint,
  radius: number,
): WallHit | undefined {
  const world = toWorld(viewport, at)
  let best: WallCandidate | undefined
  for (const layer of layers) {
    for (const edge of layer.map.edges) {
      const selection = select.edge(edge)
      if (selection === undefined) continue
      const from = toScreen(viewport, edge.a)
      const to = toScreen(viewport, edge.b)
      const [dx, dy] = [to.x - from.x, to.y - from.y]
      const squared = dx * dx + dy * dy
      const along =
        squared === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - from.x) * dx + (at.y - from.y) * dy) / squared))
      const distance = Math.hypot(at.x - from.x - dx * along, at.y - from.y - dy * along)
      if (distance > radius) continue
      const nearest = {
        x: edge.a.x + (edge.b.x - edge.a.x) * along,
        z: edge.a.z + (edge.b.z - edge.a.z) * along,
      }
      const inward = (world.x - nearest.x) * edge.normal.x + (world.z - nearest.z) * edge.normal.z > 0
      const candidate = { edge, selection, at: nearest, distance, inward }
      if (better(candidate, best)) best = candidate
    }
  }
  return (
    best && {
      kind: 'wall',
      selection: best.selection,
      sector: best.edge.sector.id,
      at: best.at,
      distance: best.distance,
    }
  )
}

/** Of the listed sectors that hold the point, the smallest outline: a room inside a bigger one is the one touched. */
function pickSector(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  world: Point,
): PlanHit | undefined {
  let best: { id: string; selection: string; area: number } | undefined
  for (const layer of layers) {
    for (const sector of layer.map.sectors) {
      const selection = select.sector(sector.id)
      if (selection === undefined || !insideSector(world, sector)) continue
      // The outline is normalised, so its area is positive.
      const area = polygonArea(sector.points[0] ?? [])
      if (best === undefined || area < best.area) best = { id: sector.id, selection, area }
    }
  }
  return best && { kind: 'sector', selection: best.selection, sector: best.id }
}

/**
 * What is under `at`, a point of the canvas: a wall within the radius (the nearest; on a line that two sectors share,
 * the wall of the sector the pointer is in), else the smallest sector that holds it, else nothing. A hidden or a locked
 * layer is not hit; an opening's connector and its walls have no selection and are never answered.
 */
export function pickPlan(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  viewport: Viewport2D,
  at: ScreenPoint,
  options: PickOptions,
): PlanHit | undefined {
  const world = toWorld(viewport, at)
  if (!isLayerOff(options, 'walls')) {
    const wall = wallNear(layers, select, viewport, at, options.radius)
    if (wall !== undefined) return wall
  }
  return isLayerOff(options, 'sectors') ? undefined : pickSector(layers, select, world)
}

/**
 * The corner of a sector's outline within the radius of `at` (the vertex tool's target), by its index in the document.
 * Of two corners at the same place, as two sectors have where a portal joins them, the one of the sector that holds the
 * pointer; the corners a pilaster adds round its masonry are not the document's and are not offered. The corners belong
 * to the walls layer.
 */
export function pickCorner(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  viewport: Viewport2D,
  at: ScreenPoint,
  options: PickOptions,
): CornerHit | undefined {
  if (isLayerOff(options, 'walls')) return undefined
  const world = toWorld(viewport, at)
  let best: (CornerHit & { readonly inside: boolean }) | undefined
  for (const layer of layers) {
    for (const sector of layer.map.sectors) {
      for (const [corner, point] of select.corners(sector.id).entries()) {
        const there = toScreen(viewport, point)
        const distance = Math.hypot(at.x - there.x, at.y - there.y)
        if (distance > options.radius) continue
        const inside = insideSector(world, sector)
        const closer = best === undefined || distance < best.distance - SAME_DISTANCE
        const tied = best !== undefined && Math.abs(distance - best.distance) <= SAME_DISTANCE
        if (closer || (tied && inside && best?.inside === false))
          best = { sector: sector.id, corner, at: point, distance, inside }
      }
    }
  }
  return best && { sector: best.sector, corner: best.corner, at: best.at, distance: best.distance }
}
