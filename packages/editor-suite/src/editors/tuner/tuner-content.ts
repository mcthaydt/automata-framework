import { DocumentSyntaxError, openDocument } from '@mcthaydt/automata-editor-kit/documents'

// What the Tuner reads of `content/tuning.toml` (editor suite spec §6.1, EDS-D18): each top-level row as a tunable with its
// kind, value, bounds, unit and note. Pure: the text (and the compiler's `tuning-meta.json` when the game declares its
// tunables in code) in, the list out. A row that is a table or an array is listed as "Ask only": the Tuner never edits
// what is not one literal.

export const TUNING_PATH = 'content/tuning.toml'

export type TunableKind = 'int' | 'float' | 'boolean' | 'string' | 'other'

export interface Tunable {
  readonly name: string
  readonly kind: TunableKind
  readonly value: number | boolean | string | undefined
  readonly min?: number
  readonly max?: number
  readonly step?: number
  /** True when the file itself states the bounds (`{ value, min, max, step }`). */
  readonly authored: boolean
  readonly unit?: string
  readonly note?: string
  /** False for a table or an array: the Tuner shows it and sends changes to Ask. */
  readonly editable: boolean
}

/** One row of the compiler's `tuning-meta.json`: the bounds a code-owned game declares. */
export interface TuningMetaEntry {
  readonly type: string
  readonly value?: unknown
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

export type TuningMeta = Readonly<Record<string, TuningMetaEntry>>

export type TuningRead = { readonly tunables: readonly Tunable[] } | { readonly problem: string }

const isTable = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The last line of a comment run, without its `#`. */
const lastLine = (comment: string): string | undefined => {
  const lines = comment
    .split('\n')
    .map((line) => line.replace(/^\s*#\s?/, '').trim())
    .filter((line) => line !== '')
  return lines[lines.length - 1]
}

/**
 * A comment that is just a unit (`px/s²`, `ticks`, `%`) is the unit. One with a number or words in it (`Celeste: 90 px/s.`)
 * says what the number is and stays a note: the number in it is not this value, and its unit is not this value's.
 */
const unitOf = (note: string): string | undefined =>
  /^[^\s\d.,;:()][^\s]{0,11}$/.test(note) ? note : undefined

export function readTuning(text: string, meta: TuningMeta = {}): TuningRead {
  const document = openDocument(TUNING_PATH, text)
  let value: unknown
  let literals: ReturnType<typeof document.literals>
  try {
    value = document.value()
    literals = document.literals()
  } catch (error) {
    if (error instanceof DocumentSyntaxError)
      return { problem: `${TUNING_PATH}, line ${error.line ?? '?'}: ${error.message}` }
    throw error
  }
  if (!isTable(value)) return { problem: `${TUNING_PATH} is not a table of tunables` }

  const spelling = (name: string, ...rest: string[]): string | undefined =>
    literals.find(
      (literal) =>
        literal.keyPath.length === 1 + rest.length &&
        literal.keyPath[0] === name &&
        rest.every((key, index) => literal.keyPath[index + 1] === key),
    )?.text

  const tunables = Object.entries(value).map(([name, row]): Tunable => {
    const comments = document.comments([name])
    const note =
      comments.trailing !== undefined
        ? lastLine(comments.trailing)
        : comments.before !== undefined
          ? lastLine(comments.before)
          : undefined
    const unit = note === undefined ? undefined : unitOf(note)
    const words = { ...(note === undefined ? {} : { note }), ...(unit === undefined ? {} : { unit }) }
    const declared = meta[name]

    if (isTable(row) && typeof row['value'] === 'number') {
      const floats = ['value', 'step'].some((key) => /[.eE]/.test(spelling(name, key) ?? ''))
      return {
        name,
        kind: floats ? 'float' : 'int',
        value: row['value'],
        ...(typeof row['min'] === 'number' ? { min: row['min'] } : {}),
        ...(typeof row['max'] === 'number' ? { max: row['max'] } : {}),
        ...(typeof row['step'] === 'number' ? { step: row['step'] } : {}),
        authored: true,
        editable: true,
        ...words,
      }
    }
    if (typeof row === 'number') {
      const kind: TunableKind =
        declared?.type === 'int' || declared?.type === 'float'
          ? declared.type
          : /[.eE]/.test(spelling(name) ?? '')
            ? 'float'
            : 'int'
      return {
        name,
        kind,
        value: row,
        ...(declared?.min === undefined ? {} : { min: declared.min }),
        ...(declared?.max === undefined ? {} : { max: declared.max }),
        ...(declared?.step === undefined ? {} : { step: declared.step }),
        authored: false,
        editable: true,
        ...words,
      }
    }
    if (typeof row === 'boolean')
      return { name, kind: 'boolean', value: row, authored: false, editable: true, ...words }
    if (typeof row === 'string')
      return { name, kind: 'string', value: row, authored: false, editable: true, ...words }
    return { name, kind: 'other', value: undefined, authored: false, editable: false, ...words }
  })
  return { tunables }
}
