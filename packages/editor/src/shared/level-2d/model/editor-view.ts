import type { Point } from '../tiles/footprint'

// What the Level view shows and what the canvas draws from it: the chosen tool and brush, the selection, the cell under
// the pointer and the open gesture. The Level view's logic (`features/level/level-editor.ts`) owns it; it lives here
// because the canvas reads it too, and `shared/` may not import a feature.

export type LevelTool = 'select' | 'brush' | 'rectangle' | 'fill' | 'eraser' | 'picker'

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
