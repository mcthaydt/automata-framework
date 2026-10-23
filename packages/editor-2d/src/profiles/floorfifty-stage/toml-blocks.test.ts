import { describe, expect, it } from 'vitest'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { type Block, findLine, joinLines, scanBlocks, splitLines } from './toml-blocks'

// The block engine's scan (EDFF.1a plan, decisions 3 and 6): a TOML text as its tables, each with the comment lines
// directly above its header, the line of its last content and the gap (blank lines and floating comments) after it.

const text = (...lines: string[]): string => `${lines.join('\n')}\n`
const scan = (source: string): readonly Block[] => scanBlocks(splitLines(source).lines)

describe('splitLines and joinLines', () => {
  it('splits on line breaks and remembers which ones, and whether the text ends with one', () => {
    expect(splitLines('a\nb\n')).toEqual({ lines: ['a', 'b'], newline: '\n', finalNewline: true })
    expect(splitLines('a\nb')).toEqual({ lines: ['a', 'b'], newline: '\n', finalNewline: false })
    expect(splitLines('a\r\nb\r\n')).toEqual({ lines: ['a', 'b'], newline: '\r\n', finalNewline: true })
    expect(splitLines('')).toEqual({ lines: [], newline: '\n', finalNewline: false })
  })

  it('joins them back to the same text', () => {
    for (const source of ['a\nb\n', 'a\nb', 'a\r\nb\r\n', '', '\n', 'a\n\n\n'])
      expect(joinLines(splitLines(source)), JSON.stringify(source)).toBe(source)
  })

  it('takes the first line break as the text’s style', () => {
    expect(splitLines('a\r\nb\nc\n').newline).toBe('\r\n')
  })
})

describe('scanBlocks', () => {
  it('finds each table with its header line and name', () => {
    const blocks = scan(
      text('a = 1', '', '[one]', 'x = 1', '', '[[two.three]]', 'y = 2', '[[two.three]]', 'y = 3'),
    )
    expect(blocks.map((b) => [b.name, b.array, b.header])).toEqual([
      ['one', false, 2],
      ['two.three', true, 5],
      ['two.three', true, 7],
    ])
  })

  it('takes the comment lines directly above a header as its own, and no more', () => {
    const blocks = scan(text('[a]', 'x = 1', '', '# floating', '', '# one', '# two', '[b]', 'y = 1'))
    expect(blocks[1]).toMatchObject({ name: 'b', start: 5, header: 7 })
    expect(blocks[0]).toMatchObject({ name: 'a', start: 0, header: 0, last: 1, end: 5 })
  })

  it('takes comments from the very first line of the text', () => {
    const [a] = scan(text('# top', '# of the file', '[a]'))
    expect(a).toMatchObject({ start: 0, header: 2 })
  })

  it('has no leading comments when a blank line stands between them and the header', () => {
    const [, b] = scan(text('[a]', 'x = 1', '# apart', '', '[b]', 'y = 1'))
    expect(b).toMatchObject({ start: 4, header: 4 })
  })

  it('ends a table’s content at its last key line, leaving blank lines and floating comments as its gap', () => {
    const [a] = scan(text('[a]', 'x = 1', '# inside', 'y = 2', '', '# floating', '', '[b]'))
    expect(a).toMatchObject({ header: 0, last: 3, end: 7 })
  })

  it('counts a header alone as its own content', () => {
    const [a] = scan(text('[a]', '', '[b]'))
    expect(a).toMatchObject({ header: 0, last: 0, end: 2 })
  })

  it('gives the last table an end at the last line', () => {
    const [a] = scan(text('[a]', 'x = 1', ''))
    expect(a?.end).toBe(splitLines(text('[a]', 'x = 1', '')).lines.length)
  })

  it('finds no table in a text without headers', () => {
    expect(scan(text('# only', 'a = 1'))).toEqual([])
    expect(scan('')).toEqual([])
  })

  it('does not take a header inside a comment, a string or an array for a table', () => {
    const blocks = scan(
      text(
        '# [not.a.table]',
        'a = 1',
        'multi = """',
        '[inside.string]',
        '"""',
        'list = [',
        '  [1, 2],',
        ']',
        "tail = '''",
        '[[also.string]]',
        "'''",
        '[real]',
      ),
    )
    expect(blocks.map((b) => b.name)).toEqual(['real'])
  })

  it('does not take a one-line triple-quoted string for the start of a multi-line one', () => {
    const blocks = scan(text('a = """one line"""', "b = '''and another'''", '[real]'))
    expect(blocks.map((b) => b.name)).toEqual(['real'])
  })

  it('reads a header with spaces, quotes and a trailing comment', () => {
    const blocks = scan(text('[ a . "b c" ] # note', '[[ d ]]'))
    expect(blocks.map((b) => [b.name, b.array])).toEqual([
      ['a."b c"', false],
      ['d', true],
    ])
  })

  it('scans a CRLF text like an LF one', () => {
    const lf = text('# lead', '[a]', 'x = 1', '', '[b]')
    expect(scanBlocks(splitLines(lf.replaceAll('\n', '\r\n')).lines)).toEqual(scan(lf))
  })
})

