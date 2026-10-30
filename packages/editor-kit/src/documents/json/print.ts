// Extracted from The Last Light scripts/pipeline/json-edit.ts (92e6704): how a value is written into one of these
// files. The blockout files are formatted by hand, so a number never prints with an exponent and never with float
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

/** A scalar as these files write it: numbers by `formatJsonNumber`, strings as JSON strings. */
export function formatJsonScalar(value: JsonScalar): string {
  if (typeof value === 'number') return formatJsonNumber(value)
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return JSON.stringify(value)
  throw new JsonWriteError(`${JSON.stringify(value)} is not a JSON scalar`)
}
