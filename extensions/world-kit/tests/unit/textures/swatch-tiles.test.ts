import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PHOTO_DIR, photoBytes, photoHash, readPhotoLibrary } from '#src/features/textures/photos.ts'
import {
  decodeTileFile,
  encodeLabels,
  ladderOf,
  staleTiles,
  type TexturedSwatch,
  textureOf,
  tileFileOf,
} from '#src/features/textures/swatch-tiles.ts'
import { readKitSwatches, readTiles, TILE_DIR } from '#src/features/textures/textures-command.ts'
import { tileColours } from '#src/features/textures/tile.ts'

const photos = readPhotoLibrary()
const swatches = readKitSwatches()
const textured = Object.entries(swatches).filter(([, s]) => textureOf(s) !== undefined)

describe('the photo library', () => {
  it('names every photo’s source, licence and credit, and its file is there', () => {
    for (const [name, photo] of Object.entries(photos)) {
      expect(photo.licence, name).toBeTruthy()
      expect(photo.credit, name).toBeTruthy()
      expect(photo.source, name).toBeTruthy()
      expect(existsSync(new URL(photo.file, PHOTO_DIR)), name).toBe(true)
    }
  })

  it('has every photo a kit swatch is cut from', () => {
    for (const [name, swatch] of textured) expect(photos[textureOf(swatch)?.photo ?? ''], name).toBeDefined()
  })
})

describe('the committed tiles', () => {
  const tiles = readTiles(TILE_DIR)

  it('are all current: one for each textured swatch, each stamped with its photo’s sha-256', () => {
    expect(staleTiles(tiles, swatches, photos)).toEqual([])
    expect(Object.keys(tiles).sort()).toEqual(textured.map(([name]) => name).sort())
  })

  it('make the tile the pipeline makes now, byte for byte', () => {
    for (const [name, swatch] of textured) expect(tiles[name], name).toEqual(tileFileOf(name, swatch, photos))
  })

  it('every texel of every tile is a DUEL colour on its swatch’s ladder', () => {
    for (const [name, swatch] of textured) {
      const tile = decodeTileFile(tiles[name] as never)
      const colours = tileColours(tile, ladderOf(swatch, swatches))
      expect(colours.length, name).toBe(tile.width * tile.height)
      expect(
        [...colours].every((i) => i < 256),
        name,
      ).toBe(true)
    }
  })
})

describe('a tile older than its photo', () => {
  const [name, swatch] = textured[0] as [string, TexturedSwatch]
  const fresh = tileFileOf(name, swatch, photos)
  const find = (tiles: Record<string, typeof fresh>, s = { [name]: swatch }) => staleTiles(tiles, s, photos)

  it('is current when its photo’s hash is the one it holds', () => {
    expect(fresh.sha256).toBe(photoHash(photoBytes(photos[textureOf(swatch)?.photo ?? ''] as never)))
    expect(find({ [name]: fresh })).toEqual([])
  })

  it('is told, in words that say what to run, when the photo has changed since', () => {
    const [problem] = find({ [name]: { ...fresh, sha256: '0'.repeat(64) } })
    expect(problem).toMatchObject({ code: 'stale-tile', swatch: name })
    expect(problem?.message).toBe(
      `The texture of "${name}" is older than its photo. Run automata-world-textures to update it.`,
    )
  })

  it('is told when the swatch’s knobs have changed since', () => {
    const changed = { ...swatch, texture: { ...swatch.texture, wear: 0.99 } }
    expect(find({ [name]: fresh }, { [name]: changed })[0]).toMatchObject({ code: 'stale-tile' })
  })

  it('a textured swatch with no tile, and a tile with no swatch, are told', () => {
    expect(find({})[0]).toMatchObject({ code: 'missing-tile', swatch: name })
    expect(find({ [name]: fresh, gone: { ...fresh, swatch: 'gone' } })[0]).toMatchObject({
      code: 'stray-tile',
      swatch: 'gone',
    })
  })
})

describe('tile labels', () => {
  it('round-trip through the file’s bytes, little endian', () => {
    const labels = Uint16Array.from([0, 1, 255, 256, 535])
    expect(encodeLabels(labels)).toBe(Buffer.from([0, 0, 1, 0, 255, 0, 0, 1, 23, 2]).toString('base64'))
    const file = {
      ...tileFileOf(...(textured[0] as [string, TexturedSwatch]), photos),
      labels: encodeLabels(labels),
      width: 5,
      height: 1,
    }
    expect([...decodeTileFile(file).labels]).toEqual([...labels])
  })
})
