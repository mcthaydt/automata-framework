// Records the wardrobe's goldens from the wardrobe's own code: the geometry of every streetwear outfit
// (goldens/dress.json) and every stand placed on it (goldens/stands.json). The tests compare the code against these
// files; this script is the one place that writes them. A change that moves a golden is re-recorded in a named commit
// that explains it.
//
//   pnpm --filter @af-examples/wardrobe-3d goldens [--out <dir>]     (default: goldens)
//
// The wardrobe's garments register when `wardrobe.extension.ts` loads, so it is loaded first.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixtureFigures, recordDress, recordStands, section } from '@automata/3d/testing'
import '../wardrobe.extension.ts'
import { WARDROBE_OUTFITS } from '../testing/wardrobe-outfits.ts'

/** Where the committed goldens live. */
const GOLDENS = join(import.meta.dirname, '../goldens')

const flag = process.argv.indexOf('--out')
const out = flag >= 0 ? (process.argv[flag + 1] ?? GOLDENS) : GOLDENS
mkdirSync(out, { recursive: true })
const fixture = await fixtureFigures()
const stands = `{\n${section(recordStands(WARDROBE_OUTFITS, fixture), '  ').join('\n')}\n}\n`
for (const [name, text] of [
  ['dress.json', recordDress(WARDROBE_OUTFITS, fixture)],
  ['stands.json', stands],
] as const) {
  writeFileSync(join(out, name), text)
  console.log(`wrote ${join(out, name)}`)
}
