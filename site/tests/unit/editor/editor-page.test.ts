import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import EditorPage from '../../../src/features/editor/EditorPage.svelte'
import { EDITOR_COMMAND, PICTURES } from '../../../src/features/editor/editor-content'

const staticFile = (url: string) => resolve(process.cwd(), 'static', url.slice(1))

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
