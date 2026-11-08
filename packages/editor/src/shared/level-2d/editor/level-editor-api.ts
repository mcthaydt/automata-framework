// What the Level view and its session can ask of the Level editor, and what it shows back. The logic is in
// `level-editor.ts`; the pure helpers it leans on are in `level-editor-support.ts`.
import type { IdSource } from '../model/ids'
import type { Project } from '../model/project-types'
import type { Point } from '../tiles/footprint'

export type LevelTool = 'select' | 'brush' | 'rectangle' | 'fill' | 'eraser' | 'picker'

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
  readonly tool: LevelTool
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
