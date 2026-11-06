import type { Point } from '@mcthaydt/automata-content/level-2d'
import { createViewport, type Viewport2D } from '../../shared/kit/gestures/viewport-2d.ts'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import type { Size } from '../../shared/level-2d/model/project-types'
import type { WorldRect } from '../../shared/level-2d/model/world/world-model'

// The World view's camera: a kit `Viewport2D`, as the Level view's. Until the person pans or
// zooms, every measure fits the levels inside the margin (the first box a page reports is often not its last); after
// that a new box keeps the world point at the centre, and `fit` hands the camera back to the box. A drag never refits,
// so a level being dragged never moves under the pointer. An empty world shows the origin at 100 %.

const MARGIN = 24

/** A part of the map's box, in the map's own pixels. */
export interface Area {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface WorldCamera {
  /** `undefined` until the map is measured. */
  readonly camera: Camera | undefined
  /** `area`: the part of the box to fit into (the rest is covered by a drawer or a sheet); the whole box by default. */
  measure(size: Size, rects: readonly WorldRect[], area?: Area): void
  fit(rects: readonly WorldRect[], area?: Area): void
  panBy(dx: number, dy: number): void
  zoomAt(point: Point, factor: number): void
  /** A point on the map, in CSS pixels, as a point in the world. */
  toWorld(point: Point): Point
  subscribe(run: () => void): () => void
}

function fittedToBox(viewport: Viewport2D, rects: readonly WorldRect[]): Viewport2D {
  if (rects.length === 0) return viewport.fit({ x: 0, y: 0, w: viewport.size.w, h: viewport.size.h }, 0)
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
  return viewport.fit({ x: left, y: top, w: right - left, h: bottom - top }, MARGIN)
}

/** Fits the levels inside `area` of the viewport's box: fitted in a box of the area's size, then moved to the area. */
function fitted(viewport: Viewport2D, rects: readonly WorldRect[], area: Area | undefined): Viewport2D {
  if (area === undefined || area.w <= 2 * MARGIN || area.h <= 2 * MARGIN) return fittedToBox(viewport, rects)
  const inArea = fittedToBox(createViewport({ size: { w: area.w, h: area.h } }), rects)
  return createViewport({
    size: viewport.size,
    pan: { x: inArea.pan.x + area.x, y: inArea.pan.y + area.y },
    zoom: inArea.zoom,
  })
}

export function createWorldCamera(): WorldCamera {
  const listeners = new Set<() => void>()
  let viewport: Viewport2D | undefined
  /** The person has panned or zoomed since the last fit. */
  let handMoved = false

  const moved = (next: Viewport2D): void => {
    viewport = next
    for (const run of [...listeners]) run()
  }

  return {
    get camera() {
      return viewport === undefined
        ? undefined
        : { x: viewport.pan.x, y: viewport.pan.y, scale: viewport.zoom }
    },
    measure(size, rects, area) {
      const sized = viewport === undefined ? createViewport({ size }) : viewport.resize(size)
      moved(handMoved ? sized : fitted(sized, rects, area))
    },
    fit(rects, area) {
      handMoved = false
      if (viewport !== undefined) moved(fitted(viewport, rects, area))
    },
    panBy(dx, dy) {
      if (viewport === undefined) return
      handMoved = true
      moved(viewport.panBy(dx, dy))
    },
    zoomAt(point, factor) {
      if (viewport === undefined) return
      handMoved = true
      moved(viewport.zoomAt(point, factor))
    },
    toWorld: (point) => viewport?.screenToWorld(point) ?? point,
    subscribe(run) {
      listeners.add(run)
      return () => listeners.delete(run)
    },
  }
}
