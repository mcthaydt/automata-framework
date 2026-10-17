/**
 * Split's choice (M4 spec §4.8; from FloorFifty `ui/layout/split.ts` at `ac72660`): side by side when both
 * columns and the gap between them fit at their minimum, stacked otherwise.
 */
export function splitMode(available: number, min: number, gap: number): 'row' | 'stack' {
  return available >= 2 * min + gap ? 'row' : 'stack'
}
