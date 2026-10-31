import { type Bounds, entityBounds, entityDefOf } from '../../model/commands/entity-geometry'
import { layerCells } from '../../model/level-layers'
import type { LayerDef, Level, Project, Size } from '../../model/project-types'
import { linkName, projectLinks } from '../../model/refs/ref-links'
import { brushCells, type Point } from '../../tiles/footprint'
import type { DrawView, Footprint, GridLines, LinkDraw } from './draw-list-types'

// What the canvas draws over the layers (2D editor spec §5.9, §8): the active layer's grid, the cells the next pointer
// down would edit, and the selected instances. Each follows the controller's view, so the canvas shows exactly what a
// tap would do: no footprint where the pointer does nothing (a locked or hidden layer, the select tool).

/** Lines every `step` px from 0, and one on the far edge when the level is not a whole number of steps. */
function linesTo(edge: number, step: number): number[] {
  const lines: number[] = []
  for (let at = 0; at < edge; at += step) lines.push(at)
  lines.push(edge)
  return lines
}

/** The active layer's grid: what it snaps to, so none for a layer that places freely. */
export function gridLines(def: LayerDef, size: Size): GridLines | undefined {
  const step = def.kind === 'objects' ? def.snap : def.kind === 'entities' && !def.snap ? 0 : def.grid
  if (step <= 0) return undefined
  return { step, xs: linesTo(size.w, step), ys: linesTo(size.h, step) }
}

/** The cells, inclusive corners, a tool would edit at the hover cell, before clipping. */
function reach(view: DrawView): { readonly from: Point; readonly to: Point } | undefined {
  const { hover } = view
  switch (view.tool) {
    case 'brush':
    case 'eraser': {
      if (hover === undefined) return undefined
      const cells = brushCells(hover, view.brushSize)
      return { from: cells[0] as Point, to: cells[cells.length - 1] as Point }
    }
    case 'rectangle': {
      const corners = view.rectangle ?? (hover === undefined ? undefined : { from: hover, to: hover })
      if (corners === undefined) return undefined
      const { from, to } = corners
      return {
        from: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) },
        to: { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y) },
      }
    }
    case 'fill':
    case 'picker':
      return hover === undefined ? undefined : { from: hover, to: hover }
    case 'select':
      return undefined
  }
}

/** The footprint on a tiles, IntGrid or auto layer, clipped to it, in level pixels. */
export function footprint(def: LayerDef, view: DrawView, size: Size): Footprint | undefined {
  if (def.kind === 'entities' || def.kind === 'objects') return undefined
  if (view.locked.has(def.id) || view.hidden.has(def.id)) return undefined
  const cells = reach(view)
  if (cells === undefined) return undefined
  const { cols, rows } = layerCells(size, def.grid)
  const x0 = Math.max(cells.from.x, 0)
  const y0 = Math.max(cells.from.y, 0)
  const x1 = Math.min(cells.to.x, cols - 1)
  const y1 = Math.min(cells.to.y, rows - 1)
  if (x1 < x0 || y1 < y0) return undefined
  return {
    x: x0 * def.grid,
    y: y0 * def.grid,
    w: (x1 - x0 + 1) * def.grid,
    h: (y1 - y0 + 1) * def.grid,
    erase: view.tool === 'eraser',
  }
}

/** The boxes of the selected entities on the level's visible entities layers, in the order they were selected. */
export function selectionBoxes(
  project: Project,
  level: Level,
  view: DrawView,
): (Bounds & { readonly id: string })[] {
  return view.selected.flatMap((id) => {
    for (const layer of level.layers) {
      if (layer.kind !== 'entities' || view.hidden.has(layer.def)) continue
      const item = layer.items.find((candidate) => candidate.id === id)
      const def = entityDefOf(project, item?.def)
      if (item !== undefined && def !== undefined) return [{ id, ...entityBounds(def, item) }]
    }
    return []
  })
}

/**
 * The links whose source is an instance of `level` on a visible layer (plan ED2D.6c decision 4), in the project's link
 * order. A broken ref is no link, so it draws nothing (G-g); a link to something in the same level also gets a line.
 */
export function linkChips(project: Project, level: Level, view: DrawView): LinkDraw[] {
  const visible = new Set<string>()
  for (const layer of level.layers)
    if (layer.kind === 'entities' && !view.hidden.has(layer.def))
      for (const item of layer.items) visible.add(item.id)
  const selected = new Set(view.selected)
  return projectLinks(project).flatMap(({ from, field, to }) => {
    const source = from.item
    if (from.level !== level.id || source === undefined || !visible.has(source.id)) return []
    return [
      {
        id: source.id,
        field,
        from: { x: source.x, y: source.y },
        label: linkName(project, to),
        color: entityDefOf(project, source.def)?.color,
        selected: selected.has(source.id),
        to: to.level === level.id && to.item !== undefined ? { x: to.item.x, y: to.item.y } : undefined,
      },
    ]
  })
}
