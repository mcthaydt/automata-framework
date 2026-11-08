import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '@automata/editor/editor-list'
import { describe, expect, it } from 'vitest'
import { contentEditors } from '#src/app/suite/content-editors.ts'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'

describe('contentEditors', () => {
  it('are the content editors, each once, in the rail order', () => {
    const ids = contentEditors().map((editor) => editor.id)
    expect(ids).toEqual(['feel', 'writer'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the sample game', () => {
  it('has an editor list with no problems', () => {
    expect(loadEditorList(CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH]).ok).toBe(true)
  })

  it("routes each content file to its editor, and keeps the core editors' files", () => {
    const load = loadEditorList(CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH])
    if (!load.ok) throw new Error('the list did not load')
    const editorOf = (path: string) => workspaceFile(load.list, path).editor
    expect(editorOf('content/feel/feel.toml')).toBe('feel')
    expect(editorOf('content/lines/shop.toml')).toBe('writer')
    expect(editorOf('content/dialogue/shop.toml')).toBe('writer')
    expect(editorOf('content/tuning.toml')).toBe('tuner')
    for (const path of Object.keys(CONTENT_SAMPLE_GAME))
      if (path !== EDITOR_LIST_PATH) expect(editorOf(path), path).toBeDefined()
  })
})
