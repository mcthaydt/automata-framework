import type { WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { describe, expect, test } from 'vitest'
import { changedPaths, reopenedGates } from './reopened-gates'

const file = (path: string, gates: string[]): WorkspaceFile => ({
  path,
  editor: 'tuner',
  gates,
  checks: [],
  modes: ['edit'],
  writable: true,
})

const FILES = [
  file('content/tuning.toml', ['g-feel', 'g-speed']),
  file('content/feel/juice.toml', ['g-feel']),
  file('content/audio.toml', []),
]

describe('reopenedGates', () => {
  test('a gate is reopened by any written file whose row names it; ids sorted, each once', () => {
    expect(reopenedGates(FILES, ['content/feel/juice.toml'])).toEqual(['g-feel'])
    expect(reopenedGates(FILES, ['content/tuning.toml', 'content/feel/juice.toml'])).toEqual([
      'g-feel',
      'g-speed',
    ])
    expect(reopenedGates(FILES, ['content/audio.toml', 'content/unlisted.toml'])).toEqual([])
  })
})

describe('changedPaths', () => {
  test('a file is changed while its latest text differs from its text before the first write', () => {
    const writes = [
      { path: 'content/tuning.toml', before: 'a = 1\n', after: 'a = 2\n' },
      { path: 'content/feel/juice.toml', before: 'b = 1\n', after: 'b = 2\n' },
      { path: 'content/feel/juice.toml', before: 'b = 2\n', after: 'b = 1\n' },
    ]
    expect(changedPaths(writes)).toEqual(['content/tuning.toml'])
  })

  test('undoing every write to both files of a gate clears it (EDS-i)', () => {
    const writes = [
      { path: 'content/tuning.toml', before: 'a = 1\n', after: 'a = 2\n' },
      { path: 'content/feel/juice.toml', before: 'b = 1\n', after: 'b = 2\n' },
    ]
    expect(reopenedGates(FILES, changedPaths(writes))).toEqual(['g-feel', 'g-speed'])
    const undone = [...writes, { path: 'content/feel/juice.toml', before: 'b = 2\n', after: 'b = 1\n' }]
    expect(reopenedGates(FILES, changedPaths(undone))).toEqual(['g-feel', 'g-speed'])
    const both = [...undone, { path: 'content/tuning.toml', before: 'a = 2\n', after: 'a = 1\n' }]
    expect(reopenedGates(FILES, changedPaths(both))).toEqual([])
  })

  test('a created file stays changed until it is removed', () => {
    expect(changedPaths([{ path: 'content/new.toml', before: undefined, after: 'x = 1\n' }])).toEqual([
      'content/new.toml',
    ])
  })
})
