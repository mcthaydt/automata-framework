import type { Point } from '@automata/content/level-2d'
import { createViewport, type Size, type Viewport2D } from '../../shared/kit/gestures/viewport-2d.ts'
import type { History } from '../../shared/kit/history/history.ts'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import type { IdSource } from '../../shared/level-2d/model/ids'
import { createLevelEditor } from './level-editor'
import type { LevelEditor } from './level-editor-api'
import type { LevelFocus } from './level-focus'

// One Level view's state over an open document: the
// level editor on the document's history, and the viewport that says where the level sits on the canvas. Plain
// TypeScript, so the Node tests drive what the Svelte view only draws and forwards. The camera is the canvas's
// (`LevelCanvas`); it is undefined until the canvas has been measured, and the first measure fits the level.

/** Screen pixels kept clear around a fitted level. */
const FIT_PADDING = 24

export interface LevelSession {
  readonly editor: LevelEditor
  /** Where the level sits on the canvas; undefined until `measure`. */
  readonly camera: Camera | undefined
  /** Called after the camera changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** The canvas's size in CSS pixels: the first fits the level, later ones keep the centre where it is. */
  measure(size: Size): void
  panBy(dx: number, dy: number): void
  zoomAt(point: Point, factor: number): void
  /** Zooms about the middle of the canvas: the − and + buttons. */
  zoomBy(factor: number): void
  /** The whole level, as large as it fits. */
  fit(): void
  /** A canvas point (CSS pixels) in level pixels. */
  toLevel(point: Point): Point
  dispose(): void
}

export interface LevelSessionOptions {
  readonly history: History<unknown>
  readonly ids: IdSource
  /** Default: the project's first level. */
  readonly level?: string
  /** Where Locate opens the view: its level wins over `level`, then its layer is chosen and its instance selected. */
  readonly focus?: LevelFocus | undefined
}

/** Undefined for a document that is not a level project, or one with no level to show. */
export function createLevelSession(options: LevelSessionOptions): LevelSession | undefined {
  const edits = projectHistory(options.history)
  const levels = edits?.state.levels ?? []
  const wanted = options.focus?.level ?? options.level
  const first = levels.find((level) => level.id === wanted) ?? levels[0]
  if (edits === undefined || first === undefined) return undefined

  const editor = createLevelEditor({ history: edits, ids: options.ids, level: first.id })
  const focus = options.focus
  if (focus?.level === first.id && focus.layer !== undefined) {
    editor.setLayer(focus.layer)
    if (focus.item !== undefined) editor.select([focus.item])
  }
  const listeners = new Set<() => void>()
  let viewport: Viewport2D | undefined

  const levelRect = () => {
    const level = edits.state.levels.find((each) => each.id === editor.view.level) ?? first
    return { x: 0, y: 0, w: level.size.w, h: level.size.h }
  }
  const moved = (next: Viewport2D): void => {
    viewport = next
    for (const run of [...listeners]) run()
  }
  const stopHistory = options.history.subscribe(() => editor.refresh())

  return {
    editor,
    get camera() {
      return viewport === undefined
        ? undefined
        : { x: viewport.pan.x, y: viewport.pan.y, scale: viewport.zoom }
    },
    subscribe(run) {
      listeners.add(run)
      return () => listeners.delete(run)
    },
    measure(size) {
      if (viewport !== undefined) return moved(viewport.resize(size))
      moved(createViewport({ size, limits: { bounds: levelRect() } }).fit(levelRect(), FIT_PADDING))
    },
    panBy(dx, dy) {
      if (viewport !== undefined) moved(viewport.panBy(dx, dy))
    },
    zoomAt(point, factor) {
      if (viewport !== undefined) moved(viewport.zoomAt(point, factor))
    },
    zoomBy(factor) {
      if (viewport !== undefined)
        moved(viewport.zoomAt({ x: viewport.size.w / 2, y: viewport.size.h / 2 }, factor))
    },
    fit() {
      if (viewport !== undefined) moved(viewport.fit(levelRect(), FIT_PADDING))
    },
    toLevel: (point) => viewport?.screenToWorld(point) ?? point,
    dispose() {
      stopHistory()
      listeners.clear()
    },
  }
}
