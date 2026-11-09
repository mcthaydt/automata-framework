import { type Probe, probeSchema } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import {
  CONDITIONS,
  conditionPiece,
  conditionWords,
  isReadOnlyCondition,
} from '#src/features/schematic/pieces/conditions.ts'
import { type Names, NO_NAMES } from '#src/features/schematic/pieces/piece.ts'

const names: Names = {
  modes: ['patrol', 'hunt'],
  agents: ['nurse', 'porter'],
  facts: ['power.on', 'alarm'],
  places: ['bedside', 'desk'],
  hooks: [],
  doorways: [],
}

const words = (probe: Probe): string => conditionWords(probe, names)

describe('what a condition says', () => {
  it.each<[string, Probe, string]>([
    ['sees', { sees: true }, 'sees the player'],
    ['hears a noise within a reach', { heard: 'shriek', reach: 6 }, 'hears a shriek within 6 m'],
    ['hears a noise from anywhere', { heard: 'step' }, 'hears a step from anywhere'],
    ['hears anything', { heard: '*' }, 'hears anything'],
    ['light with a radius', { inLight: true, radius: 2 }, 'is in light (within 2 m)'],
    ['light', { inLight: true }, 'is in light'],
    ['warmth', { warmthWithin: 3 }, 'is within 3 m of warmth'],
    ['touching', { touching: true }, 'is touching the player'],
    ['touching within a radius', { touching: true, radius: 1 }, 'is within 1 m of the player'],
    ['a fact', { fact: 'power.on', is: true }, '“power on” is yes'],
    ['a fact that is a number', { fact: 'keys', is: 2 }, '“keys” is 2'],
    ["another character's mode", { mode: 'hunt', agent: 'nurse' }, 'nurse is in Hunt'],
    ['its own mode', { mode: 'hunt' }, 'is in Hunt'],
    ['at a place', { at: 'bedside' }, 'is at bedside'],
    ['a timer', { timer: 8 }, 'has stood still more than 8 s'],
    ['a doorway', { crossed: true }, 'the player just went through a doorway'],
    ['saw her hide', { sawHide: { radius: 4, los: true } }, 'saw the player hide within 4 m, in sight'],
    ['saw her hide through walls', { sawHide: { radius: 4 } }, 'saw the player hide within 4 m'],
    ['has got where it was going', { fact: 'self.idle', is: true }, 'has got where it was going'],
    ['is stuck', { fact: 'self.blocked', is: true }, 'is stuck'],
    ['the player is not hiding', { fact: 'pursuit.hidden', is: '' }, 'the player is not hiding'],
    ['its own note', { fact: 'self.seen', is: true }, 'its own “seen” is yes'],
    ['not', { not: { sees: true } }, 'does not see the player'],
    ['not in a mode', { not: { mode: 'hunt' } }, 'is not in Hunt'],
    ['not at a place', { not: { at: 'desk' } }, 'is not at desk'],
    ['not hearing', { not: { heard: 'step' } }, 'does not hear a step from anywhere'],
    ['not stuck', { not: { fact: 'self.blocked', is: true } }, 'is not stuck'],
  ])('%s', (_name, probe, expected) => {
    expect(words(probe)).toBe(expected)
  })

  it('reads a second not as "not (…)" and keeps it read only', () => {
    const deep: Probe = { not: { not: { sees: true } } }
    expect(words(deep)).toBe('not (does not see the player)')
    expect(isReadOnlyCondition(deep)).toBe(true)
    expect(isReadOnlyCondition({ not: { sees: true } })).toBe(false)
  })
})

describe('the table', () => {
  it('has a piece for every kind of condition the schema has', () => {
    const kinds = new Set(CONDITIONS.map((piece) => piece.kind))
    for (const kind of [
      'inLight',
      'heard',
      'sees',
      'warmthWithin',
      'touching',
      'fact',
      'mode',
      'at',
      'timer',
      'not',
      'crossed',
      'sawHide',
    ])
      expect(kinds.has(kind)).toBe(true)
  })

  it('gives every new condition a value the schema accepts, that its own piece reads back', () => {
    for (const piece of CONDITIONS) {
      const fresh = piece.fresh(names)
      expect(probeSchema.safeParse(fresh).success, piece.kind).toBe(true)
      expect(piece.matches(fresh), piece.kind).toBe(true)
      expect(conditionPiece(fresh)).toBeDefined()
      expect(piece.fresh(NO_NAMES)).toBeDefined()
    }
  })

  it('writes each field and still reads the value as the same kind', () => {
    for (const piece of CONDITIONS) {
      const fresh = piece.fresh(names)
      for (const field of piece.fields(fresh, names)) {
        const next =
          field.kind === 'number'
            ? field.value + 1
            : field.kind === 'text'
              ? 'x'
              : (field.options[0]?.value ?? '')
        const written = piece.write(fresh, field.key, next)
        expect(piece.matches(written), `${piece.kind}.${field.key}`).toBe(true)
        expect(probeSchema.safeParse(written).success, `${piece.kind}.${field.key}`).toBe(true)
      }
    }
  })

  it('shows the fields of a sentence', () => {
    const heard = conditionPiece({ heard: 'shriek', reach: 6 })
    expect(heard?.fields({ heard: 'shriek', reach: 6 }, names).map((f) => [f.label, f.value])).toEqual([
      ['Kind of noise', 'shriek'],
      ['Within', 6],
    ])
    expect(heard?.fields({ heard: 'step' }, names).map((f) => f.label)).toEqual(['Kind of noise'])
  })

  it('writes a number into the one key and keeps the rest', () => {
    const piece = conditionPiece({ heard: 'shriek', reach: 6 })
    expect(piece?.write({ heard: 'shriek', reach: 6 }, 'reach', 9)).toEqual({ heard: 'shriek', reach: 9 })
    expect(
      conditionPiece({ sawHide: { radius: 4, los: true } })?.write(
        { sawHide: { radius: 4, los: true } },
        'radius',
        5,
      ),
    ).toEqual({
      sawHide: { radius: 5, los: true },
    })
  })

  it('edits inside a not', () => {
    const probe: Probe = { not: { timer: 8 } }
    expect(conditionPiece(probe)?.write(probe, 'timer', 9)).toEqual({ not: { timer: 9 } })
  })

  it('knows no piece for a kind the table lacks', () => {
    expect(conditionPiece({ health: 3 })).toBeUndefined()
    expect(conditionPiece({ sees: true, extra: 1 })).toBeUndefined()
    expect(conditionPiece('sees')).toBeUndefined()
  })
})
