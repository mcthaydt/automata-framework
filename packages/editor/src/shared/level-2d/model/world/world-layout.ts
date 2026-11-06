import { wholePixels } from '../commands/pixels'
import { MAX_LEVEL_SIDE } from '../project.schema'
import type { Placement, Project, Size, World, WorldLayout } from '../project-types'

// How a world's layout decides where its levels sit. `free`: any whole pixel; `grid`: the
// nearest point of the world's snap grid; `horizontal` and `vertical`: a sequence whose positions are derived, the
// placements' order being the sequence, laid end to end from the origin. Every world edit in this folder ends with
// `arrangeWorld`, so a placement can never sit where its layout does not allow. Nothing here touches a level.

/** The snap grid a world switched to `grid` gets when the caller names none and no layer has cells. */
const FALLBACK_GRID = 16

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** The least common multiple of two whole positive numbers. */
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b

/** The smallest length in px that is whole cells on every cell layer (1 when no layer has cells). */
export function cellStep(project: Project): number {
  return project.defs.layers.reduce((step, def) => (def.kind === 'objects' ? step : lcm(step, def.grid)), 1)
}

/** The world with this id; throws `RangeError` when there is none. */
export function findWorld(project: Project, id: string): World {
  const world = project.worlds.find((candidate) => candidate.id === id)
  if (world === undefined) throw new RangeError(`no world "${id}"`)
  return world
}

/** The project with `world` replaced by `next`; the same project when `next` is `world`. */
export function replaceWorld(project: Project, world: World, next: World): Project {
  if (next === world) return project
  return { ...project, worlds: project.worlds.map((candidate) => (candidate === world ? next : candidate)) }
}

const snap = (value: number, step: number): number => wholePixels(Math.round(value / step) * step)

/** Where a placement may sit in a free or grid world: whole pixels, or the nearest grid point. */
export function snapPosition(world: World, x: number, y: number): { readonly x: number; readonly y: number } {
  if (world.grid === undefined) return { x: wholePixels(x), y: wholePixels(y) }
  return { x: snap(x, world.grid.w), y: snap(y, world.grid.h) }
}

/** The positions a sequence derives: each level starts where the one before it ends. A missing level has no length. */
function sequencePositions(project: Project, world: World): readonly Placement[] {
  const horizontal = world.layout === 'horizontal'
  let along = 0
  return world.placements.map((placement) => {
    const level = project.levels.find((candidate) => candidate.id === placement.level)
    if (level === undefined) return placement
    const start = along
    along += horizontal ? level.size.w : level.size.h
    return horizontal ? { ...placement, x: start, y: 0 } : { ...placement, x: 0, y: start }
  })
}

/** `world` with every placement where its layout puts it; the same world when each already is. */
export function arrangeWorld(project: Project, world: World): World {
  const wanted =
    world.layout === 'horizontal' || world.layout === 'vertical'
      ? sequencePositions(project, world)
      : world.placements.map((placement) => {
          const { x, y } = snapPosition(world, placement.x, placement.y)
          return x === placement.x && y === placement.y ? placement : { ...placement, x, y }
        })
  const changed = wanted.some((placement, i) => {
    const current = world.placements[i]
    return current === undefined || placement.x !== current.x || placement.y !== current.y
  })
  return changed ? { ...world, placements: wanted } : world
}

/** Placements in reading order along an axis: by that coordinate, then the other one, then level id. */
function alongAxis(placements: readonly Placement[], axis: 'x' | 'y'): Placement[] {
  const other = axis === 'x' ? 'y' : 'x'
  return [...placements].sort(
    (a, b) =>
      a[axis] - b[axis] || a[other] - b[other] || (a.level < b.level ? -1 : a.level > b.level ? 1 : 0),
  )
}

function checkGrid(grid: Size): void {
  const fits = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL_SIDE
  if (!fits(grid.w) || !fits(grid.h))
    throw new RangeError(
      `a snap grid of ${grid.w} × ${grid.h} px is not whole pixels from 1 to ${MAX_LEVEL_SIDE}`,
    )
}

/** Whole cells of every layer (`cellStep`), so a level placed on the world grid lines up with every layer's cells. */
function defaultGrid(project: Project): Size {
  const hasCells = project.defs.layers.some((layer) => layer.kind !== 'objects')
  const side = hasCells ? cellStep(project) : FALLBACK_GRID
  return { w: side, h: side }
}

/**
 * Switches a world's layout as one step, never changing a level. `grid` snaps every placement to `grid` (else the
 * world's current grid, else the least common multiple of the layers' cells); leaving `grid` drops the snap grid and keeps the
 * positions; `horizontal` and `vertical` first put the placements in reading order along their axis.
 */
export function setWorldLayout(project: Project, worldId: string, layout: WorldLayout, grid?: Size): Project {
  const world = findWorld(project, worldId)
  if (layout !== 'grid' && grid !== undefined) throw new RangeError(`a ${layout} world has no snap grid`)
  if (layout === 'grid') {
    const size = grid ?? world.grid ?? defaultGrid(project)
    checkGrid(size)
    if (world.layout === 'grid' && world.grid?.w === size.w && world.grid.h === size.h) return project
    return replaceWorld(
      project,
      world,
      arrangeWorld(project, { ...world, layout, grid: { w: size.w, h: size.h } }),
    )
  }
  if (layout === world.layout) return project
  const { grid: _dropped, ...rest } = world
  const placements =
    layout === 'free' ? world.placements : alongAxis(world.placements, layout === 'horizontal' ? 'x' : 'y')
  return replaceWorld(project, world, arrangeWorld(project, { ...rest, layout, placements }))
}
