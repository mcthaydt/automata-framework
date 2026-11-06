import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@mcthaydt/automata-editor-suite/core', () => {
  it('names the editor list and its format', () => {
    expect(core.EDITOR_LIST_PATH).toBe('content/editors.toml')
    expect(core.EDITOR_LIST_FORMAT).toBe('af-editors/1')
  })
})

describe('the entry', () => {
  it('exports the loader, the schema, the matcher, the policy, the journal schema, the interchange, the review model and the ship draft', () => {
    expect(Object.keys(core).sort()).toEqual([
      'ALWAYS_NEVER',
      'CHANGE_SET_JOURNAL_FORMAT',
      'CONTENT_CHECK',
      'EDITOR_LIST_FORMAT',
      'EDITOR_LIST_PATH',
      'INTERCHANGE_FORMAT',
      'INTERCHANGE_VERSION',
      'applyImport',
      'changeSetJournalSchema',
      'draftShip',
      'editorListSchema',
      'exportInterchange',
      'fileAccess',
      'globMatch',
      'interchangeSchema',
      'loadEditorList',
      'planImport',
      'reviewModel',
      'workspaceFile',
    ])
  })
})
