import { describe, expect, it } from 'vitest'
import { readTuning } from '#src/features/suite/tuner/tuner-content.ts'

const FILE = `# How the character moves.
# Celeste: 90 px/s.
MAX_RUN = { value = 384, min = 128, max = 768, step = 1 }
GRAVITY = 64 # px/s²
COYOTE_TICKS = 6 # the grace a jump still works after a ledge
SCALE = 0.25
DEBUG = false
GREETING = "hello"
CURVE = [ 1, 2, 3 ]

[nested]
x = 1
`

const byName = (text: string, meta?: Parameters<typeof readTuning>[1]) => {
  const read = readTuning(text, meta)
  if ('problem' in read) throw new Error(read.problem)
  return Object.fromEntries(read.tunables.map((tunable) => [tunable.name, tunable]))
}

describe('readTuning', () => {
  it("reads a ranged tunable's unit and scale, the unit overriding a comment's", () => {
    const all = byName(
      `# px/tick\nMAX_RUN = { value = 384, min = 128, max = 768, step = 1, unit = "px/s", scale = 0.234375 }\n`,
    )
    expect(all['MAX_RUN']).toMatchObject({ unit: 'px/s', scale: 0.234375 })
  })

  it('reads each spelling as its kind', () => {
    const all = byName(FILE)
    expect(all['MAX_RUN']).toMatchObject({
      kind: 'int',
      value: 384,
      min: 128,
      max: 768,
      step: 1,
      authored: true,
      editable: true,
    })
    expect(all['GRAVITY']).toMatchObject({ kind: 'int', value: 64, authored: false, editable: true })
    expect(all['GRAVITY']?.min).toBeUndefined()
    expect(all['SCALE']).toMatchObject({ kind: 'float', value: 0.25 })
    expect(all['DEBUG']).toMatchObject({ kind: 'boolean', value: false, editable: true })
    expect(all['GREETING']).toMatchObject({ kind: 'string', value: 'hello', editable: true })
  })

  it('shows a table or an array as Ask only, and leaves nested tables out of the list', () => {
    const all = byName(FILE)
    expect(all['CURVE']).toMatchObject({ kind: 'other', editable: false })
    expect(all['nested']).toMatchObject({ kind: 'other', editable: false })
  })

  it('takes the unit and the note from the comments (EDS-D18)', () => {
    const all = byName(FILE)
    // A comment that is just a unit is the unit; one with a number in it describes the number and is only a note, so
    // "90 px/s" (the original in other units) is never shown as the unit of 384.
    expect(all['MAX_RUN']).toMatchObject({ note: 'Celeste: 90 px/s.' })
    expect(all['MAX_RUN']?.unit).toBeUndefined()
    expect(all['GRAVITY']).toMatchObject({ unit: 'px/s²', note: 'px/s²' })
    expect(all['COYOTE_TICKS']?.unit).toBeUndefined()
    expect(all['COYOTE_TICKS']?.note).toBe('the grace a jump still works after a ledge')
    expect(all['SCALE']?.note).toBeUndefined()
  })

  it('does not take a unit from a comment that holds a number', () => {
    expect(byName('A = 1 # 90 px/s.\nB = 2 # 90 px/s\nC = 3 # about 0.08 s\n')).toMatchObject({
      A: { note: '90 px/s.' },
      B: { note: '90 px/s' },
      C: { note: 'about 0.08 s' },
    })
    const all = byName('A = 1 # 90 px/s.\nB = 2 # s\nC = 3 # ticks\nD = 4 # m/s\nE = 5 # %\n')
    expect(all['A']?.unit).toBeUndefined()
    expect(['B', 'C', 'D', 'E'].map((name) => all[name]?.unit)).toEqual(['s', 'ticks', 'm/s', '%'])
  })

  it('takes the bounds of a bare number from the compiler’s tuning-meta.json', () => {
    const meta = { GRAVITY: { type: 'int', value: 64, min: 16, max: 192, step: 1 } }
    const all = byName(FILE, meta)
    expect(all['GRAVITY']).toMatchObject({ min: 16, max: 192, step: 1, authored: false })
    // An inline table's own bounds win over the meta's.
    expect(byName(FILE, { MAX_RUN: { type: 'int', value: 384, min: 1, max: 2 } })['MAX_RUN']).toMatchObject({
      min: 128,
      max: 768,
    })
  })

  it('keeps the order of the file', () => {
    const read = readTuning(FILE)
    if ('problem' in read) throw new Error(read.problem)
    expect(read.tunables.map((tunable) => tunable.name)).toEqual([
      'MAX_RUN',
      'GRAVITY',
      'COYOTE_TICKS',
      'SCALE',
      'DEBUG',
      'GREETING',
      'CURVE',
      'nested',
    ])
  })

  it('says why a file that does not parse cannot be read, with its line', () => {
    const read = readTuning('A = 1\nB = \n')
    expect(read).toMatchObject({ problem: expect.stringMatching(/line 2/) })
  })
})
