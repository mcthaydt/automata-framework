import { effectSchema, type SysEffect } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import {
  ACTIONS,
  actionPiece,
  actionWords,
  isReadOnlyAction,
  placeChoices,
} from '#src/features/schematic/pieces/actions.ts'
import { type Names, NO_NAMES } from '#src/features/schematic/pieces/piece.ts'

const names: Names = {
  modes: ['patrol', 'hunt'],
  agents: ['nurse', 'porter'],
  facts: ['power.on', 'alarm'],
  places: ['bedside', 'desk'],
  hooks: ['chase'],
  doorways: ['ward>hall'],
}

const words = (effect: SysEffect): string => actionWords(effect, names)

describe('what an action says', () => {
  it.each<[string, SysEffect, string]>([
    ['switch mode', { setMode: 'hunt' }, 'switch to Hunt'],
    ['switch another character', { setMode: 'patrol', agent: 'porter' }, 'switch porter to Patrol'],
    ['go to a place', { goTo: 'bedside' }, 'go to bedside'],
    ['go to the player', { goTo: 'player' }, 'go to the player'],
    ['go to the last noise', { goTo: 'noise' }, 'go to the last noise it heard'],
    ['go to the nearest light', { goTo: 'light' }, 'go to the nearest light'],
    ['go to a point', { goTo: { x: 1, z: 2 } }, 'go to the point 1 across, 2 down'],
    ['run from the player', { flee: 'player' }, 'run from the player'],
    ['run from light', { flee: 'light' }, 'run from the nearest light'],
    [
      'make a noise here',
      { noise: { at: 'self', loudness: 6, kind: 'shriek' } },
      'make a shriek noise here, loudness 6',
    ],
    [
      'make a noise at a place',
      { noise: { at: 'desk', loudness: 3, kind: 'bang' } },
      'make a bang noise at desk, loudness 3',
    ],
    ['set a fact', { set: 'alarm', to: true }, 'set “alarm” to yes'],
    ['reset its wait', { set: 'self.timer', to: 0 }, 'reset its wait'],
    ['play a cutscene', { emit: { cutscene: 'caught' } }, 'play the cutscene caught'],
    ['say a line', { emit: { line: 'l1' } }, 'say the line l1'],
    ['catch the player', { emit: { caught: 'ada' } }, 'catch the player'],
    ['call game code', { call: 'chase' }, 'do “chase” (in the game’s code)'],
    [
      'follow through a doorway',
      { followThrough: { portal: 'crossed', delay: 2, then: 'hunt' } },
      'follow the player through the doorway she used after 2 s, then Hunt',
    ],
    [
      'lie in wait',
      { ambush: { id: 'a', agent: 'nurse', mode: 'hide', at: 'bedside', sting: 2, grace: 1, then: 'hunt' } },
      'hide, then appear at bedside after 2 s, wait 1 s, then Hunt',
    ],
  ])('%s', (_name, effect, expected) => {
    expect(words(effect)).toBe(expected)
  })
})

describe('the table', () => {
  it('gives every new action a value the schema accepts, that its own piece reads back', () => {
    for (const piece of ACTIONS) {
      for (const given of [names, NO_NAMES]) {
        const fresh = piece.fresh(given)
        expect(effectSchema.safeParse(fresh).success, piece.kind).toBe(true)
        expect(piece.matches(fresh), piece.kind).toBe(true)
        expect(actionPiece(fresh)?.kind, piece.kind).toBe(piece.kind)
      }
    }
  })

  it('writes each field and still reads the value as the same kind', () => {
    for (const piece of ACTIONS) {
      const fresh = piece.fresh(names)
      for (const field of piece.fields(fresh, names)) {
        const next =
          field.kind === 'number'
            ? field.value + 1
            : field.kind === 'text'
              ? 'x'
              : (field.options.find((option) => option.value !== field.value)?.value ?? field.value)
        const written = piece.write(fresh, field.key, next)
        expect(piece.matches(written), `${piece.kind}.${field.key}`).toBe(true)
        expect(effectSchema.safeParse(written).success, `${piece.kind}.${field.key}`).toBe(true)
      }
    }
  })

  it('makes an ambush a name of its own each time, and shows none', () => {
    const ambush = ACTIONS.find((piece) => piece.kind === 'ambush')
    const first = ambush?.fresh(names) as { ambush: { id: string } }
    const second = ambush?.fresh(names) as { ambush: { id: string } }
    expect(first.ambush.id).toMatch(/^ambush-\d+$/)
    expect(second.ambush.id).not.toBe(first.ambush.id)
    expect(ambush?.fields(first as SysEffect, names).map((f) => f.key)).not.toContain('id')
  })

  it('lets a point be picked and typed', () => {
    const piece = actionPiece({ goTo: 'bedside' })
    const point = piece?.write({ goTo: 'bedside' }, 'place', '$point')
    expect(point).toEqual({ goTo: { x: 0, z: 0 } })
    expect(piece?.fields(point as SysEffect, names).map((f) => f.label)).toEqual(['Where', 'Across', 'Down'])
    expect(piece?.write(point as SysEffect, 'x', 4)).toEqual({ goTo: { x: 4, z: 0 } })
    expect(piece?.write(point as SysEffect, 'place', 'desk')).toEqual({ goTo: 'desk' })
  })

  it('lists the places an action may name, in order', () => {
    expect(placeChoices(names).map((choice) => [choice.value, choice.words])).toEqual([
      ['player', 'the player'],
      ['self', 'itself'],
      ['noise', 'the last noise it heard'],
      ['light', 'the nearest light'],
      ['warmth', 'the nearest warm thing'],
      ['nurse', 'nurse'],
      ['porter', 'porter'],
      ['bedside', 'bedside'],
      ['desk', 'desk'],
      ['$point', 'a point…'],
    ])
  })

  it('keeps an action it does not know read only', () => {
    expect(actionPiece({ heal: 3 })).toBeUndefined()
    expect(isReadOnlyAction({ heal: 3 })).toBe(true)
    expect(isReadOnlyAction({ setMode: 'hunt' })).toBe(false)
  })
})
