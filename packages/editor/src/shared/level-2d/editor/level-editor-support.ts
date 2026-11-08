// The Level editor's small pure pieces: finding a layer, the shape of an open gesture, and the arithmetic that turns a
// pointer position into a cell or a snapped coordinate, and what a view patch or the project says about ids. Nothing
// here holds state.
import { packTile } from '../model/cells-codec'
import type { LayerTarget } from '../model/commands/layer-target'
import type { LayerDef, Project } from '../model/project-types'
import type { Point } from '../tiles/footprint'
import type { LevelEditorView } from './level-editor-api'

export function layerDef(project: Project, id: string): LayerDef {
  const found = project.defs.layers.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no layer "${id}"`)
  return found
}

export function defaultWord(def: LayerDef): number {
  if (def.kind === 'intgrid') return def.values[0]?.value ?? 0
  if (def.kind === 'entities') return 0
  return packTile(0, false, false)
}

/** What `EditHistory.begin` returns, written out so this file needs nothing from the editor. */
export interface Transaction {
  update(fn: (project: Project) => Project): void
  commit(): void
  cancel(): void
}

/** What a pointer is in the middle of. A transaction shows its updates live and is one history step when it commits. */
export type Gesture =
  | {
      readonly kind: 'stroke'
      readonly tx: Transaction
      readonly target: LayerTarget
      readonly word: number
      last: Point
    }
  | {
      readonly kind: 'rectangle'
      readonly tx: Transaction
      readonly base: Project
      readonly target: LayerTarget
      readonly word: number
      readonly anchor: Point
    }
  | {
      readonly kind: 'move'
      readonly tx: Transaction
      /** The project as it was at pointer down: every move is computed from it, so dragging back to the start is no edit. */
      readonly base: Project
      readonly target: LayerTarget
      readonly id: string
      readonly grab: Point
      readonly origin: Point
      readonly step: number
    }

export const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i])
export const samePoint = (a: Point | undefined, b: Point | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.x === b.x && a.y === b.y)

export function toggled(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  if (set.has(id) === on) return set
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

/** The cell of a layer under a level pixel. An objects layer has no grid, so its "cell" is the pixel. */
export function cellAt(def: LayerDef, at: Point): Point {
  const grid = def.kind === 'objects' ? 1 : def.grid
  return { x: Math.floor(at.x / grid), y: Math.floor(at.y / grid) }
}

/** A pointer coordinate moved to the layer's grid when it snaps, otherwise to a whole pixel. */
export const snapped = (value: number, step: number): number => Math.round(value / step) * step

/** The instance ids of the entities layers of level `levelId`. */
export function aliveIds(project: Project, levelId: string): ReadonlySet<string> {
  const level = project.levels.find((candidate) => candidate.id === levelId)
  return new Set(
    level?.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items.map((item) => item.id) : [])),
  )
}

/** The id of the instance of a `single` definition the level already has, wherever it is: `placeEntity` moves that one. */
export function existingSingle(project: Project, levelId: string, defId: string): string | undefined {
  if (project.defs.entities.find((candidate) => candidate.id === defId)?.single !== true) return undefined
  const level = project.levels.find((candidate) => candidate.id === levelId)
  for (const layer of level?.layers ?? [])
    if (layer.kind === 'entities') {
      const found = layer.items.find((item) => item.def === defId)
      if (found !== undefined) return found.id
    }
  return undefined
}

/** Whether applying `patch` to `view` changes anything a listener would see; selections and hover compare by value. */
export function changesView(view: LevelEditorView, patch: Partial<LevelEditorView>): boolean {
  return (Object.keys(patch) as (keyof LevelEditorView)[]).some((key) => {
    if (key === 'selected') return !sameList(view.selected, patch.selected ?? [])
    if (key === 'hover') return !samePoint(view.hover, patch.hover)
    return view[key] !== patch[key]
  })
}
