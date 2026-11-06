// What the Level view and its session can ask of the Level editor. The logic is in `level-editor.ts`.
import type { EditHistory } from '../../shared/level-2d/model/edit-history'
import type { LevelEditorView, LevelTool } from '../../shared/level-2d/model/editor-view'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { Point } from '../../shared/level-2d/tiles/footprint'

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
