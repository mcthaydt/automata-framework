/**
 * Split's choice: side by side when both
 * columns and the gap between them fit at their minimum, stacked otherwise.
 */
export function splitMode(available: number, min: number, gap: number): 'row' | 'stack' {
  return available >= 2 * min + gap ? 'row' : 'stack'
}
