import { wholePixels } from '../commands/pixels'
import { Grid } from '../grid'
import { layerCells } from '../level-layers'
import type { LayerDef, LayerInstance, Level, Project, Size } from '../project-types'
import { checkLevelSize, findLevel } from './level-edits'
import { arrangeWorld, cellStep, lcm } from './world-layout'

// Resizing a level about an anchor. The anchor is the side of each axis that stays put on
// the world map: the content moves inside the level by the size change (`end`) or half of it (`centre`), and the
// level's placement moves the other way, so nothing jumps. The move is rounded toward zero to whole cells of every
// cell layer and, in a grid world, whole steps of the world grid (the least common multiple of those), so a cell stays a
// cell and the level stays on its grid point. Tile, IntGrid and manual
// auto-layer cells that end outside are dropped, which `resizeLevelLoss` lists for the confirm dialog; entities and
// objects are kept wherever they land, and the Checks flag those outside (`entityOutOfBounds`).

export type AnchorSide = 'start' | 'centre' | 'end'

export interface ResizeAnchor {
  readonly x: AnchorSide
  readonly y: AnchorSide
}

/** The cells a resize drops from one layer, by layer definition id. */
export interface DroppedCells {
  readonly layer: string
  readonly count: number
}

/**
 * The smallest move in px on each axis that is whole cells on every cell layer and, for a level a grid world places,
 * whole steps of that world's grid, so neither the cells nor the level's place on the map shift.
 */
function moveStep(project: Project, level: string): { x: number; y: number } {
  const cells = cellStep(project)
  let step = { x: cells, y: cells }
  for (const world of project.worlds) {
    if (world.grid === undefined || !world.placements.some((placement) => placement.level === level)) continue
    step = { x: lcm(step.x, world.grid.w), y: lcm(step.y, world.grid.h) }
  }
  return step
}

/** How far the content moves inside the level, in px, on each axis. */
function contentOffset(
  project: Project,
  level: Level,
  to: Size,
  anchor: ResizeAnchor,
): { x: number; y: number } {
  const step = moveStep(project, level.id)
  const along = (side: AnchorSide, change: number, unit: number): number => {
    const wanted = side === 'start' ? 0 : side === 'end' ? change : change / 2
    return Math.trunc(wanted / unit) * unit + 0
  }
  return {
    x: along(anchor.x, to.w - level.size.w, step.x),
    y: along(anchor.y, to.h - level.size.h, step.y),
  }
}

/** The cells of `grid` moved by (`dx`, `dy`) cells into a grid of the new size, and how many fell outside. */
function moveCells(
  grid: Grid,
  cols: number,
  rows: number,
  dx: number,
  dy: number,
): { grid: Grid; dropped: number } {
  const cells = grid.nonEmpty()
  const inside = cells.filter(({ x, y }) => x + dx >= 0 && y + dy >= 0 && x + dx < cols && y + dy < rows)
  const dropped = cells.length - inside.length
  // Without a move the grid's own resize keeps every chunk that stays whole, so an undo snapshot stays small.
  if (dx === 0 && dy === 0) return { grid: grid.resize(cols, rows), dropped }
  const moved = Grid.empty(cols, rows).edit((edit) => {
    for (const { x, y, value } of inside) edit.set(x + dx, y + dy, value)
  })
  return { grid: moved, dropped }
}

interface Resized {
  readonly layer: LayerInstance
  readonly dropped: number
}

function resizeLayer(
  layer: LayerInstance,
  def: LayerDef | undefined,
  size: Size,
  px: { x: number; y: number },
): Resized {
  if (layer.kind === 'entities' || layer.kind === 'objects') {
    const items = layer.items.map((item) => ({
      ...item,
      x: wholePixels(item.x + px.x),
      y: wholePixels(item.y + px.y),
    }))
    return { layer: { ...layer, items } as LayerInstance, dropped: 0 }
  }
  if (def === undefined || def.kind === 'objects' || def.kind === 'entities')
    throw new RangeError(`layer "${layer.def}" has no cell definition`)
  const { cols, rows } = layerCells(size, def.grid)
  const dx = px.x / def.grid
  const dy = px.y / def.grid
  if (layer.kind === 'auto') {
    const { grid, dropped } = moveCells(layer.overrides, cols, rows, dx, dy)
    return { layer: { ...layer, overrides: grid }, dropped }
  }
  const { grid, dropped } = moveCells(layer.cells, cols, rows, dx, dy)
  return { layer: { ...layer, cells: grid }, dropped }
}

function resized(project: Project, level: Level, size: Size, anchor: ResizeAnchor) {
  checkLevelSize(project, size)
  const px = contentOffset(project, level, size, anchor)
  const layers = level.layers.map((layer) =>
    resizeLayer(
      layer,
      project.defs.layers.find((def) => def.id === layer.def),
      size,
      px,
    ),
  )
  return { px, layers }
}

/** What resizing would drop, per layer with cells to lose, in the level's layer order; empty when nothing is lost. */
export function resizeLevelLoss(
  project: Project,
  id: string,
  size: Size,
  anchor: ResizeAnchor,
): DroppedCells[] {
  const level = findLevel(project, id)
  return resized(project, level, size, anchor).layers.flatMap(({ layer, dropped }) =>
    dropped === 0 ? [] : [{ layer: layer.def, count: dropped }],
  )
}

/** Resizes a level about `anchor` as one step; the same project for the size it already has. */
export function resizeLevel(project: Project, id: string, size: Size, anchor: ResizeAnchor): Project {
  const level = findLevel(project, id)
  checkLevelSize(project, size)
  if (size.w === level.size.w && size.h === level.size.h) return project
  const { px, layers } = resized(project, level, size, anchor)
  const next: Level = { ...level, size: { w: size.w, h: size.h }, layers: layers.map((entry) => entry.layer) }
  const withLevel = {
    ...project,
    levels: project.levels.map((candidate) => (candidate === level ? next : candidate)),
  }
  const worlds = project.worlds.map((world) => {
    if (!world.placements.some((placement) => placement.level === id)) return world
    const placements = world.placements.map((placement) =>
      placement.level === id ? { ...placement, x: placement.x - px.x, y: placement.y - px.y } : placement,
    )
    return arrangeWorld(withLevel, { ...world, placements })
  })
  return { ...withLevel, worlds }
}
