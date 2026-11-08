// Where a dragged or drawn point lands (ED3D.4 step 4, ED3D spec §5.3 flows 2 and 3, ED3D-D11): the first of these that
// applies. A corner of a wall, then a wall line, then the horizontal or vertical through the last point, then the grid
// when the view snaps to it, then the data step (5 cm; Shift 1 cm). Alt turns all of it off. The answer says which
// one it was, so the app can draw the target, and names the wall where there is one. Reach is in pixels, like
// picking's, so zooming in snaps to fewer metres.
import type { Point as ScreenPoint, Viewport2D } from '@mcthaydt/automata-editor/kit/core'
import type { Point } from '../../format/sector.schema'
import type { ViewState } from '../../model/view-store'
import type { GeometryLayer } from '../../profile/level-profile'
import type { SelectionOf } from '../selection-of'
import { isLayerOff, type PickOptions, wallNear } from './plan-pick'
import { type SnapKeys, snapStep, snapValue, toScreen, toWorld } from './plan-viewport'

export type SnapKind = 'vertex' | 'wall' | 'axis' | 'grid' | 'data' | 'free'

export interface SnapResult {
  readonly x: number
  readonly z: number
  readonly kind: SnapKind
  /** The selection of the wall the point is on or at the corner of; for a vertex or a wall snap only. */
  readonly target?: string | undefined
}

export interface SnapOptions extends PickOptions, SnapKeys {
  /** The view's grid: a step in metres, and whether a free point goes to it. */
  readonly grid: ViewState['grid']
  /** The last point placed, for the axis through it. */
  readonly from?: Point | undefined
}

/** The corner of a wall nearest `at` within `radius` pixels, with the wall that starts there. */
function vertexNear(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  viewport: Viewport2D,
  at: ScreenPoint,
  radius: number,
): { readonly point: Point; readonly target: string } | undefined {
  let best: { point: Point; target: string; distance: number } | undefined
  for (const layer of layers) {
    for (const edge of layer.map.edges) {
      const target = select.edge(edge)
      if (target === undefined) continue
      const there = toScreen(viewport, edge.a)
      const distance = Math.hypot(at.x - there.x, at.y - there.y)
      if (distance <= radius && (best === undefined || distance < best.distance))
        best = { point: edge.a, target, distance }
    }
  }
  return best
}

/** The grid when the view snaps to one (and Shift is not held), else the data step. */
export function stepOf(options: Pick<SnapOptions, 'grid' | 'shiftKey' | 'altKey'>): {
  readonly step: number
  readonly kind: 'grid' | 'data'
} {
  const onGrid = options.grid.snap && options.grid.step > 0 && options.shiftKey !== true
  return onGrid ? { step: options.grid.step, kind: 'grid' } : { step: snapStep(options), kind: 'data' }
}

/**
 * A length in metres (an offset of a drag, a place) rounded to the grid: the fine data step with Shift, not at all with
 * Alt. Unlike a snap, nothing of the level is looked at.
 */
export function gridRounded(
  value: number,
  options: Pick<SnapOptions, 'grid' | 'shiftKey' | 'altKey'>,
): number {
  return snapValue(value, options.altKey === true ? 0 : stepOf(options).step)
}

export function snapPlan(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  viewport: Viewport2D,
  at: ScreenPoint,
  options: SnapOptions,
): SnapResult {
  const world = toWorld(viewport, at)
  const exact = (point: Point): { x: number; z: number } => ({
    x: snapValue(point.x, 0),
    z: snapValue(point.z, 0),
  })
  if (options.altKey === true) return { ...exact(world), kind: 'free' }
  if (!isLayerOff(options, 'walls')) {
    const vertex = vertexNear(layers, select, viewport, at, options.radius)
    if (vertex !== undefined) return { ...exact(vertex.point), kind: 'vertex', target: vertex.target }
    const wall = wallNear(layers, select, viewport, at, options.radius)
    if (wall !== undefined) return { ...exact(wall.at), kind: 'wall', target: wall.selection }
  }
  const { step, kind } = stepOf(options)
  if (options.from !== undefined) {
    const last = toScreen(viewport, options.from)
    const [across, down] = [Math.abs(at.x - last.x), Math.abs(at.y - last.y)]
    // The axis the pointer is nearer to, the horizontal when it is as near to both.
    if (down <= options.radius && down <= across)
      return { x: snapValue(world.x, step), z: snapValue(options.from.z, 0), kind: 'axis' }
    if (across <= options.radius)
      return { x: snapValue(options.from.x, 0), z: snapValue(world.z, step), kind: 'axis' }
  }
  return { x: snapValue(world.x, step), z: snapValue(world.z, step), kind }
}
