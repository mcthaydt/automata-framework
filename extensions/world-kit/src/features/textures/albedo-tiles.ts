// A textured swatch's tile as a texture of DUEL colours: its labels read against the swatch's ladder (tone offsets on its
// ramp, its accent's, a photo-mode texel on its own ramp) and written as RGBA, one palette colour a texel. `drawWorld`
// lays it on a piece nearest-sampled and the light multiplies it, so the texel's albedo is a palette index, not a flat colour.
import type { AlbedoTile } from '@automataframework/3d'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { tileColours } from './tile-colours.ts'
import { TILE_FILES } from './tile-files.ts'
import { decodeTileFile, ladderOf, type TexturedSwatch, textureOf } from './tile-read.ts'

const PALETTE = DEFAULT_PALETTE.colors.map((h) => Number.parseInt(h.slice(1), 16))

/**
 * The tile of a swatch by name (a name may carry a seed, `name#123`, which only sets where the tile starts on a surface
 * tiled in the world), or `undefined` for a flat swatch or one with no tile. Each tile is made once.
 */
export function albedoTiles(
  swatches: Readonly<Record<string, TexturedSwatch>>,
): (name: string) => AlbedoTile | undefined {
  const made = new Map<string, AlbedoTile | undefined>()
  const base = (name: string): AlbedoTile | undefined => {
    if (made.has(name)) return made.get(name)
    const swatch = swatches[name]
    const file = TILE_FILES[name]
    let tile: AlbedoTile | undefined
    if (swatch !== undefined && file !== undefined && textureOf(swatch) !== undefined) {
      const labels = decodeTileFile(file)
      const index = tileColours(labels, ladderOf(swatch, swatches))
      const rgba = new Uint8Array(index.length * 4)
      index.forEach((p, i) => {
        const c = PALETTE[p] as number
        rgba.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], i * 4)
      })
      const seed = (swatch.texture as { seed?: number } | undefined)?.seed ?? 0
      tile = { width: file.width, height: file.height, texels: file.texels, rgba, seed }
    }
    made.set(name, tile)
    return tile
  }
  return (name) => {
    const [root, seed] = name.split('#')
    const tile = base(root as string)
    return tile === undefined || seed === undefined ? tile : { ...tile, seed: Number(seed) }
  }
}
