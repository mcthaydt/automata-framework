import { packTile, unpackTile } from '../../shared/level-2d/model/cells-codec'
import {
  cellWord,
  fillLayer,
  paintLayerCells,
  paintLayerRect,
} from '../../shared/level-2d/model/commands/cell-edits'
import { deleteEntity, moveEntity, placeEntity } from '../../shared/level-2d/model/commands/entity-edits'
import { entityAt } from '../../shared/level-2d/model/commands/entity-geometry'
import type { LayerTarget } from '../../shared/level-2d/model/commands/layer-target'
import { placeObject } from '../../shared/level-2d/model/commands/object-edits'
import type { EditHistory } from '../../shared/level-2d/model/edit-history'
import type { LevelEditorView, LevelTool } from '../../shared/level-2d/model/editor-view'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type {
  EntitiesLayerDef,
  LayerDef,
  ObjectsLayerDef,
  Project,
} from '../../shared/level-2d/model/project-types'
import { brushCells, lineCells, type Point } from '../../shared/level-2d/tiles/footprint'

// The Level view's logic (2D editor spec §5.9, §8): what the toolbar and the palette have chosen, and what a pointer
// does to the project through the edit commands, one `History` step per gesture. No Svelte, DOM or Pixi in here: the
// view reads `view`, calls the setters and forwards pointer events in level pixels. The project itself stays in the
// history, which the controller reads at every event, so undo and redo need nothing from it.

export interface LevelEditor {
  readonly view: LevelEditorView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  setLevel(id: string): void
  setLayer(def: string): void
  setTool(tool: LevelTool): void
  setBrushSize(size: number): void
  setWord(word: number): void
  setEntityDef(def: string): void
  setLocked(layer: string, locked: boolean): void
  setHidden(layer: string, hidden: boolean): void
  /** Level pixels. Follows the pointer and feeds an open gesture. */
  pointerMove(at: Point): void
  pointerDown(at: Point): void
  pointerUp(): void
  /** The pointer was cancelled (a palm, a system gesture): ends a gesture with no step. */
  cancel(): void
  pointerLeave(): void
  /** Replaces the selection with the ids the open level has (a Checks row, the copies a duplicate made). */
  select(ids: readonly string[]): void
  /** Drops selected ids the project no longer has; the app calls it when the history changes. */
  refresh(): void
}

export interface LevelEditorOptions {
  readonly history: EditHistory
  readonly ids: IdSource
  readonly level: string
  /** Default: the first layer of the project's definitions. */
  readonly layer?: string
}

const MIN_BRUSH = 1
const MAX_BRUSH = 8

