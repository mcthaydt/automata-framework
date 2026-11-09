// The `beats` and `help` content kinds: the converted scenes' beats and puzzle help parse, and each bad
// reference is reported at its path, so the content compiler names the file and line.
import { describe, expect, it } from 'vitest'
import { beatsFileSchema, helpFileSchema } from '#src/entries/tools.ts'
import { fixture, SCENES } from '#src/testing/converted-narrative.ts'

const paths = (
  schema: { safeParse(x: unknown): { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } },
  value: unknown,
) => {
  const r = schema.safeParse(value)
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.path)
}

describe('the converted scenes', () => {
  it('parse: beats and puzzle help', () => {
    for (const scene of SCENES) {
      expect(paths(beatsFileSchema, fixture(`${scene}.beats.toml`)), `${scene} beats`).toEqual([])
      expect(paths(helpFileSchema, fixture(`${scene}.help.toml`)), `${scene} help`).toEqual([])
    }
  })
})

describe('bad beats, at their path', () => {
  const beat = { id: 'a', learn: 'x', required: true, deliveredBy: ['l'] }
  it('a beat listed twice, and an `after` naming no beat', () => {
    expect(paths(beatsFileSchema, { beats: [beat, beat] })).toEqual([['beats', 1, 'id']])
    expect(paths(beatsFileSchema, { beats: [{ ...beat, after: ['nope'] }] })).toEqual([
      ['beats', 0, 'after', 0],
    ])
  })
})

describe('bad help, at its path', () => {
  const clue = { line: 'l', at: 'hotspot' }
  const ladder = { id: 'p', puzzle: 'x', levels: [clue, clue, clue] }
  it('a ladder listed twice, and a deduction for a ladder that is not there', () => {
    expect(paths(helpFileSchema, { hints: [ladder, ladder], deductions: [] })).toEqual([['hints', 1, 'id']])
    expect(
      paths(helpFileSchema, {
        hints: [ladder],
        deductions: [{ id: 'd', learn: 'x', for: ['q'], clues: [clue] }],
      }),
    ).toEqual([['deductions', 0, 'for', 0]])
  })
})
