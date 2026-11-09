import type { ContentEdit } from '../../../shared/kit/documents/content-document.ts'
import { shownName, type Tunable } from './tuner-content'
import { shownValue } from './tuner-display'

// The Tuner's typed edit: a person's new value for one tunable, held to its kind and bounds
// before anything is written (EDS-c), and the content edit that makes it. Pure. The compiler's own check still judges the
// file as the `content` check; this refuses what a person can see is wrong in words of their own.

export type ValueCheck = { readonly ok: true } | { readonly message: string }

export function checkValue(tunable: Tunable, value: number | boolean | string): ValueCheck {
  // In the setting's own words: its label, and a number as the Tuner shows it (`90 px/s`, not the sim's 384).
  const name = shownName(tunable)
  const say = (raw: number): string =>
    tunable.scale === undefined ? String(raw) : `${shownValue(tunable, raw)} ${tunable.unit ?? ''}`.trim()
  if (!tunable.editable) return { message: `${name} is a table or a list: change it in the file` }
  if (tunable.kind === 'boolean')
    return typeof value === 'boolean' ? { ok: true } : { message: `${name}: that is not on or off` }
  if (tunable.kind === 'string')
    return typeof value === 'string' ? { ok: true } : { message: `${name}: that is not text` }
  if (typeof value !== 'number' || !Number.isFinite(value))
    return { message: `${name}: that is not a number` }
  if (tunable.kind === 'int' && !Number.isInteger(value))
    return { message: `${name}: ${value} is not a whole number` }
  if (tunable.max !== undefined && value > tunable.max)
    return { message: `${name}: ${say(value)} is past the largest it may be, ${say(tunable.max)}` }
  if (tunable.min !== undefined && value < tunable.min)
    return { message: `${name}: ${say(value)} is under the smallest it may be, ${say(tunable.min)}` }
  return { ok: true }
}

/** The edit that gives `tunable` a new value: a bare row's own literal, or an inline table's `value`. */
export function valueEdit(tunable: Tunable, value: number | boolean | string): ContentEdit {
  const keyPath = tunable.authored ? [tunable.name, 'value'] : [tunable.name]
  return { keyPath, expected: tunable.value, set: value }
}
