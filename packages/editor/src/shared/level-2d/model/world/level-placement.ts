import type { Point } from '../../tiles/footprint'
import type { Placement, Project, World } from '../project-types'
import { arrangeWorld, findWorld, replaceWorld, snapPosition } from './world-layout'

// Where a level sits on the world map: moving it in its world, placing it in a world
// (out of any other), and its depth. Each result is arranged by the world's layout (`world-layout.ts`), so a free world
// gets whole pixels, a grid world snapped positions and a sequence a new order with derived positions.

/** The world that places `level` and the index of its placement there (the first, when a broken project has two). */
function placementOf(project: Project, level: string): { readonly world: World; readonly index: number } {
  if (!project.levels.some((candidate) => candidate.id === level)) throw new RangeError(`no level "${level}"`)
  for (const world of project.worlds) {
    const index = world.placements.findIndex((placement) => placement.level === level)
    if (index >= 0) return { world, index }
  }
  throw new RangeError(`level "${level}" is not placed in any world`)
}

/** The middle of a placement along a sequence's axis; a level that does not exist has no length. */
function centreAlong(project: Project, world: World, placement: Placement): number {
  const size = project.levels.find((candidate) => candidate.id === placement.level)?.size ?? { w: 0, h: 0 }
  return world.layout === 'horizontal' ? placement.x + size.w / 2 : placement.y + size.h / 2
}

/**
 * `placement` added to the placements of `world` (where it is not): appended in a free or grid world, and in a
 * sequence inserted before the first level whose centre comes after its own, so a drag decides the order.
 */
function withPlacement(project: Project, world: World, placement: Placement): World {
  if (world.layout !== 'horizontal' && world.layout !== 'vertical') {
    return {
      ...world,
      placements: [...world.placements, { ...placement, ...snapPosition(world, placement.x, placement.y) }],
    }
  }
  const centre = centreAlong(project, world, placement)
  const index = world.placements.filter((other) => centreAlong(project, world, other) < centre).length
  const placements = [...world.placements]
  placements.splice(index, 0, placement)
  return { ...world, placements }
}

const samePlacements = (a: World, b: World): boolean =>
  a.placements.length === b.placements.length &&
  a.placements.every((placement, i) => {
    const other = b.placements[i]
    return (
      other !== undefined &&
      placement.level === other.level &&
      placement.x === other.x &&
      placement.y === other.y
    )
  })

/**
 * Moves a level within the world that places it. A free world stores whole pixels and a grid world the nearest grid
 * point; in a sequence the position only chooses the level's place in the order, and the positions are derived again.
 */
export function moveLevelInWorld(project: Project, level: string, x: number, y: number): Project {
  const { world, index } = placementOf(project, level)
  const current = world.placements[index] as Placement
  if (world.layout === 'horizontal' || world.layout === 'vertical') {
    const others = { ...world, placements: world.placements.filter((_, i) => i !== index) }
    const moved = arrangeWorld(project, withPlacement(project, others, { ...current, x, y }))
    return samePlacements(moved, world) ? project : replaceWorld(project, world, moved)
  }
  // A free or grid world keeps the placement in its slot of the list; only the position changes.
  const to = snapPosition(world, x, y)
  if (to.x === current.x && to.y === current.y) return project
  const placements = world.placements.map((placement, i) => (i === index ? { ...current, ...to } : placement))
  return replaceWorld(project, world, { ...world, placements })
}

/**
 * Places a level in a world at `at`, taking it out of every world that placed it (so a level placed twice, or not at
 * all, ends with exactly one placement). The level keeps its depth; one never placed gets depth 0. The worlds it left
 * are arranged again, so a sequence closes the gap.
 */
export function placeLevel(project: Project, level: string, worldId: string, at: Point): Project {
  if (!project.levels.some((candidate) => candidate.id === level)) throw new RangeError(`no level "${level}"`)
  const target = findWorld(project, worldId)
  const holders = project.worlds.filter((world) => world.placements.some((p) => p.level === level))
  const placedOnce =
    holders.length === 1 && holders[0]?.placements.filter((p) => p.level === level).length === 1
  if (placedOnce && holders[0] === target) return moveLevelInWorld(project, level, at.x, at.y)
  const depth = holders[0]?.placements.find((p) => p.level === level)?.depth ?? 0
  const worlds = project.worlds.map((world) => {
    const left = world.placements.some((p) => p.level === level)
      ? arrangeWorld(project, { ...world, placements: world.placements.filter((p) => p.level !== level) })
      : world
    if (world !== target) return left
    return arrangeWorld(project, withPlacement(project, left, { level, x: at.x, y: at.y, depth }))
  })
  return { ...project, worlds }
}

/** Sets the depth of a level's placement: a whole number, which orders overlapping levels in a free world. */
export function setLevelDepth(project: Project, level: string, depth: number): Project {
  if (!Number.isInteger(depth)) throw new RangeError(`a depth is a whole number, not ${depth}`)
  const { world, index } = placementOf(project, level)
  const current = world.placements[index] as Placement
  if (current.depth === depth + 0) return project
  const placements = world.placements.map((placement, i) =>
    i === index ? { ...current, depth: depth + 0 } : placement,
  )
  return replaceWorld(project, world, { ...world, placements })
}
