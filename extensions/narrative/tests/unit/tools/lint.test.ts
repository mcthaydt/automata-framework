// `lintNarrative`: the original's lint cases, re-pointed at the locale's text. Line length is
// checked only with a game's `measure` and box, so the pipeline's lint, which has none, never reports it.
import { describe, expect, it } from 'vitest'
import type { Canon, LineRecord } from '#src/entries/sim.ts'
import { lintNarrative, properNouns, wrap } from '#src/features/tools/lint.ts'
import type { Beat } from '#src/shared/beats.schema.ts'
import { fixture, SCENES } from '#src/testing/converted-narrative.ts'

const canon = fixture('canon.toml') as unknown as Canon
const textOf = (scene: string) => fixture(`${scene}.locale.toml`) as Record<string, string>
const recordsOf = (scene: string) => (fixture(`${scene}.lines.toml`) as { lines: LineRecord[] }).lines
const beatsOf = (scene: string) => (fixture(`${scene}.beats.toml`) as { beats: Beat[] }).beats

/** Eight pixels a character: enough to tell a long line from a short one. */
const measure = (text: string) => text.length * 8
const box = { width: 400, font: '17px Georgia, serif', lines: 5 }

const seeded = (
  text: string,
  extra: Partial<LineRecord> = {},
): { records: LineRecord[]; text: Record<string, string> } => {
  const id = extra.id ?? 'toy.line'
  return { records: [{ id, kind: 'examine', speaker: 'ada', text: id, ...extra }], text: { [id]: text } }
}
const rules = (
  lines: { records: LineRecord[]; text: Record<string, string> },
  more: Partial<Parameters<typeof lintNarrative>[0]> = {},
) => lintNarrative({ canon, ...lines, ...more }).map((f) => f.rule)

describe('the converted scenes', () => {
  it('pass on canon, tone, nouns, duplicates and beats', () => {
    for (const scene of SCENES)
      expect(
        lintNarrative({ canon, records: recordsOf(scene), text: textOf(scene), beats: beatsOf(scene) }),
        scene,
      ).toEqual([])
  })
})

describe('lintNarrative', () => {
  it('catches a time that is not canon', () => {
    expect(rules(seeded('The clock says 05:30.'))).toEqual(['time'])
  })
  it('catches a banned word', () => {
    expect(rules(seeded('There is blood on the sheets.'))).toEqual(['tone'])
  })
  it('catches an exclamation mark', () => {
    expect(rules(seeded('Run!'))).toEqual(['exclamation'])
  })
  it('catches a fact that does not exist', () => {
    expect(rules(seeded('The clock stopped.', { facts: ['clockStoped'] }))).toEqual(['fact'])
  })
  it('catches a proper noun that is not canon, but not a document line in capitals', () => {
    expect(rules(seeded('I think of Margaret.'))).toEqual(['noun'])
    expect(rules(seeded('THERE WAS NEVER A NIGHT SHIFT.'))).toEqual([])
  })
  it('reads a contraction or possessive as its word', () => {
    expect(rules(seeded('Not now, I’m nearly warm. Get the Porter’s keys.'))).toEqual([])
    expect(rules(seeded('I think of Margaret’s lamp.'))).toEqual(['noun'])
  })
  it('catches a line with no text in the locale', () => {
    const { records } = seeded('unused')
    expect(lintNarrative({ canon, records, text: {} }).map((f) => [f.rule, f.id])).toEqual([
      ['text', 'toy.line'],
    ])
  })
  it('catches duplicates, unused lines and broken beats', () => {
    const a = seeded('The tap runs.', { id: 'toy.a', beat: 'toy.beat' })
    const b = seeded('The tap runs.', { id: 'toy.b' })
    const lines = { records: [...a.records, ...b.records], text: { ...a.text, ...b.text } }
    const beat: Beat = { id: 'toy.beat', learn: '…', required: true, deliveredBy: ['toy.missing'] }
    expect(rules(lines, { used: new Set(['toy.a']), beats: [beat] }).sort()).toEqual([
      'beat',
      'beat',
      'duplicate',
      'unused',
    ])
  })
})

describe('line length', () => {
  const long = seeded(Array(12).fill('The corridor is longer than it was, and colder.').join(' '))
  it('is checked with a measure and a box', () => {
    expect(rules(long, { measure, boxes: { default: box } })).toEqual(['length'])
  })
  it('uses the line kind’s own box when the game gives one', () => {
    expect(rules(long, { measure, boxes: { default: box, examine: { ...box, lines: 99 } } })).toEqual([])
  })
  it('is not checked without a measure, or without a box for the kind', () => {
    expect(rules(long)).toEqual([])
    expect(rules(long, { measure })).toEqual([])
    expect(rules(long, { boxes: { default: box } })).toEqual([])
  })
  it('wraps greedily on spaces, and `\\n` breaks', () => {
    expect(wrap('aa bb cc', 40, 'f', measure)).toBe(2)
    expect(wrap('aa\nbb', 400, 'f', measure)).toBe(2)
  })
})

describe('properNouns', () => {
  it('leaves a sentence’s first word, and finds the rest', () => {
    expect(properNouns('Then Margaret left. The Porter stayed.')).toEqual(['Margaret', 'Porter'])
  })
})
