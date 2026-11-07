// Records the figures core draws without the kit (tests/fixtures/core-figures.json): Wick and the base pair. It never
// loads the kit, so what it writes is what core builds alone; the tests then show the same figures built with the kit.
// Run it only to re-record on purpose, from a commit where core's own goldens moved, and say why in the commit.
//
//   pnpm --filter @automata/character-kit goldens:core

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { coreFigureDigests } from '../tests/fixtures/core-figures.ts'

const file = join(import.meta.dirname, '../tests/fixtures/core-figures.json')
writeFileSync(file, `${JSON.stringify(await coreFigureDigests())}\n`)
console.log(`wrote ${file}`)
