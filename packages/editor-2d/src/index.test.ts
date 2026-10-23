import { describe, expect, it } from 'vitest'
import * as editor2d from './index'

describe('editor-2d entry', () => {
  it('exports the model, the working file API and the profile registry', () => {
    const functions = [
      editor2d.openProject,
      editor2d.printProject,
      editor2d.decodeProject,
      editor2d.encodeProject,
      editor2d.encodeRows,
      editor2d.decodeRows,
      editor2d.packTile,
      editor2d.unpackTile,
      editor2d.counterIds,
      editor2d.randomIds,
      editor2d.createProfileRegistry,
    ]
    for (const member of functions) expect(member).toBeTypeOf('function')
    expect(editor2d.Grid.empty(2, 2).cols).toBe(2)
    expect(editor2d.FILE_VERSION).toBe(1)
    for (const schema of [editor2d.projectFileSchema, editor2d.ruleSchema, editor2d.ruleGroupSchema]) {
      expect(schema.safeParse).toBeTypeOf('function')
    }
  })

  it('opens a project through nothing but the entry', () => {
    const file = {
      format: 'af2d',
      version: 1,
      name: 'Entry',
      template: 'blank',
      defs: { layers: [], tilesets: [], entities: [], levelFields: [] },
      worlds: [{ id: 'main', layout: 'free', placements: [] }],
      levels: [],
    }
    const result = editor2d.openProject(JSON.stringify(file))
    expect(result.status).toBe('opened')
    if (result.status === 'opened') expect(JSON.parse(editor2d.printProject(result.project))).toEqual(file)
  })
})
