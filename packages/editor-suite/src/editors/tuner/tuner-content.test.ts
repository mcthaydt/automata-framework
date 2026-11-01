import { describe, expect, it } from 'vitest'
import { readTuning } from './tuner-content'

const FILE = `# How the character moves.
# 90 px/s.
MAX_RUN = { value = 384, min = 128, max = 768, step = 1 }
GRAVITY = 64 # 900 px/s²
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
    expect(all['MAX_RUN']).toMatchObject({ unit: 'px/s', note: '90 px/s.' })
    expect(all['GRAVITY']).toMatchObject({ unit: 'px/s²', note: '900 px/s²' })
    expect(all['COYOTE_TICKS']?.unit).toBeUndefined()
    expect(all['COYOTE_TICKS']?.note).toBe('the grace a jump still works after a ledge')
    expect(all['SCALE']?.note).toBeUndefined()
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
