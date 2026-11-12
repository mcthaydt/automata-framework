/** Prints the pins of tests/support/pins.ts as a `PINS` literal, for the recording commit (F0): `npx vite-node scripts/c9-pins.ts`. */
import { PIN_NAMES, pinCell } from '../tests/support/pins'

console.log('export const PINS: Record<string, string> = {')
for (const n of PIN_NAMES) console.log(`  '${n}': '${pinCell(n)}',`)
console.log('};')
