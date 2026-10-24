import { describe, expect, it } from 'vitest'
import { diffLines, type LineDiff } from './diff-lines'

describe('diffLines', () => {
  it('finds nothing in equal texts', () => {
    expect(diffLines('a\nb\n', 'a\nb\n')).toEqual({ removed: [], added: [] })
  })

  it('reports a changed line as one removed and one added, with line numbers from 1', () => {
    expect(diffLines('a\nb\nc', 'a\nB\nc')).toEqual({
      removed: [{ line: 2, text: 'b' }],
      added: [{ line: 2, text: 'B' }],
    })
  })

  it('reports an inserted line and a deleted line', () => {
    expect(diffLines('a\nc', 'a\nb\nc')).toEqual({ removed: [], added: [{ line: 2, text: 'b' }] })
    expect(diffLines('a\nb\nc', 'a\nc')).toEqual({ removed: [{ line: 2, text: 'b' }], added: [] })
  })

  it('does not count line endings as a difference', () => {
    expect(diffLines('a\r\nb', 'a\nb')).toEqual({ removed: [], added: [] })
  })

  it('reports a moved block as the same lines removed in one place and added in another', () => {
    const diff = diffLines('x\n1\n2\ny', 'x\ny\n1\n2')
    const texts = (side: LineDiff['removed']) => side.map((entry) => entry.text).sort()
    expect(diff.removed.length).toBeGreaterThan(0)
    expect(texts(diff.removed)).toEqual(texts(diff.added))
  })
})
