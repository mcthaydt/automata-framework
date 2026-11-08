// Records the kit's goldens from the kit's own code: the geometry of every outfit that wears something the kit adds
// (tests/fixtures/goldens/dress.json). The tests compare the code against this file; this script is the one place that writes it. A change
// that moves a golden is re-recorded in a named commit that explains it.
//
//   pnpm --filter @automata/character-kit goldens [--out <dir>]     (default: tests/fixtures/goldens)
//
// The kit's garments and pieces register when `character-kit.extension.ts` loads, so it is loaded first.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { recordDress } from '@automata/3d/testing'
import '../src/app/character-kit.extension.ts'
import { kitFixture } from '../src/testing/kit-fixture.ts'
import { KIT_OUTFITS } from '../src/testing/kit-outfits.ts'

/** Where the committed goldens live. */
const GOLDENS = join(import.meta.dirname, '../tests/fixtures/goldens')

const flag = process.argv.indexOf('--out')
const out = flag >= 0 ? (process.argv[flag + 1] ?? GOLDENS) : GOLDENS
mkdirSync(out, { recursive: true })
const fixture = await kitFixture()
const text = recordDress(KIT_OUTFITS, { ...fixture, figures: {}, stands: {} })
writeFileSync(join(out, 'dress.json'), text)
console.log(`wrote ${join(out, 'dress.json')}`)
