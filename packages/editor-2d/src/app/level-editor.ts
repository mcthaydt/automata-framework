import { packTile } from '../model/cells-codec'
import { cellWord, fillLayer, paintLayerCells, paintLayerRect } from '../model/commands/cell-edits'
import type { LayerTarget } from '../model/commands/layer-target'
import type { IdSource } from '../model/ids'
import type { LayerDef, Project } from '../model/project-types'
import { brushCells, lineCells, type Point } from '../tiles/footprint'

// The Level view's logic (2D editor spec §5.9, §8): what the toolbar and the palette have chosen, and what a pointer
// does to the project through the edit commands, one `History` step per gesture. No Svelte, DOM or Pixi in here: the
// view reads `view`, calls the setters and forwards pointer events in level pixels. The project itself stays in the
// history, which the controller reads at every event, so undo and redo need nothing from it.

export type Tool = 'select' | 'brush' | 'rectangle' | 'fill' | 'eraser' | 'picker'

/** What the controller needs of the kit's `History<Project>`, which satisfies it. */
export interface EditHistory {
  readonly state: Project
  apply(label: string, update: (project: Project) => Project): void
  begin(label: string): {
    update(fn: (project: Project) => Project): void
    commit(): void
    cancel(): void
  }
}

export interface LevelEditorView {
  readonly level: string
  /** The active layer's definition id. */
  readonly layer: string
  readonly tool: Tool
  /** 1 to 8 cells. */
  readonly brushSize: number
  /** The palette's choice: an IntGrid value or a packed tile; 0 erases. */
  readonly word: number
  /** The palette's choice on an entities layer. */
  readonly entityDef: string | undefined
  /** Selected instance ids. */
  readonly selected: readonly string[]
  /** The cell under the pointer, for the brush footprint. */
  readonly hover: Point | undefined
  readonly locked: ReadonlySet<string>
  readonly hidden: ReadonlySet<string>
  readonly gesture: 'idle' | 'stroke' | 'rectangle' | 'move'
  /** The rectangle being dragged, in cells, corners as the pointer went down and is now. */
  readonly rectangle: { readonly from: Point; readonly to: Point } | undefined
}

export interface LevelEditor {
  readonly view: LevelEditorView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  setLevel(id: string): void
  setLayer(def: string): void
  setTool(tool: Tool): void
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

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i])
const samePoint = (a: Point | undefined, b: Point | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.x === b.x && a.y === b.y)

export function createLevelEditor(options: LevelEditorOptions): LevelEditor {
  const { history } = options
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
    },
    pointerDown(at) {
      endGesture(false)
      const def = layerDef(project(), view.layer)
      if (view.locked.has(def.id) || view.hidden.has(def.id)) return
      if (def.kind === 'tiles' || def.kind === 'intgrid' || def.kind === 'auto') downOnCells(cellAt(def, at))
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
    refresh() {},
  }
  return editor
}
