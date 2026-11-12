import { readFileSync } from 'node:fs'
import { readPhotoLibrary, tileFileOf } from '@automata/world-kit/textures'
import { describe, expect, it } from 'vitest'
import { LIBRARY, PAINT } from '#src/features/room/room.ts'
import { OWN_TILE_NAMES } from '#src/features/room/tiles.ts'

// The ward's own surfaces are drawn from tiles the kit's photo pipeline makes for the game's swatches (`src/features/room/world-tiles`, by
// `tools/tiles/make.ts`). A swatch with no tile is drawn as one flat colour, which is how the floor and the walls once looked: the
// kit holds tile files for its own swatches only, so the game's three were silently flat.

const luma = (rgba: Uint8Array, i: number): number =>
  0.2126 * (rgba[i] as number) + 0.7152 * (rgba[i + 1] as number) + 0.0722 * (rgba[i + 2] as number)

describe('the ward’s tiles', () => {
  it('give the floor, the plaster and the wainscot a tile each: none is drawn flat', () => {
    expect(OWN_TILE_NAMES).toEqual(['ward-floor', 'ward-plaster', 'ward-wainscot'])
    for (const name of OWN_TILE_NAMES) expect(PAINT.tiles(name), name).toBeDefined()
  })

  it('are exactly what the kit’s pipeline makes for the swatches now', () => {
    const photos = readPhotoLibrary()
    for (const name of OWN_TILE_NAMES) {
      const committed = readFileSync(
        new URL(`../../../../src/features/room/world-tiles/${name}.tile.json`, import.meta.url),
        'utf8',
      )
      const made = tileFileOf(name, LIBRARY.swatches[name] as never, photos)
      // The compiled swatch lists its keys in order, the file's own as it was written: the data is what must agree.
      expect(JSON.parse(committed), `${name}: run node tools/tiles/make.ts`).toEqual(
        JSON.parse(JSON.stringify(made)),
      )
    }
  })

  it('draw the floor as tiles on dark grout: a grid line a third as bright as the glaze, a tile 30 cm across', () => {
    const floor = PAINT.tiles('ward-floor')
    const rgba = floor?.rgba as Uint8Array
    const lumas: number[] = []
    for (let i = 0; i < rgba.length; i += 4) lumas.push(luma(rgba, i))
    const sorted = [...lumas].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] as number
    const grout = lumas.filter((value) => value < median * 0.6).length / lumas.length
    // The old floor's grout is one texel in eight, each way: 1 - (7/8)^2 = 23%; the photo's is thinner, but not under 5%.
    expect(grout).toBeGreaterThan(0.05)
    expect(grout).toBeLessThan(0.3)
    // Tiles repeat every 0.3 m: the photo holds six of them a side, whatever texel scale it is read at.
    const metres = (floor?.width ?? 0) / (floor?.texels[0] ?? 1)
    expect(metres / 6).toBeCloseTo(0.3, 1)
  })

  it('draw the wainscot as cream glazed tile on a dark joint: a grid of 15 cm tiles, from the floor-tile photograph (Floor Tiles 08)', () => {
    const wainscot = PAINT.tiles('ward-wainscot')
    const { rgba, width, height } = wainscot as NonNullable<typeof wainscot>
    // The photograph holds five tiles a side (30 cm each at its size of 1.5 m), so 15 cm tiles are a photograph 0.75 m across.
    const tilesAcross = 5
    expect(width / (wainscot?.texels[0] ?? 1) / tilesAcross).toBeCloseTo(0.15, 2)
    expect(LIBRARY.swatches['ward-wainscot']).toMatchObject({ texture: { photo: 'floorTiles' } })
    // The grid reads when each column's mean light, shifted by one tile, still lines up with itself (joints under joints),
    // which a tile with no joint (flat glaze, or specks) does not do. Measured 0.4 or more on both axes; the flat tile before
    // read under 0.1.
    const lumas = new Float64Array(width * height)
    for (let i = 0; i < width * height; i++) lumas[i] = luma(rgba, i * 4)
    const lag = Math.round(width / tilesAcross)
    const alike = (profile: number[]): number => {
      const mean = profile.reduce((sum, value) => sum + value, 0) / profile.length
      const centred = profile.map((value) => value - mean)
      const self = centred.reduce((sum, value) => sum + value * value, 0)
      const shifted = centred.reduce(
        (sum, value, i) => sum + value * (centred[(i + lag) % centred.length] as number),
        0,
      )
      return self === 0 ? 0 : shifted / self
    }
    const columns = Array.from({ length: width }, (_, x) => {
      let sum = 0
      for (let y = 0; y < height; y++) sum += lumas[y * width + x] as number
      return sum / height
    })
    const rows = Array.from({ length: height }, (_, y) => {
      let sum = 0
      for (let x = 0; x < width; x++) sum += lumas[y * width + x] as number
      return sum / width
    })
    expect(alike(columns)).toBeGreaterThan(0.4)
    expect(alike(rows)).toBeGreaterThan(0.4)
  })
})
