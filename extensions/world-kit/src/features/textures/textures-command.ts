// `automata-world-textures`: makes the tile of every textured swatch the kit's library has, from the photos in
// `assets/photos`, and checks the committed ones.
//
//   automata-world-textures [--out <folder>]   write <swatch>.tile.json for each textured swatch (default library/tiles)
//   automata-world-textures --check [--out <folder>]
//                                              write nothing; list tiles that are missing, stray or older than their
//                                              photo, and swatches whose tile fails the `reads` they declare
//
// Exit 0 when all is well, 1 when a tile is wrong, 2 for a mistake in the command.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type PhotoLibrary, readPhotoLibrary } from './photos.ts'
import { swatchIssues } from './swatch-issues.ts'
import { staleTiles, type TexturedSwatch, type TileFile, textureOf, tileFileOf } from './swatch-tiles.ts'

export interface CommandResult {
  readonly code: 0 | 1 | 2
  readonly stdout: string
  readonly stderr: string
}

/** The kit's own swatches, read from the library file: this command runs under bare Node, which cannot load the core
 * packages the library module imports. */
export const readKitSwatches = (): Record<string, TexturedSwatch> =>
  JSON.parse(readFileSync(new URL('../../../library/swatches.json', import.meta.url), 'utf8')) as Record<
    string,
    TexturedSwatch
  >

/** The folder the kit's tiles are committed in. */
export const TILE_DIR = new URL('../../../library/tiles/', import.meta.url).pathname

const SUFFIX = '.tile.json'

/** The tiles a folder holds, by swatch name. */
export function readTiles(dir: string): Record<string, TileFile> {
  if (!existsSync(dir)) return {}
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith(SUFFIX))
      .map((file) => [
        file.slice(0, -SUFFIX.length),
        JSON.parse(readFileSync(join(dir, file), 'utf8')) as TileFile,
      ]),
  )
}

/** Runs the command on `args`, over `swatches` and `photos` (the kit's own unless a test gives others). */
export function runTextures(
  args: readonly string[],
  swatches: Readonly<Record<string, TexturedSwatch>> = readKitSwatches(),
  photos: PhotoLibrary = readPhotoLibrary(),
): CommandResult {
  const known = new Set(['--check', '--out'])
  const flag = args.find((a) => a.startsWith('--') && !known.has(a))
  if (flag !== undefined)
    return {
      code: 2,
      stdout: '',
      stderr: `automata-world-textures does not know ${flag}. It takes --check and --out <folder>.\n`,
    }
  const outAt = args.indexOf('--out')
  if (outAt >= 0 && (args[outAt + 1] === undefined || args[outAt + 1]?.startsWith('--')))
    return { code: 2, stdout: '', stderr: '--out needs a folder: --out library/tiles\n' }
  const dir = resolve(outAt >= 0 ? (args[outAt + 1] as string) : TILE_DIR)
  if (!existsSync(dir) && outAt >= 0 && args.includes('--check'))
    return { code: 2, stdout: '', stderr: `There is no folder ${dir} to check.\n` }
  const textured = Object.entries(swatches).filter(([, s]) => textureOf(s) !== undefined)

  const lines: string[] = []
  let bad = false
  if (args.includes('--check')) {
    for (const problem of staleTiles(readTiles(dir), swatches, photos)) {
      lines.push(`${problem.code.padEnd(13)}${problem.message}`)
      bad = true
    }
  } else {
    mkdirSync(dir, { recursive: true })
    for (const [name, swatch] of textured) {
      writeFileSync(join(dir, `${name}${SUFFIX}`), `${JSON.stringify(tileFileOf(name, swatch, photos))}\n`)
      lines.push(`wrote        ${name}${SUFFIX}`)
    }
  }
  for (const [name, swatch] of textured) {
    if (swatch.reads === undefined) continue
    const issues = swatchIssues(swatch, photos)
    lines.push(
      `${issues.length > 0 ? 'fails' : 'ok   '}        ${name}${issues.length > 0 ? `: ${issues.join('; ')}` : ''}`,
    )
    if (issues.length > 0) bad = true
  }
  return { code: bad ? 1 : 0, stdout: `${lines.join('\n')}\n`, stderr: '' }
}
