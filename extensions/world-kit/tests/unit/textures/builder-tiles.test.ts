// The source's tiles golden, restated as a check on the kit's photo pipeline. The fixture is that golden's file at its last
// commit, unchanged: for each photo, the md5 of the tile the pipeline cuts at 32 texels a metre, wear 0.3, seed 1. The
// pipeline here was ported, not copied, so this is the one proof that it still makes the same tiles texel for texel.

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { photoBytes, readPhotoLibrary } from '#src/features/textures/photos.ts'
import type { TextureSpec } from '#src/features/textures/texture-spec.ts'
import { readKitSwatches } from '#src/features/textures/textures-command.ts'
import { type PhotoKnobs, photoToTile } from '#src/features/textures/tile.ts'
import { textureOf } from '#src/features/textures/tile-read.ts'
import golden from '../../fixtures/builder-tiles.json' with { type: 'json' }

const photos = readPhotoLibrary()
const swatches = Object.values(readKitSwatches())

/** The texture a swatch gives a photo, by the source's rule: the first swatch that names the photo and sets `contrast`,
 * else the first that names it. The `<photo>/swatch` key exists because a flat photo's tone tile at the default contrast
 * is one label (so five photos share one md5 and the key pins nothing but wear): the swatch's own knobs are what make
 * the tile worth pinning. */
function swatchTextureOf(photo: string): TextureSpec | undefined {
  const named = swatches.map(textureOf).filter((t): t is TextureSpec => t?.photo === photo)
  return named.find((t) => t.contrast !== undefined) ?? named[0]
}

/** What each frame draws, `<photo>/<mode>`: the tone and photo tiles of every photo, then its swatch tile where a swatch
 * names it. */
function specs(): Record<string, TextureSpec> {
  const out: Record<string, TextureSpec> = {}
  for (const photo of Object.keys(photos)) {
    for (const colour of ['tone', 'photo'] as const) out[`${photo}/${colour}`] = { photo, colour }
    const texture = swatchTextureOf(photo)
    if (texture !== undefined) out[`${photo}/swatch`] = texture
  }
  return out
}

/** The md5 of a tile's size and its labels' bytes. A label is never negative, so the source's `Int16Array` and the kit's
 * `Uint16Array` hold the same bytes. */
function md5Of(spec: TextureSpec): string {
  const photo = photos[spec.photo]
  if (photo === undefined) throw new Error(`No photo called ${spec.photo}.`)
  const { photo: _name, ...knobs } = spec
  const tile = photoToTile(photoBytes(photo), {
    ...knobs,
    wear: 0.3,
    seed: 1,
    size: photo.size,
    texels: [32, 32],
  } satisfies PhotoKnobs)
  expect(Math.min(...tile.labels), spec.photo).toBeGreaterThanOrEqual(0)
  const { buffer, byteOffset, byteLength } = tile.labels
  return createHash('md5')
    .update(`${tile.width}x${tile.height}`)
    .update(Buffer.from(buffer, byteOffset, byteLength))
    .digest('hex')
}

const made = specs()
const fixture = golden as Record<string, string>

// One test for each key, not one for all 112: the pipeline reads a photo each time, and a single test that ran it that
// often would sit past the default timeout, and a drifted tile would not say which one.
describe('the source’s tiles golden', () => {
  it('has the keys the kit’s photos and swatches make, and no others', () => {
    expect(Object.keys(made).sort()).toEqual(Object.keys(fixture).sort())
  })

  it.each(Object.entries(made))('%s: the pipeline cuts the tile the source cut, md5 for md5', (key, spec) => {
    expect(md5Of(spec)).toBe(fixture[key])
  })
})
