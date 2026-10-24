import { describe, expect, it } from 'vitest'
import { type Block, scanBlocks } from './toml-blocks'
import { appendTable, insertAfter, insertBefore, removeTable, tableLines } from './toml-edit'

// The line operations of the block engine (EDFF.1a decision 3 and step 6). Texts are written as arrays of lines.

const text = (...lines: string[]): string[] => lines

/** The block called `name` (the `index`th of them) in `lines`. */
function block(lines: readonly string[], name: string, index = 0): Block {
  const found = scanBlocks(lines).filter((candidate) => candidate.name === name)[index]
  if (found === undefined) throw new Error(`no block ${name}`)
  return found
}

describe('tableLines', () => {
  it('takes the own comments, the keys and the comments among them, and not the gap', () => {
    const lines = text(
      'a = 1',
      '',
      '# about b',
      '# more',
      '[b]',
      'x = 1',
      '# inside',
      'y = 2',
      '',
      '# floats',
      '',
      '[c]',
    )
    expect(tableLines(lines, block(lines, 'b'))).toEqual(
      text('# about b', '# more', '[b]', 'x = 1', '# inside', 'y = 2'),
    )
  })
})

describe('removeTable', () => {
  it('removes a table in the middle with its own comments and the blank line after it', () => {
    const lines = text('a = 1', '', '# about b', '[b]', 'x = 1', '', '[c]', 'y = 2')
    expect(removeTable(lines, block(lines, 'b'))).toEqual(text('a = 1', '', '[c]', 'y = 2'))
  })

  it('leaves a comment that a blank line separates from the next table, with one blank line before it', () => {
    const lines = text('a = 1', '', '[b]', 'x = 1', '', '# floats', '', '[c]', 'y = 2')
    expect(removeTable(lines, block(lines, 'b'))).toEqual(text('a = 1', '', '# floats', '', '[c]', 'y = 2'))
  })

  it('leaves a floating comment that follows the table directly', () => {
    const lines = text('[b]', 'x = 1', '# floats', '', '[c]', 'y = 2')
    expect(removeTable(lines, block(lines, 'b'))).toEqual(text('# floats', '', '[c]', 'y = 2'))
  })

  it('removes the blank line before a table that is the last thing in the text', () => {
    const lines = text('[a]', 'x = 1', '', '# about b', '[b]', 'y = 2')
    expect(removeTable(lines, block(lines, 'b'))).toEqual(text('[a]', 'x = 1'))
  })

  it('removes the blank lines after the last table as well as the one before it', () => {
    const lines = text('[a]', 'x = 1', '', '[b]', 'y = 2', '', '')
    expect(removeTable(lines, block(lines, 'b'))).toEqual(text('[a]', 'x = 1'))
  })

  it('keeps the comments inside a table together with the table', () => {
    const lines = text('[a]', 'x = 1', '# inside', 'y = 2', '', '[b]', 'z = 3')
    expect(removeTable(lines, block(lines, 'a'))).toEqual(text('[b]', 'z = 3'))
  })

  it('removes the first table of a text that starts with it', () => {
    const lines = text('# about a', '[a]', 'x = 1', '', '[b]')
    expect(removeTable(lines, block(lines, 'a'))).toEqual(text('[b]'))
  })

  it('removes one element of an array of tables and no other', () => {
    const lines = text('[[l]]', 'n = 1', '', '# two', '[[l]]', 'n = 2', '', '[[l]]', 'n = 3')
    expect(removeTable(lines, block(lines, 'l', 1))).toEqual(text('[[l]]', 'n = 1', '', '[[l]]', 'n = 3'))
  })

  it('does not change its input', () => {
    const lines = text('[a]', 'x = 1', '', '[b]')
    removeTable(lines, block(lines, 'a'))
    expect(lines).toEqual(text('[a]', 'x = 1', '', '[b]'))
  })
})

describe('insertAfter', () => {
  it('puts the table after the last line of the block with a blank line between', () => {
    const lines = text('[a]', 'x = 1', '', '[c]', 'z = 3')
    expect(insertAfter(lines, block(lines, 'a'), ['[b]', 'y = 2'])).toEqual(
      text('[a]', 'x = 1', '', '[b]', 'y = 2', '', '[c]', 'z = 3'),
    )
  })

  it('puts it before a floating comment that follows the block, which then stays with the next table', () => {
    const lines = text('[a]', 'x = 1', '', '# about the rest', '', '[c]')
    expect(insertAfter(lines, block(lines, 'a'), ['[b]'])).toEqual(
      text('[a]', 'x = 1', '', '[b]', '', '# about the rest', '', '[c]'),
    )
  })

  it('appends to a text that ends with the block', () => {
    const lines = text('[a]', 'x = 1')
    expect(insertAfter(lines, block(lines, 'a'), ['[b]', 'y = 2'])).toEqual(
      text('[a]', 'x = 1', '', '[b]', 'y = 2'),
    )
  })
})

describe('insertBefore', () => {
  it('puts the table before the comments of the block with a blank line between', () => {
    const lines = text('[a]', 'x = 1', '', '# about c', '[c]', 'z = 3')
    expect(insertBefore(lines, block(lines, 'c'), ['[b]', 'y = 2'])).toEqual(
      text('[a]', 'x = 1', '', '[b]', 'y = 2', '', '# about c', '[c]', 'z = 3'),
    )
  })

  it('works at the start of the text', () => {
    const lines = text('[a]', 'x = 1')
    expect(insertBefore(lines, block(lines, 'a'), ['[z]'])).toEqual(text('[z]', '', '[a]', 'x = 1'))
  })
})

describe('appendTable', () => {
  it('adds the table after the last line with content, ahead of trailing blank lines', () => {
    expect(appendTable(text('a = 1', ''), ['[b]', 'y = 2'])).toEqual(text('a = 1', '', '[b]', 'y = 2', ''))
  })

  it('starts an empty text with the table', () => {
    expect(appendTable([], ['[b]'])).toEqual(text('[b]'))
  })
})
