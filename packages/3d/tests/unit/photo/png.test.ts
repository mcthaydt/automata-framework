import { describe, expect, it } from 'vitest'
import { PHOTOS } from '#src/features/photo/photo-library.ts'
import { decodePng } from '#src/features/photo/png.ts'
import { photoBytes } from '#src/testing/photo-files.ts'

/** A PNG's pixel size, read from its header: width and height are the first two numbers of the IHDR chunk. */
function headerSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

describe('decodePng', () => {
  it('decodes a photo with the platform inflater', async () => {
    const bytes = photoBytes('asphalt')
    const image = await decodePng(bytes)
    expect([image.width, image.height]).toEqual(headerSize(bytes))
    expect(image.rgba).toHaveLength(image.width * image.height * 4)
  })

  it('decodes every photo in the library to its header size', async () => {
    for (const name of Object.keys(PHOTOS)) {
      const bytes = photoBytes(name)
      const image = await decodePng(bytes)
      expect([image.width, image.height], name).toEqual(headerSize(bytes))
    }
  })

  it('says what is wrong with bytes that are not a PNG', async () => {
    await expect(decodePng(Uint8Array.of(1, 2, 3))).rejects.toThrow('not a PNG')
  })
})
