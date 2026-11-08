import { type ControlsFile, controlsFileSchema, RESERVED_KEYS } from '@automata/content/controls'
import { keyLabel, PROMPT_COPY, padLabel } from '@automata/framework'
import {
  type ContentEdit,
  DocumentSyntaxError,
  openDocument,
} from '../../../shared/kit/documents/content-document.ts'

// What the Tuner's Controls section reads and edits of `content/controls.toml`: a game's default controls, one row per
// action. Keys and pad buttons are shown by the names a player sees in the game (core's prompt words), never as codes.
// Pure: the text in, rows out; and the edits (content edits for the kit's documents, which rewrite only the literal
// they touch). Players still rebind in the game's Settings; this changes what a new player starts with.

export const CONTROLS_PATH = 'content/controls.toml'

export interface ControlKey {
  /** The `KeyboardEvent.code` the file holds. */
  readonly code: string
  /** What the game shows a player for it. */
  readonly label: string
}
export interface ControlPad {
  readonly button: number
  readonly label: string
}
export interface ControlRow {
  readonly id: string
  /** The action's name: the file's `label`, else its id. */
  readonly label: string
  /** Whether the file names it (an unnamed action's name is its id, shown as such). */
  readonly named: boolean
  readonly keys: readonly ControlKey[]
  readonly pads: readonly ControlPad[]
  /** Whether a touch screen shows a button for it. */
  readonly touch: boolean
}

export type ControlsRead = { readonly rows: readonly ControlRow[] } | { readonly problem: string }

/** The rows of a controls file, or a sentence for what is wrong with it. */
export function readControls(text: string): ControlsRead {
  let value: unknown
  try {
    value = openDocument(CONTROLS_PATH, text).value()
  } catch (error) {
    if (error instanceof DocumentSyntaxError)
      return { problem: `${CONTROLS_PATH}, line ${error.line ?? '?'}: ${error.message}` }
    throw error
  }
  const parsed = controlsFileSchema.safeParse(value)
  if (!parsed.success)
    return { problem: `${CONTROLS_PATH}: ${parsed.error.issues[0]?.message ?? 'it is not a controls file'}` }
  return { rows: parsed.data.action.map(rowOf) }
}

const rowOf = (action: ControlsFile['action'][number]): ControlRow => ({
  id: action.id,
  label: action.label ?? action.id,
  named: action.label !== undefined,
  keys: (action.keys ?? []).map((code) => ({ code, label: keyLabel(code) })),
  pads: (action.pad ?? []).map((button) => ({ button, label: padLabel(button, 'generic', PROMPT_COPY) })),
  // A key gives an action its touch button unless the file says no.
  touch: action.touch ?? (action.keys ?? []).length > 0,
})

/** The sentence for a key the game keeps for its menus or already has on the action; undefined when it may be added. */
export function keyProblem(row: ControlRow, code: string): string | undefined {
  if (RESERVED_KEYS.includes(code)) return 'That key is kept for the menus.'
  if (row.keys.some((key) => key.code === code))
    return `${keyLabel(code)} is already one of the keys for ${row.label}.`
  return undefined
}

/** The edits that give action `index` a name: its label rewritten, or written in when it had none. */
export function labelEdit(text: string, index: number, label: string): ContentEdit {
  const action = actionAt(text, index)
  return action['label'] === undefined
    ? { keyPath: ['action', index, 'label'], insert: label }
    : { keyPath: ['action', index, 'label'], expected: action['label'], set: label }
}

/** The edit that adds `code` to action `index`'s keys, starting the list when it had none. */
export function addKeyEdit(text: string, index: number, code: string): ContentEdit {
  const keys = actionAt(text, index)['keys']
  return Array.isArray(keys)
    ? { keyPath: ['action', index, 'keys'], insert: code }
    : { keyPath: ['action', index, 'keys'], insert: [code] }
}

/** The edit that takes `code` off action `index`'s keys. */
export function removeKeyEdit(text: string, index: number, code: string): ContentEdit {
  const keys = actionAt(text, index)['keys']
  const at = Array.isArray(keys) ? keys.indexOf(code) : -1
  return { keyPath: ['action', index, 'keys', Math.max(at, 0)], remove: true }
}

/** The edit that turns action `index`'s touch button on or off. */
export function touchEdit(text: string, index: number, on: boolean): ContentEdit {
  const action = actionAt(text, index)
  return action['touch'] === undefined
    ? { keyPath: ['action', index, 'touch'], insert: on }
    : { keyPath: ['action', index, 'touch'], expected: action['touch'], set: on }
}

function actionAt(text: string, index: number): Record<string, unknown> {
  const value = openDocument(CONTROLS_PATH, text).value() as { action?: unknown }
  const action = Array.isArray(value.action) ? value.action[index] : undefined
  return typeof action === 'object' && action !== null ? (action as Record<string, unknown>) : {}
}
