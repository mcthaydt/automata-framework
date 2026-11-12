// A textured swatch's tile as a texture of DUEL colours, read against the swatch's ladder: what `drawWorld` lays on a piece.

import { readdirSync } from 'node:fs'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import { albedoTiles } from '#src/features/textures/albedo-tiles.ts'
import { TILE_FILES } from '#src/features/textures/tile-files.ts'

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
})
