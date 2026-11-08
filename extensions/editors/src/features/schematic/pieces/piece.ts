// A piece is one kind of condition or action as a person reads it: a sentence with fields. The editor's whole
// vocabulary is a table of them (`conditions.ts`, `actions.ts`), and the diagram, the list, the inspector and the add
// menus all read that table. A value the table does not know stays in the file, shown read only.
import type { Field } from '../../../shared/fields.ts'

/** What the file names that a field may choose from: the character's modes, the scene's characters, facts and places. */
export interface Names {
  readonly modes: readonly string[]
  readonly agents: readonly string[]
  readonly facts: readonly string[]
  readonly places: readonly string[]
  readonly hooks: readonly string[]
  readonly doorways: readonly string[]
}

export const NO_NAMES: Names = { modes: [], agents: [], facts: [], places: [], hooks: [], doorways: [] }

/** How the add menu groups pieces, in the order it lists them. */
export type PieceGroup = 'notices' | 'where' | 'true' | 'time' | 'move' | 'change' | 'tell'

export interface Piece<V> {
  readonly kind: string
  readonly group: PieceGroup
  /** What the add menu says for this kind ("sees the player"). */
  readonly menu: string
  /** Whether the file's value is this kind. */
  matches(value: unknown): value is V
  /** The sentence, with the fields' current values in it. */
  words(value: V, names: Names): string
  /** The fields the sentence shows, in order. */
  fields(value: V, names: Names): Field[]
  /** The value with the field `key` set to `next`; the same value when nothing changes. */
  write(value: V, key: string, next: unknown): V
  /** A new one that passes the schema and means something at once. */
  fresh(names: Names): V
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether `value` is an object with exactly the keys `required` and any of `optional`. */
export function hasShape(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  )
}

/** A name the person wrote as she reads it: dots, dashes and underscores become spaces ("power.on" is "power on"). */
export const spaced = (name: string): string => name.replace(/[._-]+/g, ' ')

/** A mode's name as a title ("search-room" is "Search room"). */
export function modeWords(mode: string): string {
  const text = spaced(mode)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** A number as it reads ("2.50" is "2.5"). */
export const num = (value: number): string => String(Number.parseFloat(value.toFixed(3)))

/** A fact's value as it reads: yes, no, a number or quoted text. */
export function valueWords(value: unknown): string {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (typeof value === 'number') return num(value)
  return `“${String(value)}”`
}

export const YES_NO: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
]

/** The field for a fact's value: yes or no, a number, or text, as the value is now. */
export function valueField(key: string, label: string, value: boolean | number | string): Field {
  if (typeof value === 'boolean')
    return { key, label, kind: 'choice', value: value ? 'yes' : 'no', options: YES_NO }
  if (typeof value === 'number') return { key, label, kind: 'number', min: -1000, max: 1000, step: 1, value }
  return { key, label, kind: 'text', value }
}

/** `next` from a field, in the type of the `current` value. */
export function valueFrom(current: boolean | number | string, next: unknown): boolean | number | string {
  if (typeof current === 'boolean') return next === 'yes' || next === true
  if (typeof current === 'number') return Number(next)
  return String(next)
}
