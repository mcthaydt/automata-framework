/** Prints the pins of tests/fixtures/pins.ts as a `PINS` literal, for the recording commit: `pnpm --filter @automataframework/figures exec tsx scripts/c9-pins.ts`. */
import { PIN_NAMES, pinCell } from '../tests/fixtures/pins'

console.log('export const PINS: Record<string, string> = {')
for (const n of PIN_NAMES) console.log(`  '${n}': '${pinCell(n)}',`)
console.log('};')
