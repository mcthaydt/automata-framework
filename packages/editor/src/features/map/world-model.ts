import type { Camera } from '../../shared/level-2d/canvas/level-view'
import type { Project, Size } from '../../shared/level-2d/model/project-types'
import { projectLinks } from '../../shared/level-2d/model/refs/ref-links'
import { findLevel, type NewLevel } from '../../shared/level-2d/model/world/level-edits'
import { findWorld } from '../../shared/level-2d/model/world/world-layout'
import type { Point } from '../../shared/level-2d/tiles/footprint'

// The World view's map (plan ED2D.6b step 3; 2D editor spec §8, the World row): each placed level as a rectangle in
// world pixels, the camera that fits them all in the canvas, which level a point falls on, and where a drag puts a
// level. Pure; the Pixi canvas draws the rectangles and the view turns pointer events into these calls.

export interface WorldRect {
  readonly id: string
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly depth: number
  readonly selected: boolean
}

/** The world's levels in paint order: lower depth first, then the world's own order. */
export function worldRects(
  project: Project,
  worldId: string,
  selected: string | undefined,
): readonly WorldRect[] {
  const world = findWorld(project, worldId)
  return world.placements
    .map((placement, order) => ({ placement, order }))
    .sort((a, b) => a.placement.depth - b.placement.depth || a.order - b.order)
    .map(({ placement }) => {
      const level = findLevel(project, placement.level)
      return {
        id: level.id,
        name: level.name,
        x: placement.x,
        y: placement.y,
        w: level.size.w,
        h: level.size.h,
        depth: placement.depth,
        selected: level.id === selected,
      }
    })
}

/** The camera that shows every level inside `margin`, as large as it fits, centred; an empty world at scale 1. */
export function fitWorld(rects: readonly WorldRect[], box: Size, margin: number): Camera {
  if (rects.length === 0) return { x: margin, y: margin, scale: 1 }
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const width = Math.max(...rects.map((rect) => rect.x + rect.w)) - left
  const height = Math.max(...rects.map((rect) => rect.y + rect.h)) - top
  const scale = Math.min((box.w - 2 * margin) / width, (box.h - 2 * margin) / height)
  return {
    x: (box.w - width * scale) / 2 - left * scale,
    y: (box.h - height * scale) / 2 - top * scale,
    scale,
  }
}

/** The topmost level under a world point (the last in paint order), or `undefined` on empty space. */
export function levelAt(rects: readonly WorldRect[], point: Point): string | undefined {
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index]
    if (rect === undefined) continue
    if (point.x >= rect.x && point.x < rect.x + rect.w && point.y >= rect.y && point.y < rect.y + rect.h)
      return rect.id
  }
  return undefined
}

/** A point on the canvas, in CSS pixels, as a point in the world. */
export function toWorld(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }
}

/** Where a level that started at `start` is after the pointer travelled `travel` screen pixels: whole world pixels. */
export function dragPosition(start: Point, travel: Point, scale: number): Point {
  return { x: Math.round(start.x + travel.x / scale), y: Math.round(start.y + travel.y / scale) }
}

/** World pixels between a new level and the rightmost one. */
const NEW_LEVEL_GAP = 32

/**
 * What "Add level" adds (plan ED2D.6c decision 6): the first free `level-N` (named `Level N`), the size of the project's
 * first level, placed right of the world's rightmost level with a gap and level with its topmost; the world's layout
 * then snaps or sequences it.
 */
export function newLevelInput(project: Project, worldId: string): NewLevel {
  const taken = new Set(project.levels.map((level) => level.id))
  let number = 1
  while (taken.has(`level-${number}`)) number += 1
  const rects = worldRects(project, worldId, undefined)
  const right = rects.length === 0 ? 0 : Math.max(...rects.map((rect) => rect.x + rect.w)) + NEW_LEVEL_GAP
  const top = rects.length === 0 ? 0 : Math.min(...rects.map((rect) => rect.y))
  return {
    id: `level-${number}`,
    name: `Level ${number}`,
    world: worldId,
    x: right,
    y: top,
    size: project.levels[0]?.size ?? { w: 320, h: 240 },
  }
}

/** What Duplicate names a copy of `level` (plan ED2D.8a decision 3): `<name> copy`, the first free `<id>-copy[-n]`. */
export function copyLevelInput(project: Project, level: string): { id: string; name: string } {
  const taken = new Set(project.levels.map((each) => each.id))
  let id = `${level}-copy`
  for (let number = 2; taken.has(id); number += 1) id = `${level}-copy-${number}`
  return { id, name: `${findLevel(project, level).name} copy` }
}

/** How many links from other levels lead into `level`: what Remove says will break. */
export function linksInto(project: Project, level: string): number {
  return projectLinks(project).filter((link) => link.to.level === level && link.from.level !== level).length
}

interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * The part of the map no open drawer or sheet covers (plan ED2D.8b decision 2), in the map's own coordinates. `map` and
 * `covers` are page rectangles. A cover as tall as the map is a drawer from the left or the right; one that reaches the
 * map's bottom is a sheet; one that reaches its top is a bar. A cover that misses the map changes nothing.
 */
export function uncoveredArea(map: Box, covers: readonly Box[]): Box {
  let left = 0
  let right = map.w
  let top = 0
  let bottom = map.h
  for (const cover of covers) {
    const x0 = cover.x - map.x
    const x1 = x0 + cover.w
    const y0 = cover.y - map.y
    const y1 = y0 + cover.h
    if (x1 <= 0 || x0 >= map.w || y1 <= 0 || y0 >= map.h) continue
    if (y0 <= 0 && y1 >= map.h) {
      if (x0 <= 0) left = Math.max(left, x1)
      else right = Math.min(right, x0)
    } else if (y1 >= map.h) bottom = Math.min(bottom, y0)
    else if (y0 <= 0) top = Math.max(top, y1)
  }
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}
