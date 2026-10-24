import { describe, expect, it } from 'vitest'
import { checkSetPieces } from './check-set-pieces'
import type { StageSetPiece } from './stage.schema'
import { withPieces } from './testing/check-docs'

// The ranges of the set pieces (EDFF.1b decision 1). Which layers a piece may name is the references check's.

const error = (code: string, path: string, message: string) => ({ severity: 'error', code, path, message })

const swarm = (rest: Record<string, unknown> = {}): StageSetPiece =>
  ({ floor: 12, kind: 'swarm', holdMs: 4000, layers: ['sky.birds'], speed: 6, ...rest }) as StageSetPiece

const check = (...pieces: StageSetPiece[]) => checkSetPieces(withPieces(pieces))

describe('valid pieces', () => {
  it('accepts one of each kind, and the bounds of every range', () => {
    expect(
      check(
        { floor: 1, kind: 'lightsOut', holdMs: 500, invert: true },
        { floor: 50, kind: 'paletteShift', holdMs: 20_000, mood: 'night' },
        { floor: 20, kind: 'weatherBurst', holdMs: 3000, particle: 'rain', density: 0 },
        {
          floor: 20,
          kind: 'weatherBurst',
          holdMs: 3000,
          particle: 'snow',
          density: 1,
          layers: ['a', 'b', 'c', 'd', 'e', 'f'],
        },
        { floor: 30, kind: 'skyFlash', holdMs: 3000, flashes: 1, tone: 'aurora', kick: 0 },
        { floor: 30, kind: 'skyFlash', holdMs: 3000, flashes: 3, tone: 'lightning', kick: 4 },
        swarm({ speed: 1 }),
        swarm({ speed: 20 }),
      ),
    ).toEqual([])
  })

  it('finds nothing with no pieces', () => {
    expect(check()).toEqual([])
  })
})

describe('setPieceRange', () => {
  it.each([
    [{ floor: 0 }, 'floor', 'The swarm piece has floor 0; it is a whole number from 1 to 50.'],
    [{ floor: 51 }, 'floor', 'The swarm piece has floor 51; it is a whole number from 1 to 50.'],
    [{ floor: 2.5 }, 'floor', 'The swarm piece has floor 2.5; it is a whole number from 1 to 50.'],
    [
      { holdMs: 499 },
      'holdMs',
      'The swarm piece at floor 12 has holdMs 499; it is a whole number from 500 to 20000.',
    ],
    [
      { holdMs: 20_001 },
      'holdMs',
      'The swarm piece at floor 12 has holdMs 20001; it is a whole number from 500 to 20000.',
    ],
    [
      { holdMs: 1000.5 },
      'holdMs',
      'The swarm piece at floor 12 has holdMs 1000.5; it is a whole number from 500 to 20000.',
    ],
    [{ speed: 0.5 }, 'speed', 'The swarm piece at floor 12 has speed 0.5; it goes from 1 to 20.'],
    [{ speed: 21 }, 'speed', 'The swarm piece at floor 12 has speed 21; it goes from 1 to 20.'],
  ])('refuses %j', (change, field, message) => {
    expect(check(swarm(change))).toEqual([error('setPieceRange', `theme.setPieces[b0].${field}`, message)])
  })

  it('says a value that is not a number is not a number', () => {
    expect(check(swarm({ speed: Number.NaN }))).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].speed',
        'The speed of the swarm piece at floor 12 is not a number.',
      ),
    ])
  })

  it('checks the fields of the other kinds', () => {
    const base = { floor: 20, holdMs: 3000 }
    expect(check({ ...base, kind: 'weatherBurst', particle: 'rain', density: 1.5 })).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].density',
        'The weatherBurst piece at floor 20 has density 1.5; it goes from 0 to 1.',
      ),
    ])
    expect(check({ ...base, kind: 'skyFlash', tone: 'aurora', flashes: 4 })).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].flashes',
        'The skyFlash piece at floor 20 has flashes 4; it is a whole number from 1 to 3.',
      ),
    ])
    expect(check({ ...base, kind: 'skyFlash', tone: 'aurora', flashes: 0 })).toHaveLength(1)
    expect(check({ ...base, kind: 'skyFlash', tone: 'aurora', flashes: 1, kick: 4.5 })).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].kick',
        'The skyFlash piece at floor 20 has kick 4.5; it goes from 0 to 4.',
      ),
    ])
  })

  it('addresses a piece by its id, whatever its place in the list', () => {
    const [found] = check(swarm(), swarm(), swarm({ speed: 99 }))
    expect(found?.path).toBe('theme.setPieces[b2].speed')
  })
})

describe('the layers a piece names', () => {
  it('needs one to six names', () => {
    expect(check(swarm({ layers: [] }))).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].layers',
        'The swarm piece at floor 12 names no layers; it needs 1 to 6.',
      ),
    ])
    expect(check(swarm({ layers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }))).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].layers',
        'The swarm piece at floor 12 names 7 layers; it needs 1 to 6.',
      ),
    ])
  })

  it('allows a weather burst to name none, but not an empty list', () => {
    const burst = { floor: 20, holdMs: 3000, kind: 'weatherBurst', particle: 'rain', density: 0.5 } as const
    expect(check(burst)).toEqual([])
    expect(check({ ...burst, layers: [] })).toEqual([
      error(
        'setPieceRange',
        'theme.setPieces[b0].layers',
        'The weatherBurst piece at floor 20 names no layers; it needs 1 to 6.',
      ),
    ])
  })

  it('refuses an empty name, by its place in the list', () => {
    expect(check(swarm({ layers: ['sky.birds', ''] }))).toEqual([
      error(
        'emptyAlias',
        'theme.setPieces[b0].layers[1]',
        'The swarm piece at floor 12 names a layer with an empty alias.',
      ),
    ])
  })
})

describe('tooManyPieces', () => {
  it('allows 16 and refuses 17', () => {
    expect(check(...Array.from({ length: 16 }, () => swarm()))).toEqual([])
    expect(check(...Array.from({ length: 17 }, () => swarm()))).toEqual([
      error('tooManyPieces', 'theme.setPieces', 'A stage has at most 16 set pieces; this one has 17.'),
    ])
  })
})
