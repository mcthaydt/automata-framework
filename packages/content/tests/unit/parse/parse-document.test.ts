import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { formatDiagnostic } from '#src/diagnostics/diagnostic.ts'
import { contentHash } from '#src/hash/content-hash.ts'
import { parseDocument } from '#src/parse/parse-document.ts'

// Ported from FloorFifty tests/content/parse.test.ts (122a220): unknown keys, TOML syntax errors and the
// missing-versus-wrong distinction, now with positions.
const song = z.strictObject({
  displayName: z.string(),
  bpm: z.number().positive(),
  loop: z.optional(z.strictObject({ startMs: z.number(), endMs: z.number() })),
})
const file = 'content/songs/dusk-run.toml'
const valid = [
  'displayName = "Dusk Run"',
  'bpm = 120.0',
  '',
  '[loop]',
  'startMs = 0',
  'endMs = 96000',
  '',
].join('\n')
const lines = (text: string) => {
  const result = parseDocument({ file, text }, song)
  return result.ok ? [] : result.diagnostics.map(formatDiagnostic)
}

describe('parseDocument', () => {
  it('returns the validated value of a valid file', () => {
    const result = parseDocument({ file, text: valid }, song)
    expect(result.ok && result.value).toEqual({
      displayName: 'Dusk Run',
      bpm: 120,
      loop: { startMs: 0, endMs: 96000 },
    })
  })

  it('reports each unknown key at its own position', () => {
    expect(lines(`${valid}tempoDrift = 3\nswing = 1\n`)).toEqual([
      `${file}:7:1  loop.tempoDrift  unknownField: unknown field: tempoDrift`,
      `${file}:8:1  loop.swing  unknownField: unknown field: swing`,
    ])
  })

  it('tells a missing key from a wrong one', () => {
    expect(lines(valid.replace('displayName = "Dusk Run"\n', ''))).toEqual([
      `${file}:1:1  displayName  missingField: required`,
    ])
    expect(lines(valid.replace('bpm = 120.0', 'bpm = "fast"'))).toEqual([
      `${file}:2:1  bpm  invalidType: Invalid input: expected number, received string`,
    ])
  })

  it('reports every independent issue in one pass', () => {
    expect(
      lines(valid.replace('bpm = 120.0', 'bpm = -1').replace('endMs = 96000', 'endMs = "x"')),
    ).toHaveLength(2)
  })

  it('reports a TOML syntax error at its line and column', () => {
    expect(lines('displayName = "x"\nbpm = =')).toEqual([`${file}:2:7  invalidToml: invalid value`])
  })

  it('gives a value-level failure the line of its key', () => {
    expect(lines(valid.replace('startMs = 0', 'startMs = true'))).toEqual([
      `${file}:5:1  loop.startMs  invalidType: Invalid input: expected number, received boolean`,
    ])
  })
})

// Values TOML has and JSON does not. Audit of PR #8: `nan` used to crash the compiler, and dates were erased.
describe('TOML values without a JSON form', () => {
  const anything = z.record(z.string(), z.unknown())

  it('turns dates and times into canonical ISO strings', () => {
    const text = [
      'day = 2026-01-01',
      'clock = 07:32:00',
      'local = 1979-05-27T07:32:00',
      'offset = 1979-05-27 07:32:00.5-07:00',
      '[nested]',
      'at = [1979-05-27T07:32:00Z]',
    ].join('\n')
    const result = parseDocument({ file, text }, anything)
    expect(result.ok && result.value).toEqual({
      day: '2026-01-01',
      clock: '07:32:00.000',
      local: '1979-05-27T07:32:00.000',
      offset: '1979-05-27T07:32:00.500-07:00',
      nested: { at: ['1979-05-27T07:32:00.000Z'] },
    })
  })

  it('refuses nan and inf at their keys', () => {
    const result = parseDocument({ file, text: 'a = 1\nb = nan\n[c]\nd = [1, -inf]\n' }, anything)
    expect(result.ok ? [] : result.diagnostics.map(formatDiagnostic)).toEqual([
      'content/songs/dusk-run.toml:2:1  b  invalidType: b must be a finite number, received nan',
      'content/songs/dusk-run.toml:4:1  c.d.1  invalidType: c.d.1 must be a finite number, received -inf',
    ])
  })

  it('reads a multi-line string the same with CRLF and LF line endings', () => {
    const lf = 'text = """\nDusk\nRun"""\n'
    const crlf = lf.replaceAll('\n', '\r\n')
    const read = (text: string) => {
      const result = parseDocument({ file, text }, anything)
      return result.ok ? result.value : undefined
    }
    expect(read(crlf)).toEqual({ text: 'Dusk\nRun' })
    expect(read(crlf)).toEqual(read(lf))
  })

  // Audit of PR #8: `out[key] =` with the key `__proto__` set the object's prototype, so the key vanished from
  // the data and the hash without a word.
  it('refuses a __proto__ key at its position', () => {
    const result = parseDocument({ file, text: 'a = 1\n[b]\n"__proto__" = 2\n' }, anything)
    expect(result.ok ? [] : result.diagnostics.map(formatDiagnostic)).toEqual([
      "content/songs/dusk-run.toml:3:1  b.__proto__  reservedKey: __proto__ cannot be a key, because JavaScript reads it as the object's prototype; rename it",
    ])
  })

  it('keeps constructor and prototype keys as plain data', () => {
    const read = (text: string) => {
      const result = parseDocument({ file, text }, anything)
      if (!result.ok) throw new Error(result.diagnostics.map(formatDiagnostic).join('\n'))
      return result.value
    }
    const value = read('constructor = 1\nprototype = 2\n')
    expect(Object.keys(value)).toEqual(['constructor', 'prototype'])
    expect(value).toEqual({ constructor: 1, prototype: 2 })
    expect(contentHash(value)).not.toBe(contentHash(read('constructor = 3\nprototype = 2\n')))
  })
})
