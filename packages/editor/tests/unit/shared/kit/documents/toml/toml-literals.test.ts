// @vitest-environment node
import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import type { KeyPath } from '#src/shared/kit/documents/key-path.ts'
import { loadDocumentFixture } from '#src/shared/kit/documents/testing/fixtures.ts'
import { readTomlLiterals, type TomlLiterals } from '#src/shared/kit/documents/toml/toml-literals.ts'

const at = (read: TomlLiterals, keyPath: KeyPath) =>
  read.literals.find((literal) => JSON.stringify(literal.keyPath) === JSON.stringify(keyPath))

/** Every scalar of a parsed TOML value, with its key path, in key order (arrays in index order). */
function scalarPaths(value: unknown, path: KeyPath = []): KeyPath[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => scalarPaths(item, [...path, index]))
  if (value !== null && typeof value === 'object' && !(value instanceof Date))
    return Object.keys(value).flatMap((key) =>
      scalarPaths((value as Record<string, unknown>)[key], [...path, key]),
    )
  return [path]
}

const sorted = (paths: readonly KeyPath[]): string[] => paths.map((path) => JSON.stringify(path)).sort()

describe('readTomlLiterals', () => {
  it('finds root keys, dotted keys, tables, inline tables and inline arrays, each span slicing to its literal', () => {
    const text = [
      'name = "Cyan"',
      "path = 'C:\\games'",
      'a.b = 1_000',
      '',
      '[springs]',
      'squash = { f = 4, zeta = 0.35 }',
      'list = [1, 2.5, true]',
      '',
      '[burst.spawn]',
      'when = 1979-05-27',
      '',
    ].join('\n')
    const read = readTomlLiterals(text)
    expect(read.literals.map((literal) => [literal.keyPath, literal.text])).toEqual([
      [['name'], '"Cyan"'],
      [['path'], "'C:\\games'"],
      [['a', 'b'], '1_000'],
      [['springs', 'squash', 'f'], '4'],
      [['springs', 'squash', 'zeta'], '0.35'],
      [['springs', 'list', 0], '1'],
      [['springs', 'list', 1], '2.5'],
      [['springs', 'list', 2], 'true'],
      [['burst', 'spawn', 'when'], '1979-05-27'],
    ])
    for (const literal of read.literals) expect(text.slice(...literal.span)).toBe(literal.text)
  })

  it('indexes an array of tables, and a table under its last element', () => {
    const text =
      '[[rooms]]\nid = "a"\n\n[[rooms]]\nid = "b"\n\n[rooms.light]\nlevel = 2\n\n[[rooms.doors]]\nto = "c"\n'
    const read = readTomlLiterals(text)
    expect(read.literals.map((literal) => literal.keyPath)).toEqual([
      ['rooms', 0, 'id'],
      ['rooms', 1, 'id'],
      ['rooms', 1, 'light', 'level'],
      ['rooms', 1, 'doors', 0, 'to'],
    ])
    expect(sorted(read.literals.map((literal) => literal.keyPath))).toEqual(sorted(scalarPaths(parse(text))))
  })

  it('spans multi-line strings, CRLF line endings and text outside the BMP', () => {
    const text = 'a = """\nfirst\nsecond"""\r\nb = "é😀"\r\nc = 3\r\n'
    const read = readTomlLiterals(text)
    expect(at(read, ['a'])?.text).toBe('"""\nfirst\nsecond"""')
    expect(at(read, ['b'])?.text).toBe('"é😀"')
    expect(at(read, ['c'])?.span).toEqual([text.indexOf('3'), text.indexOf('3') + 1])
    for (const literal of read.literals) expect(text.slice(...literal.span)).toBe(literal.text)
  })

  it('gives a key the run of whole-line comments right above it and the comment after it on its line', () => {
    const text = [
      '# The file.',
      '',
      '# Floors in one ascent,',
      '#   including the first.',
      'COUNT = 20 # floors',
      'WIDTH = 120',
      '',
      '# Not attached: a blank line follows.',
      '',
      'HEIGHT = 20',
      '# springs: how fast they answer',
      '[springs]',
      'squash = { f = 4 }   # the landing',
    ].join('\n')
    const read = readTomlLiterals(text)
    expect(read.comments(['COUNT'])).toEqual({
      before: 'Floors in one ascent,\n  including the first.',
      trailing: 'floors',
    })
    expect(read.comments(['WIDTH'])).toEqual({})
    expect(read.comments(['HEIGHT'])).toEqual({})
    expect(read.comments(['springs'])).toEqual({ before: 'springs: how fast they answer' })
    expect(read.comments(['springs', 'squash'])).toEqual({ trailing: 'the landing' })
    expect(read.comments(['missing'])).toEqual({})
  })

  for (const name of [
    'floorfifty-tuning.toml',
    'floorfifty-juice.toml',
    'af-game.toml',
    'af-flow.toml',
    'af-stage-dawn.toml',
    'af-character-cyan.toml',
  ] as const) {
    it(`${name}: finds the literal of every value, each span slicing to it`, () => {
      const text = loadDocumentFixture(name)
      const read = readTomlLiterals(text)
      expect(sorted(read.literals.map((literal) => literal.keyPath))).toEqual(
        sorted(scalarPaths(parse(text))),
      )
      for (const literal of read.literals) expect(text.slice(...literal.span)).toBe(literal.text)
    })
  }

  it("floorfifty-tuning.toml and juice.toml: the Tuner's notes come from the comments", () => {
    const tuning = readTomlLiterals(loadDocumentFixture('floorfifty-tuning.toml'))
    expect(tuning.comments(['COURSE_FLOOR_COUNT'])).toEqual({
      before: 'Floors in one ascent, including the fixed starting floor.',
    })
    expect(tuning.comments(['BOUNCE_VELOCITY']).before).toBe(
      'Applied on contact with any face of a floor, not only from above.',
    )
    const juice = readTomlLiterals(loadDocumentFixture('floorfifty-juice.toml'))
    expect(juice.comments(['lean', 'fullSpeed'])).toEqual({ trailing: "MAX_MOVE_SPEED's default" })
  })
})
