// Makes the tile files of the game's own swatches (`content/world-swatches/*.toml` that name a photo) with the world kit's photo
// pipeline, into `src/features/room/world-tiles/<swatch>.tile.json`. Run it after changing one: a test fails when a file is not what this makes.
//
//   node --experimental-transform-types tools/tiles/make.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPhotoLibrary, type TexturedSwatch, textureOf, tileFileOf } from '@automata/world-kit/textures'
import { parse } from 'smol-toml'

const root = fileURLToPath(new URL('../..', import.meta.url))
const swatchDir = join(root, 'content/world-swatches')
const tileDir = join(root, 'src/features/room/world-tiles')

mkdirSync(tileDir, { recursive: true })
const photos = readPhotoLibrary()
for (const file of readdirSync(swatchDir).filter((name) => name.endsWith('.toml'))) {
  const swatch = parse(readFileSync(join(swatchDir, file), 'utf8')) as unknown as TexturedSwatch
  if (textureOf(swatch) === undefined) continue
  const name = file.slice(0, -'.toml'.length)
  writeFileSync(join(tileDir, `${name}.tile.json`), `${JSON.stringify(tileFileOf(name, swatch, photos))}\n`)
  console.log(`wrote src/features/room/world-tiles/${name}.tile.json`)
}
