// Writes the kit's compiled fixture content (swatches, hairstyles, gaits, stands) as one JSON file, so a browser page
// with no content compiler can draw the fixture figures: the side-by-side harness in examples/3d/diagnosis reads it.
//
//   pnpm --filter @automata/character-kit dump-fixture     (writes examples/3d/diagnosis/fixture.json)

import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIGURE_CONTENT } from '@automata/3d/figures'
import { FIXTURE_ROOT } from '@automata/3d/testing'
import { compileContentResult } from '@automata/content'
import '../src/app/character-kit.extension.ts'
import { figureSeatContent } from '../src/features/seats/seat.content.ts'

const out = process.argv[2]
if (out === undefined) throw new Error('say where to write: dump-fixture.ts <out.json>')
const root = mkdtempSync(join(tmpdir(), 'character-kit-dump-'))
try {
  cpSync(FIXTURE_ROOT, root, { recursive: true })
  cpSync(join(import.meta.dirname, '../tests/fixtures'), root, { recursive: true })
  const result = await compileContentResult({ root, schemas: [...FIGURE_CONTENT, figureSeatContent] })
  if (!result.ok) throw new Error(String(result.error._tag))
  writeFileSync(out, `${JSON.stringify(result.content.data, null, 2)}\n`)
  console.log(`wrote ${out}`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