function layerDef(project: Project, id: string): LayerDef {
  const found = project.defs.layers.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no layer "${id}"`)
  return found
}

function defaultWord(def: LayerDef): number {
  if (def.kind === 'intgrid') return def.values[0]?.value ?? 0
  if (def.kind === 'entities') return 0
  return packTile(0, false, false)
}

type Transaction = ReturnType<EditHistory['begin']>

/** What a pointer is in the middle of. A transaction shows its updates live and is one history step when it commits. */
type Gesture =
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

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i])
const samePoint = (a: Point | undefined, b: Point | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.x === b.x && a.y === b.y)

export function createLevelEditor(options: LevelEditorOptions): LevelEditor {
  const { history, ids } = options
  const project = (): Project => history.state
  const listeners = new Set<() => void>()
  /** Each layer remembers the palette word chosen on it: an IntGrid value and a packed tile share no meaning. */
  const words = new Map<string, number>()
  const wordFor = (def: LayerDef): number => words.get(def.id) ?? defaultWord(def)

  const firstLayer = project().defs.layers[0]
  if (!project().levels.some((level) => level.id === options.level))
    throw new RangeError(`no level "${options.level}"`)
  const startLayer = options.layer ?? firstLayer?.id
  if (startLayer === undefined) throw new RangeError('the project has no layers')
  const startDef = layerDef(project(), startLayer)

  let gesture: Gesture | undefined

  let view: LevelEditorView = {
    level: options.level,
    layer: startLayer,
    tool: 'brush',
    brushSize: MIN_BRUSH,
    word: wordFor(startDef),
    entityDef: project().defs.entities[0]?.id,
    selected: [],
    hover: undefined,
    locked: new Set(),
    hidden: new Set(),
    gesture: 'idle',
    rectangle: undefined,
  }

  /** The instance ids of the open level's entities layers. */
  function aliveIds(): ReadonlySet<string> {
    const level = project().levels.find((candidate) => candidate.id === view.level)
    return new Set(
      level?.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items.map((item) => item.id) : [])),
    )
  }

  function update(patch: Partial<LevelEditorView>): void {
    const next = { ...view, ...patch }
    const changed = (Object.keys(patch) as (keyof LevelEditorView)[]).some((key) => {
      const a = view[key]
      const b = next[key]
      if (key === 'selected') return !sameList(view.selected, next.selected)
      if (key === 'hover') return !samePoint(view.hover, next.hover)
      return a !== b
    })
    if (!changed) return
    view = next
    for (const run of [...listeners]) run()
  }

  function toggled(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
    if (set.has(id) === on) return set
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    return next
  }

  const target = (): LayerTarget => ({ level: view.level, layer: view.layer })

  /** The cell of a layer under a level pixel. An objects layer has no grid, so its "cell" is the pixel. */
  function cellAt(def: LayerDef, at: Point): Point {
    const grid = def.kind === 'objects' ? 1 : def.grid
    return { x: Math.floor(at.x / grid), y: Math.floor(at.y / grid) }
  }

  function endGesture(commit: boolean): void {
    if (gesture === undefined) return
    const { tx } = gesture
    gesture = undefined
    if (commit) tx.commit()
    else tx.cancel()
    update({ gesture: 'idle', rectangle: undefined })
  }

  /** Runs `change` as a live update of the gesture's transaction; a command that refuses ends the gesture and rethrows. */
  function live(tx: Transaction, change: (project: Project) => Project): void {
    try {
      tx.update(change)
    } catch (error) {
      endGesture(false)
      throw error
    }
  }

  function downOnCells(cell: Point): void {
    const where = target()
    if (view.tool === 'brush' || view.tool === 'eraser') {
      const erase = view.tool === 'eraser'
      const tx = history.begin(erase ? 'Erase' : 'Paint')
      const painted = erase ? 0 : view.word
      gesture = { kind: 'stroke', tx, target: where, word: painted, last: cell }
      update({ gesture: 'stroke' })
      live(tx, (p) => paintLayerCells(p, where, brushCells(cell, view.brushSize), painted))
    } else if (view.tool === 'rectangle') {
      const base = project()
      const tx = history.begin('Rectangle')
      gesture = { kind: 'rectangle', tx, base, target: where, word: view.word, anchor: cell }
      update({ gesture: 'rectangle', rectangle: { from: cell, to: cell } })
      live(tx, () => paintLayerRect(base, where, cell, cell, view.word))
    } else if (view.tool === 'fill') {
      history.apply('Fill', (p) => fillLayer(p, where, cell, view.word))
    } else if (view.tool === 'picker') {
      const picked = cellWord(project(), where, cell)
      if (picked !== 0) editor.setWord(picked)
    }
  }

  function strokeTo(stroke: Extract<Gesture, { kind: 'stroke' }>, cell: Point): void {
    if (cell.x === stroke.last.x && cell.y === stroke.last.y) return
    const size = view.brushSize
    const cells = lineCells(stroke.last, cell).flatMap((onLine) => brushCells(onLine, size))
    stroke.last = cell
    live(stroke.tx, (p) => paintLayerCells(p, stroke.target, cells, stroke.word))
  }

  function dragRectangle(drag: Extract<Gesture, { kind: 'rectangle' }>, cell: Point): void {
    update({ rectangle: { from: drag.anchor, to: cell } })
    live(drag.tx, () => paintLayerRect(drag.base, drag.target, drag.anchor, cell, drag.word))
  }

  /** The id of the instance of a `single` definition the level already has, wherever it is: `placeEntity` moves that one. */
  function existingSingle(defId: string): string | undefined {
    const definition = project().defs.entities.find((candidate) => candidate.id === defId)
    if (definition?.single !== true) return undefined
    const level = project().levels.find((candidate) => candidate.id === view.level)
    for (const layer of level?.layers ?? [])
      if (layer.kind === 'entities') {
        const found = layer.items.find((item) => item.def === defId)
        if (found !== undefined) return found.id
      }
    return undefined
  }

  /** A pointer coordinate moved to the layer's grid when it snaps, otherwise to a whole pixel. */
  const snapped = (value: number, step: number): number => Math.round(value / step) * step

  function downOnEntities(def: EntitiesLayerDef, at: Point): void {
    const where = target()
    const step = def.snap ? def.grid : 1
    if (view.tool === 'brush') {
      const defId = view.entityDef
      if (defId === undefined) return
      const x = snapped(at.x, step)
      const y = snapped(at.y, step)
      const id = existingSingle(defId) ?? ids.next()
      history.apply('Place entity', (p) => placeEntity(p, where, { id, def: defId, x, y }))
      update({ selected: [id] })
      return
    }
    const hit = entityAt(project(), where, at)
    if (view.tool === 'select') {
      if (hit === undefined) {
        update({ selected: [] })
        return
      }
      const tx = history.begin('Move entity')
      gesture = {
        kind: 'move',
        tx,
        base: project(),
        target: where,
        id: hit.id,
        grab: at,
        origin: { x: hit.x, y: hit.y },
        step,
      }
      update({ selected: [hit.id], gesture: 'move' })
    } else if (hit === undefined) {
      return
    } else if (view.tool === 'eraser') {
      history.apply('Delete entity', (p) => deleteEntity(p, where, hit.id))
      update({ selected: view.selected.filter((id) => id !== hit.id) })
    } else if (view.tool === 'picker') {
      update({ selected: [hit.id], entityDef: hit.def })
    }
  }

  /** Only the brush works on an objects layer so far: picking an object needs a hit test, which comes with ED2D.4d. */
  function downOnObjects(def: ObjectsLayerDef, at: Point): void {
    if (view.tool !== 'brush') return
    const tile = unpackTile(view.word)
    if (tile === undefined) return
    const step = Math.max(def.snap, 1)
    const where = target()
    const input = {
      id: ids.next(),
      tile: tile.tile,
      x: snapped(at.x, step),
      y: snapped(at.y, step),
      flipX: tile.flipX,
      flipY: tile.flipY,
    }
    history.apply('Place object', (p) => placeObject(p, where, input))
  }

  function dragEntity(drag: Extract<Gesture, { kind: 'move' }>, at: Point): void {
    const x = drag.origin.x + snapped(at.x - drag.grab.x, drag.step)
    const y = drag.origin.y + snapped(at.y - drag.grab.y, drag.step)
    live(drag.tx, () => moveEntity(drag.base, drag.target, drag.id, x, y))
  }

  const editor: LevelEditor = {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    setLevel(id) {
      if (!project().levels.some((level) => level.id === id)) throw new RangeError(`no level "${id}"`)
      endGesture(false)
      update({ level: id, selected: [] })
    },
    setLayer(def) {
      const next = layerDef(project(), def)
      endGesture(false)
      update({ layer: def, word: wordFor(next), selected: [] })
    },
    setTool(tool) {
      endGesture(false)
      update({ tool })
    },
    setBrushSize(size) {
      if (!Number.isFinite(size)) throw new RangeError(`a brush size is a number, not ${size}`)
      update({ brushSize: Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, Math.round(size))) })
    },
    setWord(word) {
      words.set(view.layer, word)
      update({ word })
    },
    setEntityDef(def) {
      if (!project().defs.entities.some((candidate) => candidate.id === def))
        throw new RangeError(`no entity definition "${def}"`)
      update({ entityDef: def })
    },
    setLocked(layer, locked) {
      layerDef(project(), layer)
      update({ locked: toggled(view.locked, layer, locked) })
    },
    setHidden(layer, hidden) {
      layerDef(project(), layer)
      update({ hidden: toggled(view.hidden, layer, hidden) })
    },
    pointerMove(at) {
      const cell = cellAt(layerDef(project(), view.layer), at)
      update({ hover: cell })
      if (gesture?.kind === 'stroke') strokeTo(gesture, cell)
      else if (gesture?.kind === 'rectangle') dragRectangle(gesture, cell)
      else if (gesture?.kind === 'move') dragEntity(gesture, at)
    },
    pointerDown(at) {
      endGesture(false)
      const def = layerDef(project(), view.layer)
      if (view.locked.has(def.id) || view.hidden.has(def.id)) return
      if (def.kind === 'tiles' || def.kind === 'intgrid' || def.kind === 'auto') downOnCells(cellAt(def, at))
      else if (def.kind === 'entities') downOnEntities(def, at)
      else downOnObjects(def, at)
    },
    pointerUp() {
      endGesture(true)
    },
    cancel() {
      endGesture(false)
    },
    pointerLeave() {
      update({ hover: undefined })
    },
    select(ids) {
      const alive = aliveIds()
      update({ selected: ids.filter((id) => alive.has(id)) })
    },
    refresh() {
      const alive = aliveIds()
      update({ selected: view.selected.filter((id) => alive.has(id)) })
    },
  }
  return editor
}
