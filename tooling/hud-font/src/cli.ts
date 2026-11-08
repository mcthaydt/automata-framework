import { bake } from './bake.ts'
import { FONTS_DIR, verifyRecord } from './record.ts'

const command = process.argv[2]
if (command === 'bake') {
  const record = bake()
  for (const [id, page] of Object.entries(record.pages)) {
    console.info(`${id}: ${page.glyphs} glyphs, atlas ${page.atlasSize}, ${page.atlasBytes} bytes`)
  }
} else if (command === 'verify') {
  const problems = verifyRecord(FONTS_DIR)
  for (const problem of problems) console.error(problem)
  process.exit(problems.length > 0 ? 1 : 0)
} else {
  console.error('usage: pnpm hud-font bake | verify')
  process.exit(2)
}
