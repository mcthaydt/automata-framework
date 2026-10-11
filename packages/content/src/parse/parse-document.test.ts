import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { formatDiagnostic } from '../diagnostics/diagnostic'
import { parseDocument } from './parse-document'

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
