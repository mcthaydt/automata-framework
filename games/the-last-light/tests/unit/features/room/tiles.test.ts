import { readdirSync, readFileSync } from 'node:fs'
import { readPhotoLibrary, type TexturedSwatch, tileFileOf } from '@automata/world-kit/textures'
import { describe, expect, it } from 'vitest'
import { LIBRARY, PAINT, WORLD } from '#src/features/room/room.ts'
import { OWN_TILE_NAMES } from '#src/features/room/tiles.ts'
import { photoSwatch, WARD_PHOTOS } from '#src/features/room/world-photos.ts'

// The ward's own surfaces are drawn from tiles the kit's photo pipeline makes for the game's swatches (`src/features/room/world-tiles`, by
// `tools/tiles/make.ts`). A swatch with no tile is drawn as one flat colour, which is how the floor and the walls once looked: the
// kit holds tile files for its own swatches only, so the game's three were silently flat.

const luma = (rgba: Uint8Array, i: number): number =>
  0.2126 * (rgba[i] as number) + 0.7152 * (rgba[i + 1] as number) + 0.0722 * (rgba[i + 2] as number)

describe('the ward’s tiles', () => {
  it('give every swatch of the game’s own that names a photo a tile: none is drawn flat', () => {
    const textured = readdirSync(new URL('../../../../content/world-swatches', import.meta.url))
      .filter((file) => file.endsWith('.toml'))
      .map((file) => file.slice(0, -'.toml'.length))
      .filter((name) => (LIBRARY.swatches[name] as { texture?: unknown } | undefined)?.texture !== undefined)
    expect([...OWN_TILE_NAMES].sort()).toEqual([...textured, ...Object.keys(WARD_PHOTOS)].sort())
    for (const name of OWN_TILE_NAMES) expect(PAINT.tiles(name), name).toBeDefined()
  })

  it('are exactly what the kit’s pipeline makes for the swatches now', () => {
    const photos = readPhotoLibrary()
    for (const name of OWN_TILE_NAMES) {
      const committed = readFileSync(
        new URL(`../../../../src/features/room/world-tiles/${name}.tile.json`, import.meta.url),
        'utf8',
      )
      const swatch =
        name in WARD_PHOTOS
          ? photoSwatch(LIBRARY.swatches[name] as TexturedSwatch, name)
          : LIBRARY.swatches[name]
      const made = tileFileOf(name, swatch as never, photos)
      // The compiled swatch lists its keys in order, the file's own as it was written: the data is what must agree.
      expect(JSON.parse(committed), `${name}: run node tools/tiles/make.ts`).toEqual(
        JSON.parse(JSON.stringify(made)),
      )
    }
  })

  it('draw the floor as tiles on dark grout: a grid line a third as bright as the glaze, a tile 31 cm across', () => {
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
    // The photograph holds five tiles a side (30 cm each); at `scale` 1.0417 each is 31.25 cm (ten texels at 32 a metre, so the
    // one-texel joint falls the same way in every tile and the grid comes out whole), whatever texel scale it is read at.
    const metres = (floor?.width ?? 0) / (floor?.texels[0] ?? 1)
    expect(metres / 5).toBeCloseTo(0.3125, 3)
  })

  it('draw the floor green-grey, the old floor’s hue, with the grout in its own colour whatever the warm tiles take', () => {
    const floor = PAINT.tiles('ward-floor') as NonNullable<ReturnType<typeof PAINT.tiles>>
    const { rgba } = floor
    const grout = 0x222323
    let jointTexels = 0
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < rgba.length; i += 4) {
      r += rgba[i] as number
      g += rgba[i + 1] as number
      b += rgba[i + 2] as number
      if (((rgba[i] as number) << 16) + ((rgba[i + 1] as number) << 8) + (rgba[i + 2] as number) === grout)
        jointTexels++
    }
    const texels = rgba.length / 4
    // The joint is a fifth of the tile, in the old grout's own colour: not a share of it lost to the warm tiles.
    expect(jointTexels / texels).toBeGreaterThan(0.15)
    expect(jointTexels / texels).toBeLessThan(0.3)
    // The mean colour of the tile's glaze, hue by the HSV formula: the old frames' floor reads 146 to 154 (measured on the lit
    // frame: `docs/superpowers/audits/2026-11-12-last-light-session-12-frames`); the tile itself is a green-grey, 120 to 180.
    const mean = [r, g, b].map((v) => v / texels / 255) as [number, number, number]
    const [mr, mg, mb] = mean
    const max = Math.max(mr, mg, mb)
    const delta = max - Math.min(mr, mg, mb)
    const hue =
      60 * (max === mr ? ((mg - mb) / delta) % 6 : max === mg ? (mb - mr) / delta + 2 : (mr - mg) / delta + 4)
    expect((hue + 360) % 360).toBeGreaterThan(120)
    expect((hue + 360) % 360).toBeLessThan(180)
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

// The Owner's rule for the look: every surface is a photo-made swatch ("photo texture across the board, since that's our environment
// builder look"). A piece whose surface has no tile is drawn as one flat colour. What stays flat does so because it is light or glass:
// a photograph of those is their reflections, not their colour.
const FLAT_ON_PURPOSE = ['bulbWarm', 'glassNight', 'bottleClear', 'exit-green']

describe('the ward’s surfaces', () => {
  it('are all drawn from a photo-made tile, but the light and the glass', () => {
    const flat = new Map<string, number>()
    for (const piece of WORLD.pieces) {
      const surface = (piece as { surface?: string | { tile?: string } }).surface
      if (typeof surface !== 'string') continue
      if (PAINT.tiles(surface) === undefined) flat.set(surface, (flat.get(surface) ?? 0) + 1)
    }
    for (const name of FLAT_ON_PURPOSE) flat.delete(name)
    expect([...flat.entries()].sort(([a], [b]) => a.localeCompare(b))).toEqual([])
  })
})
