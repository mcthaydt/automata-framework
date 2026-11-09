import { describe, expect, it } from 'vitest'
import { PHOTOS } from '#src/features/photo/photo-library.ts'
import { swatchIssues } from '#src/features/photo/swatch-issues.ts'
import { ladderOf, swatchTile, type TexturedSwatch, textureOf } from '#src/features/photo/swatch-tile.ts'
import { tileColours } from '#src/features/photo/tile.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { diskPhotoSources, photoBytes } from '#src/testing/photo-files.ts'

const swatches = coreLibrary.swatches as Record<string, TexturedSwatch>
const textured = Object.entries(swatches).filter(([, s]) => textureOf(s) !== undefined)

describe('the photo library', () => {
  it('names every photo’s source, licence and credit, and its file is there', () => {
    for (const [name, photo] of Object.entries(PHOTOS)) {
      expect(photo.licence, name).toBeTruthy()
      expect(photo.credit, name).toBeTruthy()
      expect(photo.source, name).toBeTruthy()
      expect(photoBytes(name).length, name).toBeGreaterThan(0)
    }
  })

  it('has every photo a swatch is cut from', () => {
    expect(textured.length).toBeGreaterThan(30)
    for (const [name, swatch] of textured) expect(PHOTOS[textureOf(swatch)?.photo ?? ''], name).toBeDefined()
  })
})

// One test for each swatch, not one for all of them: the pipeline runs over a photo each time, and a single test that
// ran it forty times would sit near the default timeout.
describe('every textured swatch, made from its photo at the scale it declares', () => {
  it.each(textured)(
    '%s passes the reads it declares, worn and bare',
    async (name, swatch) => {
      expect(await swatchIssues(swatch, diskPhotoSources), name).toEqual([])
    },
    30_000,
  )

  it.each(textured)(
    '%s is DUEL colours on its swatch’s ladder, whole',
    async (name, swatch) => {
      const tile = await swatchTile(swatch, diskPhotoSources)
      const colours = tileColours(tile, ladderOf(swatch, swatches))
      expect(colours.length, name).toBe(tile.width * tile.height)
      expect(
        [...colours].every((i) => i < 256),
        name,
      ).toBe(true)
    },
    30_000,
  )
})
