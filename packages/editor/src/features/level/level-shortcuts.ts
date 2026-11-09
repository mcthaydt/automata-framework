import type { LevelTool } from '../../shared/level-2d/editor/level-editor-api'
import type { Point } from '../../shared/level-2d/tiles/footprint'

// The Level view's keyboard shortcuts. Each one is also a visible
// control, so nothing here is keyboard-only. While focus is in a text field only undo and redo pass, so typing a name
// never switches tools; arrows nudge only where the view says they may (the canvas or the position row), so a list's
// own arrow keys keep working. `Mod` is Command or Control, whichever the keyboard has.

export type LevelShortcut =
  | { readonly action: 'undo' | 'redo' | 'delete' | 'duplicate' }
  | { readonly action: 'tool'; readonly tool: LevelTool }
  /** The palette's nth row (from 0), by its number key; the Level view says which keys exist. */
  | { readonly action: 'choose'; readonly index: number }
  /** The brush size, by one cell. */
  | { readonly action: 'brush'; readonly by: -1 | 1 }
  /** The selection, in cells. */
  | { readonly action: 'nudge'; readonly by: Point }

/** The parts of a `KeyboardEvent` the map reads. */
export interface ShortcutKey {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

export interface ShortcutContext {
  /** Focus is in a text input or text area. */
  readonly inText: boolean
  /** Focus is on the canvas or the inspector's position row. */
  readonly canNudge: boolean
}

const TOOL_KEYS: Readonly<Record<string, LevelTool>> = {
  b: 'brush',
  r: 'rectangle',
  g: 'fill',
  e: 'eraser',
  i: 'picker',
}

const ARROWS: Readonly<Record<string, Point>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/** Shift-arrow nudges this many cells. */
const BIG_NUDGE = 8

export function shortcutFor(event: ShortcutKey, context: ShortcutContext): LevelShortcut | undefined {
  const mod = event.metaKey || event.ctrlKey
  const letter = event.key.toLowerCase()
  if (mod && !event.altKey && letter === 'z') return { action: event.shiftKey ? 'redo' : 'undo' }
  if (context.inText) return undefined
  if (mod) return !event.altKey && !event.shiftKey && letter === 'd' ? { action: 'duplicate' } : undefined
  if (event.altKey) return undefined
  if (event.key === 'Delete' || event.key === 'Backspace') return { action: 'delete' }
  if (/^[1-9]$/.test(event.key) && !event.shiftKey) return { action: 'choose', index: Number(event.key) - 1 }
  if (event.key === '[') return { action: 'brush', by: -1 }
  if (event.key === ']') return { action: 'brush', by: 1 }
  const arrow = ARROWS[event.key]
  if (arrow !== undefined) {
    if (!context.canNudge) return undefined
    const step = event.shiftKey ? BIG_NUDGE : 1
    return { action: 'nudge', by: { x: arrow.x * step, y: arrow.y * step } }
  }
  const tool = Object.hasOwn(TOOL_KEYS, letter) && !event.shiftKey ? TOOL_KEYS[letter] : undefined
  return tool === undefined ? undefined : { action: 'tool', tool }
}
