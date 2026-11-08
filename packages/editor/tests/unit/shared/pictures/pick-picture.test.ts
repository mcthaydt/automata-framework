import { describe, expect, it } from 'vitest'
import type { WriteResult } from '#src/shared/kit/storage/project-store.ts'
import { pictureAsset, writePicture } from '#src/shared/pictures/pick-picture.ts'

// The one way a picture a person chose gets into the game folder: Add tiles and a character's animation both use it.

const bytes = new Uint8Array([1, 2, 3])

function folder(existing: string[], answer: WriteResult) {
  const writes: { path: string; mode: unknown }[] = []
  return {
    writes,
    store: {
      list: async () => existing.map((path) => ({ path, size: 1, mtime: 1 })),
      write: async (path: string, _body: unknown, mode: unknown) => {
        writes.push({ path, mode })
        return answer
      },
    },
  }
}

describe('pictureAsset', () => {
  it('names the file in kebab-case under assets/, and never over one that is there', () => {
    expect(pictureAsset('Hero Walk.PNG', [])).toBe('assets/hero-walk.png')
    expect(pictureAsset('hero.png', ['assets/hero.png'])).toBe('assets/hero-2.png')
  })
})

describe('writePicture', () => {
  it('writes the picture beside the others, as a new file, and says where', async () => {
    const { store, writes } = folder(['assets/hero.png'], { ok: true, mtime: 5 })
    expect(await writePicture(store, { name: 'hero.png', bytes })).toEqual({
      ok: true,
      path: 'assets/hero-2.png',
    })
    expect(writes).toEqual([{ path: 'assets/hero-2.png', mode: 'absent' }])
  })

  it('says in plain words when the game does not let the editor save pictures', async () => {
    const { store } = folder([], { ok: false, reason: 'policy', message: 'refused' })
    const result = await writePicture(store, { name: 'a.png', bytes })
    expect(result).toEqual({
      ok: false,
      message:
        'This game doesn’t let the editor save pictures yet. Ask whoever set the game up to allow pictures in its assets folder.',
    })
  })

  it('carries any other failure’s own sentence', async () => {
    const { store } = folder([], { ok: false, reason: 'quota', message: 'The disk is full.' })
    expect(await writePicture(store, { name: 'a.png', bytes })).toEqual({
      ok: false,
      message: 'Couldn’t add the picture. The disk is full.',
    })
  })
})
