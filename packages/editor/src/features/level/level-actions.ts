import { commitEdit } from '../../shared/level-2d/editor/field-commit'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { LevelSession } from './level-session'
import type { LevelShortcut } from './level-shortcuts'
import { deleteSelected, duplicateSelected, nudgeSelected } from './selection-edits'

// What the Level regions do with the session: Delete,
// Duplicate and the keyboard shortcuts. Each reads the editor's view as it is now. Undo and Redo are the host's: the
// standalone view passes its document's, and in the suite the top bar owns them, so a shortcut with no handler is left
// for the suite to take.

export interface LevelUndo {
  readonly onundo?: (() => void) | undefined
  readonly onredo?: (() => void) | undefined
}

export interface LevelActions {
  deleteSelection(): void
  duplicateSelection(): void
  /** Whether `run` acts on the shortcut here, so the key is this view's to take. */
  handles(shortcut: LevelShortcut): boolean
  run(shortcut: LevelShortcut): void
}

export function levelActions(
  session: LevelSession,
  edits: EditHistory,
  ids: IdSource,
  undo: LevelUndo = {},
): LevelActions {
  const { editor } = session

  function deleteSelection(): void {
    const { level, selected } = editor.view
    if (selected.length === 0) return
    commitEdit(edits, 'Delete', (current) => deleteSelected(current, level, selected))
  }

  function duplicateSelection(): void {
    const { level, selected } = editor.view
    if (selected.length === 0) return
    let copies: readonly string[] = []
    commitEdit(edits, 'Duplicate', (current) => {
      const done = duplicateSelected(current, level, selected, ids)
      copies = done.copies
      return done.project
    })
    editor.select(copies)
  }

  return {
    deleteSelection,
    duplicateSelection,
    handles: (shortcut) =>
      shortcut.action === 'undo'
        ? undo.onundo !== undefined
        : shortcut.action === 'redo'
          ? undo.onredo !== undefined
          : true,
    run(shortcut) {
      const view = editor.view
      switch (shortcut.action) {
        case 'undo':
          undo.onundo?.()
          break
        case 'redo':
          undo.onredo?.()
          break
        case 'delete':
          deleteSelection()
          break
        case 'duplicate':
          duplicateSelection()
          break
        case 'tool':
          editor.setTool(shortcut.tool)
          break
        case 'brush':
          editor.setBrushSize(Math.min(8, Math.max(1, view.brushSize + shortcut.by)))
          break
        case 'nudge': {
          if (view.selected.length === 0) break
          const { level, selected } = view
          commitEdit(edits, 'Move entity', (current) => nudgeSelected(current, level, selected, shortcut.by))
        }
      }
    },
  }
}