describe('scanBlocks on the shipped stages', () => {
  const counts = (id: (typeof SHIPPED_STAGE_IDS)[number]) => {
    const names: Record<string, number> = {}
    for (const block of scan(shippedStage(id))) names[block.name] = (names[block.name] ?? 0) + 1
    return names
  }

  it('finds the tables the survey of spec §10.2 lists for rooftops', () => {
    expect(counts('rooftops')).toEqual({
      courseTuning: 1,
      course: 1,
      'course.phrases': 4,
      'course.extension': 3,
      theme: 1,
      'theme.layers': 12,
      'theme.presentation': 1,
      'theme.presentation.citySink': 1,
      'theme.setPieces': 6,
    })
  })

  it.each(SHIPPED_STAGE_IDS)('finds as many headers in %s as there are header lines', (id) => {
    const source = shippedStage(id)
    const headers = source.split('\n').filter((line) => /^\[/.test(line)).length
    expect(scan(source)).toHaveLength(headers)
  })

  it.each(SHIPPED_STAGE_IDS)('covers %s without overlap: each table ends where the next one starts', (id) => {
    const source = shippedStage(id)
    const { lines } = splitLines(source)
    const blocks = scan(source)
    blocks.forEach((block, i) => {
      expect(block.start).toBeLessThanOrEqual(block.header)
      expect(block.header).toBeLessThanOrEqual(block.last)
      expect(block.last).toBeLessThan(block.end)
      expect(block.end).toBe(blocks[i + 1]?.start ?? lines.length)
    })
  })

  it('gives the sunrise comment of dawn to nobody: it is apart from its table by a blank line', () => {
    const { lines } = splitLines(shippedStage('dawn'))
    const first = scan(shippedStage('dawn')).find((b) => b.name === 'theme.setPieces')
    expect(first).toBeDefined()
    expect(lines[(first?.start ?? 0) - 1]).toBe('')
    expect(first?.start).toBe(first?.header)
  })

  it('gives rooftops’ comment above its presentation table to that table', () => {
    const { lines } = splitLines(shippedStage('rooftops'))
    const presentation = scan(shippedStage('rooftops')).find((b) => b.name === 'theme.presentation')
    expect(lines[presentation?.start ?? 0]).toBe(
      '# Cosmetic only, and that is the point of the table: these reach',
    )
    expect(presentation ? presentation.header - presentation.start : 0).toBe(8)
  })
})

describe('findLine', () => {
  const source = text(
    'id = "x"',
    'displayName = "X"',
    '',
    '[course]',
    'seed = 1',
    '',
    '[[course.phrases]]',
    'name = "teach"',
    '',
    '[[course.phrases]]',
    'name = "combine"',
    'fromFloor = 6',
    '',
    '[theme.presentation.citySink]',
    'teach = 0',
  )
  const find = (...path: (string | number)[]) => {
    const { lines } = splitLines(source)
    return findLine(lines, scanBlocks(lines), path)
  }

  it('finds a root key', () => {
    expect(find('displayName')).toBe(2)
    expect(find('id')).toBe(1)
  })

  it('does not look for a root key inside a table', () => {
    expect(find('seed')).toBe(1)
  })

  it('finds a key written in quotes, and does not read a dot in a key as any character', () => {
    const quoted = text('"axb" = 2', '"a.b" = 1')
    const { lines } = splitLines(quoted)
    expect(findLine(lines, scanBlocks(lines), ['a.b'])).toBe(2)
  })

  it('finds a key of a table', () => {
    expect(find('course', 'seed')).toBe(5)
  })

  it('finds a key of the n-th element of an array of tables', () => {
    expect(find('course', 'phrases', 1, 'fromFloor')).toBe(12)
    expect(find('course', 'phrases', 0, 'name')).toBe(8)
  })

  it('finds a key of a nested table', () => {
    expect(find('theme', 'presentation', 'citySink', 'teach')).toBe(15)
  })

  it('points at the header of the nearest table that exists when the key is missing', () => {
    expect(find('course', 'phrases', 0, 'purpose')).toBe(7)
    expect(find('course', 'extension')).toBe(4)
    expect(find('course', 'phrases', 7, 'name')).toBe(4)
  })

  it('points at the first line when nothing is there', () => {
    expect(find('theme', 'layers', 0, 'alias')).toBe(1)
    expect(find()).toBe(1)
  })

  it('stops at a value that is not a table and points at its key', () => {
    expect(find('course', 'seed', 'deeper')).toBe(5)
  })
})
