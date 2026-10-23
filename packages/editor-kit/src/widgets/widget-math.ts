// Small numeric helpers the value widgets share (steppers, sliders). Pure; no DOM.

export function clamp(value: number, low: number | undefined, high: number | undefined): number {
  let result = value
  if (low !== undefined && result < low) result = low
  if (high !== undefined && result > high) result = high
  return result
}

/** Decimal places in the shortest spelling of a number: 0.25 has 2, 1e-7 has 7, 10 has 0. */
export function decimalsOf(value: number): number {
  const [mantissa = '', exponent] = String(Math.abs(value)).split('e')
  const fraction = mantissa.split('.')[1]?.length ?? 0
  return Math.max(0, fraction - (exponent === undefined ? 0 : Number(exponent)))
}

/**
 * Rounds to `decimals` places by scaling in decimal notation, so a sum such as 0.1 × 3 comes back as 0.3 and a
 * half such as 2.675 rounds the way it reads, not the way its binary form falls.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value
  const [mantissa = '', exponent = '0'] = String(value).split('e')
  const scaled = Math.round(Number(`${mantissa}e${Number(exponent) + decimals}`))
  const [digits = '', power = '0'] = String(scaled).split('e')
  return Number(`${digits}e${Number(power) - decimals}`)
}

/**
 * The next enabled index from `from` in `direction`, or `undefined` when there is none. With `wrap` (the default)
 * it goes round the ends; a `from` of -1 walks from the start forward or from the end backward.
 */
export function nextEnabled(
  count: number,
  from: number,
  direction: 1 | -1,
  isEnabled: (index: number) => boolean,
  wrap = true,
): number | undefined {
  let index = from === -1 && direction === -1 ? count : from
  for (let tried = 0; tried < count; tried++) {
    index += direction
    if (wrap) index = ((index % count) + count) % count
    else if (index < 0 || index >= count) return undefined
    if (isEnabled(index)) return index
  }
  return undefined
}
