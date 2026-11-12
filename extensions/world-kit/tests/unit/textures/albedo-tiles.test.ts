// A textured swatch's tile as a texture of DUEL colours, read against the swatch's ladder: what `drawWorld` lays on a piece.

import { readdirSync } from 'node:fs'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import { albedoTiles } from '#src/features/textures/albedo-tiles.ts'
import { encodeLabels } from '#src/features/textures/swatch-tiles.ts'
import { TILE_FILES } from '#src/features/textures/tile-files.ts'
import { TILE_FORMAT, type TileFile } from '#src/features/textures/tile-read.ts'

const duel = new Set(DEFAULT_PALETTE.colors.map((h) => Number.parseInt(h.slice(1), 16)))
const tiles = albedoTiles(worldKitLibrary.swatches as never)

describe('albedoTiles', () => {
  it('holds a tile file for every committed tile, and none more', () => {
    const files = readdirSync(new URL('../../../library/tiles/', import.meta.url))
      .filter((f) => f.endsWith('.tile.json'))
      .map((f) => f.replace('.tile.json', ''))
    expect(Object.keys(TILE_FILES).sort()).toEqual(files.sort())
  })
  it('gives a textured swatch its tile, every texel a DUEL colour', () => {
    const t = tiles('asphalt')
    expect(t).toBeDefined()
    expect([t?.width, t?.height, t?.texels]).toEqual([96, 96, [32, 32]])
    for (let i = 0; i < (t?.rgba.length ?? 0); i += 4) {
      const c =
        ((t?.rgba[i] as number) << 16) | ((t?.rgba[i + 1] as number) << 8) | (t?.rgba[i + 2] as number)
      expect(duel.has(c)).toBe(true)
      expect(t?.rgba[i + 3]).toBe(255)
    }
  })
  it('gives a flat swatch no tile', () => {
    expect(tiles('trimWhite')).toBeUndefined()
    expect(tiles('noSuchSwatch')).toBeUndefined()
  })
  it('takes a seeded name as its base swatch with the seed set', () => {
    const base = tiles('asphalt')
    const seeded = tiles('asphalt#7')
    expect(seeded?.rgba).toEqual(base?.rgba)
    expect(seeded?.seed).not.toBe(base?.seed)
  })
  it('shows the texture on the swatch’s ladder: a tone offset moves the base colour along its ramp', () => {
    // wear and the photo's tone make more than one step of the swatch's ramp, never a colour off it
    const t = tiles('oakFloor')
    const seen = new Set<number>()
    for (let i = 0; i < (t?.rgba.length ?? 0); i += 4)
      seen.add(
        ((t?.rgba[i] as number) << 16) | ((t?.rgba[i + 1] as number) << 8) | (t?.rgba[i + 2] as number),
      )
    expect(seen.size).toBeGreaterThan(1)
  })
  // A game paints some of its own surfaces by hand (a pixel painter's tile, not a photo): its tile file is its own, a swatch needs
  // no photo for it, and the game's name wins over a kit swatch of the same name.
  describe('a game’s own tile files', () => {
    const own = (swatch: string, labels: number[], texels: number): TileFile => ({
      format: TILE_FORMAT,
      swatch,
      photo: 'hand-painted',
      sha256: '',
      texture: {},
      texels: [texels, texels],
      width: 2,
      height: 2,
      labels: encodeLabels(Uint16Array.from(labels)),
    })
    // Photo-mode labels: slot = ramp + 2, value = the step on it (sand is ramp 1, so #625d54 is step 0 and #857565 step 1).
    const sand = (step: number) => (1 + 2) * 16 + step
    const swatches = { floor: { ramp: 'sand', step: 0 }, asphalt: { ramp: 'sand', step: 0 } }
    const mine = {
      floor: own('floor', [sand(0), sand(1), sand(1), sand(0)], 26.5),
      asphalt: own('asphalt', [sand(7), sand(7), sand(7), sand(7)], 32),
    }

    it('gives a swatch with no texture the tile the game painted, at the scale it says', () => {
      const t = albedoTiles(swatches as never, mine)('floor')
      expect([t?.width, t?.height, t?.texels]).toEqual([2, 2, [26.5, 26.5]])
      expect(Array.from(t?.rgba.slice(0, 8) ?? [])).toEqual([0x62, 0x5d, 0x54, 255, 0x85, 0x75, 0x65, 255])
    })
    it('prefers the game’s tile to the kit’s of the same name', () => {
      const t = albedoTiles(swatches as never, mine)('asphalt')
      expect(Array.from(t?.rgba.slice(0, 3) ?? [])).toEqual([0xff, 0xf3, 0xd6])
    })
    it('still takes a seeded name as its base', () => {
      expect(albedoTiles(swatches as never, mine)('floor#9')?.seed).toBe(9)
    })
  })
})
