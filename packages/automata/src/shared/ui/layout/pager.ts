/**
 * PagerDots' choice: dots while they fit on one
 * row, a counter ("3 / 11") once they would not. Dots never wrap.
 */
export function pagerMode(
  count: number,
  max = 9,
  available: number = Number.POSITIVE_INFINITY,
  dotSize = 44,
): 'dots' | 'counter' {
  if (count > max) return 'counter'
  return count * dotSize <= available ? 'dots' : 'counter'
}
