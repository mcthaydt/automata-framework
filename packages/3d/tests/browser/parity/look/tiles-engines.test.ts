// The photo pipeline makes the same tiles in every engine: each textured swatch's tile is made here, in the page, from the
// photo's bytes, and its labels must hash as the recording Node made (tests/unit/photo/tile-hashes.test.ts holds Node to
// the same file). A mismatch in one engine is a `Math` call that escaped `@automata/sim/math`, never a re-recording.
import { describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { PHOTOS, type PhotoSourceLoader, photoOf, photoSource } from '#src/features/photo/photo-library.ts'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import type { PhotoSource } from '#src/features/photo/tile.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { tileHashes } from '#src/testing/tile-hashes.ts'
import recorded from '../../../fixtures/tiles/label-hashes.json' with { type: 'json' }

const photoFile = (commands as unknown as { photoFile: (name: string) => Promise<string> }).photoFile

const prepared = new Map<string, Promise<PhotoSource>>()
const load: PhotoSourceLoader = (name, facetRadius, flat) => {
  const key = `${name}|${facetRadius}|${flat}`
  let hit = prepared.get(key)
  if (hit === undefined) {
    hit = photoFile(name).then((text) => {
      const raw = atob(text)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      return photoSource(bytes, photoOf(PHOTOS, name), facetRadius, flat)
    })
    prepared.set(key, hit)
  }
  return hit
}

describe('the photo pipeline in the page', () => {
  it('makes every textured swatch’s tile with the labels Node made', async () => {
    const hashes = await tileHashes(coreLibrary.swatches as Record<string, TexturedSwatch>, load)
    expect(Object.keys(hashes).length).toBe(Object.keys(recorded).length)
    expect(hashes).toEqual(recorded)
  }, 180_000)
})
