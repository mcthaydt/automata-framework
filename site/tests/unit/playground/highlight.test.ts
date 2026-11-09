// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { highlightLines } from '../../../src/features/playground/highlight'

const join = (lines: ReturnType<typeof highlightLines>) =>
  lines
    .flat()
    .map((piece) => piece.text)
    .join('')

describe('highlightLines', () => {
  const source = "import { run } from '@automataframework/automata'\n// a comment\nconst size: number = 42\n"

  it('keeps the source byte for byte, one entry per line, each line but the last carrying its newline', () => {
    const lines = highlightLines(source)
    expect(join(lines)).toBe(source)
    expect(lines).toHaveLength(4)
    expect(lines[0].at(-1)!.text.endsWith('\n')).toBe(true)
    expect(lines[3]).toEqual([])
  })

  it('marks keywords, strings, comments, numbers and types with the editor’s tok- classes', () => {
    const pieces = highlightLines(source).flat()
    const classOf = (text: string) => pieces.find((piece) => piece.text === text)?.className
    expect(classOf('import')).toContain('tok-keyword')
    expect(classOf("'@automataframework/automata'")).toContain('tok-string')
    expect(classOf('// a comment')).toContain('tok-comment')
    expect(classOf('42')).toContain('tok-number')
    expect(classOf('number')).toContain('tok-typeName')
  })

  it('splits a token that spans lines, so every line stands alone', () => {
    const lines = highlightLines('/* one\ntwo */\n')
    expect(lines[0]).toEqual([{ text: '/* one\n', className: 'tok-comment' }])
    expect(lines[1][0]).toEqual({ text: 'two */', className: 'tok-comment' })
  })
})
