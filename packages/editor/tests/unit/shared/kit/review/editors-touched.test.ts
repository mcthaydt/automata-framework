import { describe, expect, it } from 'vitest'
import { editorsTouched } from '#src/shared/kit/review/editors-touched.ts'

const row = (glob: string, editor: string) => ({ glob, editor })
const ROWS = [
  row('content/feel.toml', 'feel'),
  row('content/levels/*.af2d.json', 'levels-2d'),
  row('content/tuning.toml', 'tuner'),
]
const LABELS = { feel: 'Feel', 'levels-2d': 'Levels', tuner: 'Tuner' }

describe('the editors a change touches', () => {
  it('names each editor once, and a file-per-item editor with the file in brackets', () => {
    expect(editorsTouched(['content/feel.toml', 'content/levels/start.af2d.json'], ROWS, LABELS)).toEqual([
      'Feel',
      'Levels (Start)',
    ])
  })

  it('lists two files of one editor as two entries and the same file only once', () => {
    expect(
      editorsTouched(
        ['content/levels/start.af2d.json', 'content/levels/cave.af2d.json', 'content/levels/start.af2d.json'],
        ROWS,
        LABELS,
      ),
    ).toEqual(['Levels (Cave)', 'Levels (Start)'])
  })

  it('leaves out files no editor opens, and a change with only those touches none', () => {
    expect(editorsTouched(['src/main.ts', 'README.md'], ROWS, LABELS)).toEqual([])
  })

  it('falls back to the editor id, capitalised, when the editor is not installed', () => {
    expect(editorsTouched(['content/tuning.toml'], ROWS, {})).toEqual(['Tuner'])
  })
})

describe('a glob with a scene', () => {
  it('treats {scene} as one name, so one row covers every scene', () => {
    expect(
      editorsTouched(
        ['content/scenes/intro/dialogue.toml'],
        [row('content/scenes/{scene}/dialogue.toml', 'writer')],
        { writer: 'Writer' },
      ),
    ).toEqual(['Writer (Intro)'])
  })
})
