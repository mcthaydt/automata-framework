// Node's tiles against the recording the browsers are held to (tests/browser/parity/look/tiles-engines.test.ts). Run with
// UPDATE_TILE_HASHES=1 to record it again, only for a deliberate change to the photo pipeline.
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TexturedSwatch } from '#src/features/photo/swatch-tile.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { diskPhotoSources } from '#src/testing/photo-files.ts'
import { tileHashes } from '#src/testing/tile-hashes.ts'

const RECORDING = new URL('../../fixtures/tiles/label-hashes.json', import.meta.url)

describe('every textured swatch’s tile, in Node', () => {
  it('matches the recording', async () => {
    const hashes = await tileHashes(coreLibrary.swatches as Record<string, TexturedSwatch>, diskPhotoSources)
    if (process.env.UPDATE_TILE_HASHES === '1')
      writeFileSync(RECORDING, `${JSON.stringify(hashes, null, 1)}\n`)
    expect(Object.keys(hashes).length).toBeGreaterThan(60)
    expect(hashes).toEqual(JSON.parse(readFileSync(RECORDING, 'utf8')))
  }, 120_000)
})
