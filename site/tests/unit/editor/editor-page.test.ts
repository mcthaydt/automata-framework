import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import EditorPage from '../../../src/features/editor/EditorPage.svelte'
import { EDITOR_COMMAND, EDITOR_PLAY_NOTE, PICTURES } from '../../../src/features/editor/editor-content'
import { PICTURES as TAKEN } from '../../../src/shared/pictures'

const staticFile = (url: string) => resolve(process.cwd(), 'static', url.slice(1))

/** A JPEG's size, read from its first start-of-frame marker. */
function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path)
  let at = 2
  while (at < bytes.length) {
    const marker = bytes[at + 1]
    if (marker >= 0xc0 && marker <= 0xc3)
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) }
    at += 2 + bytes.readUInt16BE(at + 2)
  }
  throw new Error(`${path} has no frame`)
}

// Spec 10.2 (Editor): what the editor does in three pictures, and "Try the editor", which opens the page
// `automata editor` serves a 2D game, on a sample game kept in this browser's storage.
describe('/editor', () => {
  it('shows what the editor does in three pictures, each one a real file with words for it', () => {
    const view = render(EditorPage)
    expect(view.container.querySelectorAll('figure')).toHaveLength(3)
    expect(PICTURES).toHaveLength(3)
    for (const picture of PICTURES) {
      expect(existsSync(staticFile(picture.src)), picture.src).toBe(true)
      expect(view.getByAltText(picture.alt)).toBeTruthy()
      expect(view.getByText(picture.caption)).toBeTruthy()
    }
  })

  it('gives each picture the size of the file the script took, and shows no picture of a view this editor does not have', () => {
    for (const picture of PICTURES) {
      const taken = TAKEN.find((candidate) => `/previews/${candidate.name}.jpg` === picture.src)
      expect(taken, picture.src).toBeDefined()
      expect({ width: picture.width, height: picture.height }, picture.src).toEqual(
        jpegSize(staticFile(picture.src)),
      )
    }
    for (const picture of TAKEN) expect(picture.name, 'the try-it editor has no Map tab').not.toMatch(/map/)
    expect(TAKEN.map((picture) => picture.name)).not.toContain('double-jump')
  })

  it('says, once, that a level is played in the editor on your own game', () => {
    const text = render(EditorPage).container.textContent ?? ''
    expect(text).toContain(EDITOR_PLAY_NOTE)
    expect(text).toContain(EDITOR_COMMAND)
  })

  it('opens the try-it editor, says where it keeps levels, and how to open it on a game', () => {
    const view = render(EditorPage)
    expect(view.getByRole('link', { name: 'Try the editor' }).getAttribute('href')).toBe('/editor/app/')
    expect(view.container.textContent).toContain('keeps your levels in this browser')
    expect(EDITOR_COMMAND).toBe('pnpm exec automata editor')
    expect(view.getByText(EDITOR_COMMAND)).toBeTruthy()
  })

  it('promises no Save button: the editor writes each change as it is made, and the try-it keeps it with Share', () => {
    const text = render(EditorPage).container.textContent ?? ''
    expect(text).not.toContain('press Save')
    expect(text).not.toContain('Save writes')
    expect(text).toContain('Share')
  })

  it('names no editor the 2D release does not ship', () => {
    const text = render(EditorPage).container.textContent ?? ''
    for (const later of ['Levels 3D', 'Studio', 'Feel', 'Writer', 'Schematic', 'Sequence', 'Plus'])
      expect(text, later).not.toContain(later)
  })
})
