import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@mcthaydt/automata-editor-suite/core', () => {
  it('names the editor list and its format', () => {
    expect(core.EDITOR_LIST_PATH).toBe('content/editors.toml')
    expect(core.EDITOR_LIST_FORMAT).toBe('af-editors/1')
  })
})

describe('the entry', () => {
  it('exports the loader, the schema, the matcher and the policy', () => {
    expect(Object.keys(core).sort()).toEqual([
      'ALWAYS_NEVER',
      'CONTENT_CHECK',
      'EDITOR_LIST_FORMAT',
      'EDITOR_LIST_PATH',
      'editorListSchema',
      'fileAccess',
      'globMatch',
      'loadEditorList',
    ])
  })
})
