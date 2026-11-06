import { describe, expect, test } from 'vitest'
import { lineDiff, touchedLines } from '#src/features/suite/core/text-diff.ts'

const lines = (count: number, from = 1): string =>
  Array.from({ length: count }, (_, i) => `line ${i + from}\n`).join('')

describe('lineDiff: unified hunks over lines with three lines of context', () => {
  test('the same text has no hunks', () => {
    expect(lineDiff(lines(5), lines(5))).toEqual([])
    expect(lineDiff('', '')).toEqual([])
  })

  test('a changed line is one removal and one addition, with the context around it numbered on each side', () => {
    const after = lines(10).replace('line 5\n', 'line five\n')
    const [hunk, ...rest] = lineDiff(lines(10), after)
    expect(rest).toEqual([])
    expect(hunk).toMatchObject({ beforeStart: 2, beforeCount: 7, afterStart: 2, afterCount: 7 })
    expect(hunk?.lines.filter((line) => line.kind !== 'same')).toEqual([
      { kind: 'removed', text: 'line 5\n', before: 5 },
      { kind: 'added', text: 'line five\n', after: 5 },
    ])
    expect(hunk?.lines[0]).toEqual({ kind: 'same', text: 'line 2\n', before: 2, after: 2 })
  })

  test('an insertion numbers the lines after it one further on', () => {
    const after = `${lines(4)}new\n${lines(4, 5)}`
    const [hunk] = lineDiff(lines(8), after)
    expect(hunk?.lines.find((line) => line.kind === 'added')).toEqual({
      kind: 'added',
      text: 'new\n',
      after: 5,
    })
    expect(hunk?.lines.at(-1)).toEqual({ kind: 'same', text: 'line 7\n', before: 7, after: 8 })
  })

  test('a deletion, and edits far apart, give separate hunks', () => {
    const after = lines(20).replace('line 2\n', '').replace('line 18\n', 'eighteen\n')
    const hunks = lineDiff(lines(20), after)
    expect(hunks).toHaveLength(2)
    expect(hunks[0]?.lines.filter((line) => line.kind !== 'same')).toEqual([
      { kind: 'removed', text: 'line 2\n', before: 2 },
    ])
    expect(hunks[1]?.lines.filter((line) => line.kind === 'added')).toEqual([
      { kind: 'added', text: 'eighteen\n', after: 17 },
    ])
  })

  test('a created file is all additions; CRLF line ends and a missing last newline are kept', () => {
    expect(lineDiff('', 'a = 1\r\nb = 2')[0]?.lines).toEqual([
      { kind: 'added', text: 'a = 1\r\n', after: 1 },
      { kind: 'added', text: 'b = 2', after: 2 },
    ])
    expect(lineDiff('a = 1\r\n', 'a = 1\n')[0]?.lines).toEqual([
      { kind: 'removed', text: 'a = 1\r\n', before: 1 },
      { kind: 'added', text: 'a = 1\n', after: 1 },
    ])
  })
})

describe('touchedLines', () => {
  test('gives the added lines on the after side, in order', () => {
    const after = lines(20).replace('line 2\n', 'two\n').replace('line 18\n', 'eighteen\n')
    expect(touchedLines(lineDiff(lines(20), after))).toEqual([2, 18])
  })
})
