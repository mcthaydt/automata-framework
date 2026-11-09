import type { Project } from '../project-types'
import { findLevel, type NewLevel } from './level-edits'
import { findWorld } from './world-layout'

// A world's placed levels as rectangles in world pixels, and where "Add level" puts a new one. Pure.

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

/** World pixels between a new level and the rightmost one. */
const NEW_LEVEL_GAP = 32

/**
 * What "Add level" adds: the first free `level-N` (named `Level N`), the size of the project's
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
