import { describe, expect, it } from 'vitest'
import { type Diagnostic, formatDiagnostic, sortDiagnostics } from '#src/diagnostics/diagnostic.ts'

// Ported from FloorFifty tests/content/parse.test.ts "diagnostics" (122a220), with a position added.
describe('formatDiagnostic', () => {
  it('names the file, line, column, key and stable code', () => {
    expect(
      formatDiagnostic({
        code: 'outOfRange',
        file: 'content/tuning.toml',
        line: 12,
        column: 1,
        keyPath: 'GRAVITY',
        message: 'expected -1200..-100, received -2000',
      }),
    ).toBe('content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000')
  })

  it('leaves the key out for a whole-file problem', () => {
    expect(
      formatDiagnostic({
        code: 'missingField',
        file: 'content/flow.toml',
        line: 1,
        column: 1,
        keyPath: '',
        message: 'this file is required and could not be read',
      }),
    ).toBe('content/flow.toml:1:1  missingField: this file is required and could not be read')
  })
})

describe('sortDiagnostics', () => {
  const at = (file: string, line: number, column: number, keyPath = 'k'): Diagnostic => ({
    code: 'invalidType',
    file,
    line,
    column,
    keyPath,
    message: 'm',
  })

  it('orders by file, then line, then column, then key', () => {
    const sorted = sortDiagnostics([
      at('b', 1, 1),
      at('a', 9, 1),
      at('a', 2, 5),
      at('a', 2, 3, 'z'),
      at('a', 2, 3, 'y'),
    ])
    expect(sorted.map((d) => `${d.file}:${d.line}:${d.column}:${d.keyPath}`)).toEqual([
      'a:2:3:y',
      'a:2:3:z',
      'a:2:5:k',
      'a:9:1:k',
      'b:1:1:k',
    ])
  })

  it('compares line numbers as numbers', () => {
    expect(sortDiagnostics([at('a', 10, 1), at('a', 9, 1)]).map((d) => d.line)).toEqual([9, 10])
  })
})
