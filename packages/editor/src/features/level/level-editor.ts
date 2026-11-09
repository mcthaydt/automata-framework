import { unpackTile } from '../../shared/level-2d/model/cells-codec'
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
import type { LevelEditorView } from '../../shared/level-2d/model/editor-view'
import type {
  EntitiesLayerDef,
  LayerDef,
  ObjectsLayerDef,
  Project,
} from '../../shared/level-2d/model/project-types'
import { brushCells, lineCells, type Point } from '../../shared/level-2d/tiles/footprint'
import type { LevelEditor, LevelEditorOptions } from './level-editor-api'
import {
  aliveIds,
  cellAt,
  changesView,
  defaultWord,
  existingSingle,
  type Gesture,
  layerDef,
  snapped,
  type Transaction,
  toggled,
} from './level-editor-support'

// The Level view's logic: what the toolbar and the palette have chosen, and what a pointer
// does to the project through the edit commands, one `History` step per gesture. No Svelte, DOM or Pixi in here: the
// view reads `view`, calls the setters and forwards pointer events in level pixels. The project itself stays in the
// history, which the controller reads at every event, so undo and redo need nothing from it.

const MIN_BRUSH = 1
const MAX_BRUSH = 8

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

  function update(patch: Partial<LevelEditorView>): void {
    if (!changesView(view, patch)) return
    view = { ...view, ...patch }
    for (const run of [...listeners]) run()
  }

  const target = (): LayerTarget => ({ level: view.level, layer: view.layer })

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

  function downOnEntities(def: EntitiesLayerDef, at: Point): void {
    const where = target()
    const step = def.snap ? def.grid : 1
    if (view.tool === 'brush') {
      const defId = view.entityDef
      if (defId === undefined) return
      const x = snapped(at.x, step)
      const y = snapped(at.y, step)
      const id = existingSingle(project(), view.level, defId) ?? ids.next()
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

  /** Only the brush works on an objects layer so far: picking an object needs a hit test, which is not built yet. */
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
      const alive = aliveIds(project(), view.level)
      update({ selected: ids.filter((id) => alive.has(id)) })
    },
    refresh() {
      // A level the document no longer has (an undone Add level) gives way to the first one, so the view never stands on
      // a level that is not there.
      const levels = project().levels
      if (!levels.some((level) => level.id === view.level) && levels[0] !== undefined) {
        endGesture(false)
        update({ level: levels[0].id, selected: [] })
        return
      }
      const alive = aliveIds(project(), view.level)
      update({ selected: view.selected.filter((id) => alive.has(id)) })
    },
  }
  return editor
}
