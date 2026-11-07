// Converts a file of maps drawn the builder's way (`maps.json`: a map by id, with rectangles, sprites and a default wall per
// room) into one `af-sector/2` file per map, for `library/maps/`.
//
//   node --import ../../packages/3d/scripts/extensionless-ts.ts scripts/convert-builder-maps.ts <maps.json> --out <dir>
//
// Each map is named by its key in the file (`bedroom` is `bedroom.af-sector.json`).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { convertBuilderMap } from '../src/features/maps/convert-builder-map.ts'

const args = process.argv.slice(2)
const out = args.indexOf('--out')
const source = args.find((arg, index) => !arg.startsWith('--') && index !== out + 1)
if (source === undefined || out < 0 || args[out + 1] === undefined) {
  console.error('usage: convert-builder-maps.ts <maps.json> --out <dir>')
  process.exit(2)
}
const dir = resolve(args[out + 1] as string)
mkdirSync(dir, { recursive: true })
const maps = JSON.parse(readFileSync(resolve(source), 'utf8')) as Record<string, object>
for (const [id, plan] of Object.entries(maps)) {
  const file = join(dir, `${id}.af-sector.json`)
  writeFileSync(file, `${JSON.stringify(convertBuilderMap({ id, ...plan }), null, 2)}\n`)
  console.log(file)
}
