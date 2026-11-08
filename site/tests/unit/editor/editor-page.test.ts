import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import EditorPage from '../../../src/features/editor/EditorPage.svelte'
import { EDITOR_COMMAND, PICTURES } from '../../../src/features/editor/editor-content'

const staticFile = (url: string) => resolve(process.cwd(), 'static', url.slice(1))

// Spec 10.2 (Editor): what the editors do in three pictures, and "Try the editor", which opens the page `automata
// editor` serves every game (every editor, 2D and 3D), on a sample game kept in this browser's storage.
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

  it('opens the try-it editors, says where they keep your work, and how to open it on a game', () => {
    const view = render(EditorPage)
    expect(view.getByRole('link', { name: 'Open the editors' }).getAttribute('href')).toBe('/editor/app/')
    expect(view.container.textContent).toContain('saved in this browser')
    expect(view.container.textContent).not.toContain('gone when you close')
    expect(EDITOR_COMMAND).toBe('pnpm exec automata editor')
    expect(view.getByText(EDITOR_COMMAND)).toBeTruthy()
  })

  it('promises no Save button: the editor writes each change as it is made, and the try-it keeps it with Share', () => {
    const text = render(EditorPage).container.textContent ?? ''
    expect(text).not.toContain('press Save')
    expect(text).not.toContain('Save writes')
    expect(text).toContain('Share')
  })

  it('names every editor and says they are all free on the web, with none held back', () => {
    const text = render(EditorPage).container.textContent ?? ''
    for (const editor of [
      'Levels',
      'Characters',
      'Tuner',
      'Feel',
      'Audio',
      'Writer',
      'Sequence',
      'Schematic',
    ])
      expect(text, editor).toContain(editor)
    expect(text).toContain('free on the web')
    for (const held of ['Plus', 'not in this release', 'coming soon', 'Not in this build'])
      expect(text, held).not.toContain(held)
  })
})
