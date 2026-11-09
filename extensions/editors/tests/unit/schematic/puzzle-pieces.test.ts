import { condSchema, effectSchema } from '@automata/puzzle/sim'
import { describe, expect, it } from 'vitest'
import type { Names } from '#src/features/schematic/pieces/piece.ts'
import {
  PUZZLE_CONDITIONS,
  PUZZLE_EFFECTS,
  puzzleCondPiece,
  puzzleCondWords,
  puzzleEffectPiece,
  puzzleEffectWords,
} from '#src/features/schematic/puzzle/puzzle-pieces.ts'

const names: Names = {
  modes: [],
  agents: [],
  facts: ['power', 'fuel'],
  places: ['shutter', 'desk'],
  hooks: ['wake'],
  doorways: [],
  items: ['crank', 'fuse'],
}

describe('a puzzle’s conditions, in words', () => {
  it.each([
    [{ fact: 'power', is: true }, '“power” is yes'],
    [{ fact: 'power', is: false }, '“power” is no'],
    [{ fact: 'code', is: 'ab' }, '“code” is “ab”'],
    [{ fact: 'fuel', atLeast: 3 }, '“fuel” is at least 3'],
    [{ fact: 'fuel', atMost: 2 }, '“fuel” is at most 2'],
    [{ fact: 'fuel', atLeast: 1, atMost: 5 }, '“fuel” is at least 1 and at most 5'],
    [{ has: 'crank' }, 'has the crank'],
    [{ not: { has: 'crank' } }, 'does not have the crank'],
    [{ not: { fact: 'power', is: true } }, '“power” is not yes'],
    [{ any: [{ has: 'crank' }, { fact: 'power', is: true }] }, 'any of: has the crank; “power” is yes'],
  ])('%j reads %s', (cond, words) => {
    expect(puzzleCondWords(cond as never, names)).toBe(words)
  })

  it('shows a fact’s value in a field of the same kind', () => {
    const piece = puzzleCondPiece({ fact: 'fuel', atLeast: 3 })
    expect(piece?.fields({ fact: 'fuel', atLeast: 3 }, names).map((f) => f.label)).toEqual([
      'Fact',
      'At least',
    ])
    expect(piece?.write({ fact: 'fuel', atLeast: 3 }, 'atLeast', 4)).toEqual({ fact: 'fuel', atLeast: 4 })
    expect(
      puzzleCondPiece({ fact: 'power', is: true })?.write({ fact: 'power', is: true }, 'is', 'no'),
    ).toEqual({
      fact: 'power',
      is: false,
    })
  })

  it('leaves an “any” as it is, read only', () => {
    const any = { any: [{ has: 'crank' }] }
    expect(puzzleCondPiece(any)).toBeUndefined()
  })

  it('makes a new one of every kind on the menu that passes the schema', () => {
    for (const piece of PUZZLE_CONDITIONS) {
      const fresh = piece.fresh(names)
      expect(condSchema.safeParse(fresh).success, piece.kind).toBe(true)
      expect(piece.matches(fresh), piece.kind).toBe(true)
    }
  })
})

describe('a puzzle’s effects, in words', () => {
  it.each([
    [{ set: 'power', to: true }, 'set “power” to yes'],
    [{ add: 'fuel', by: 2 }, 'add 2 to “fuel”'],
    [{ add: 'fuel', by: -1 }, 'take 1 off “fuel”'],
    [{ give: 'fuse' }, 'pick up the fuse'],
    [{ take: 'fuse' }, 'lose the fuse'],
    [{ noise: { at: 'shutter', loudness: 8, kind: 'clang' } }, 'make a clang noise at shutter, loudness 8'],
    [
      { noise: { at: { x: 1, z: 2 }, loudness: 4, kind: 'echo' } },
      'make an echo noise at the point 1 across, 2 down, loudness 4',
    ],
    [{ cutscene: 'intro' }, 'play the cutscene intro'],
    [{ checkpoint: true }, 'save a checkpoint'],
    [{ keypad: true }, 'open the keypad'],
    [{ exit: { to: 'hall', cutscene: 'out' } }, 'leave for hall, with the cutscene out'],
    [{ dialogue: 'guard-talk' }, 'start the conversation guard talk'],
    [{ call: 'wake' }, 'do “wake” (in the game’s code)'],
  ])('%j reads %s', (effect, words) => {
    expect(puzzleEffectWords(effect as never, names)).toBe(words)
  })

  it('makes a new one of every kind on the menu that passes the schema', () => {
    for (const piece of PUZZLE_EFFECTS) {
      const fresh = piece.fresh(names)
      expect(effectSchema.safeParse(fresh).success, piece.kind).toBe(true)
      expect(puzzleEffectPiece(fresh)?.kind, piece.kind).toBe(piece.kind)
    }
  })

  it('writes a field back into its own key', () => {
    const noise = { noise: { at: 'shutter', loudness: 8, kind: 'clang' } }
    expect(puzzleEffectPiece(noise)?.write(noise as never, 'loudness', 12)).toEqual({
      noise: { at: 'shutter', loudness: 12, kind: 'clang' },
    })
    const add = { add: 'fuel', by: 2 }
    expect(puzzleEffectPiece(add)?.write(add as never, 'by', 5)).toEqual({ add: 'fuel', by: 5 })
  })
})
