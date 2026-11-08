// How a value is written into one of these hand-formatted JSON files. The blockout files are formatted by hand, so a number never prints with an exponent and never with float
// noise (`0.1 + 0.2` is `0.3`); a value the file already has keeps its own text and is not printed at all.

/** A value cannot be written the way these files write it. */
export class JsonWriteError extends Error {}

export type JsonScalar = string | number | boolean | null

/** The value a number is written as: rounded to 4 decimals, which trims float noise (`0.1 + 0.2` is `0.3`). */
export const roundJsonNumber = (value: number): number => Math.round(value * 1e4) / 1e4

/** A number the way the blockout files write one: no exponent, float noise trimmed to 4 decimals. */
export function formatJsonNumber(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new JsonWriteError(`${String(value)} is not a finite number`)
  const rounded = roundJsonNumber(value)
  const text = String(Object.is(rounded, -0) ? 0 : rounded)
  if (/e/i.test(text)) throw new JsonWriteError(`${value} is too large to write without an exponent`)
  return text
}

/** A scalar as these files write it: numbers by `formatJsonNumber` (or the style given), strings as JSON strings. */
export function formatJsonScalar(value: JsonScalar, numbers: NumberStyle = BLOCKOUT_NUMBERS): string {
  if (typeof value === 'number') return numbers.format(value)
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return JSON.stringify(value)
  throw new JsonWriteError(`${JSON.stringify(value)} is not a JSON scalar`)
}

/**
 * How a writer spells and reads back numbers. The blockout style (the default of the JSON engine) trims float
 * noise to four decimals and never writes an exponent; the exact style (the content documents) writes the shortest text that reads back as exactly the number, so nothing is lost.
 */
export interface NumberStyle {
  /** The number a value reads back as once written. */
  readonly round: (value: number) => number
  /** The number's text; throws `JsonWriteError` when it cannot be written. */
  readonly format: (value: number) => string
}

export const BLOCKOUT_NUMBERS: NumberStyle = { round: roundJsonNumber, format: formatJsonNumber }

/** A number as the shortest text that reads back as exactly it (JavaScript's own number to string). */
export function formatExactNumber(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new JsonWriteError(`${String(value)} is not a finite number`)
  return String(value)
}

export const EXACT_NUMBERS: NumberStyle = { round: (value) => value, format: formatExactNumber }
