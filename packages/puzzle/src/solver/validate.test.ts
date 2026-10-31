// `validate` (M6 spec §4.5, §6): the adventure source's static checks of a puzzle against its scene and model, and
// `clinic-puzzle.test.ts`'s checks of the clinic's data, on the converted clinic.
import { describe, expect, it } from 'vitest'
import { CLINIC_MODEL } from '../testing/clinic-model'
import { scenePuzzle } from '../testing/converted-puzzles'
import { toyScene } from '../testing/toy-scene'
import { validate } from './index'

describe('puzzle validate', () => {
  it('passes a sound puzzle', () => {
    expect(validate(toyScene()).filter((f) => f.level === 'error')).toEqual([])
  })

  it('finds duplicate ids, missing lines, unknown hotspots, items and facts, and hidden actions', () => {
    const errors = validate(
      toyScene([
        { id: 'a', at: 'drawer', then: [{ give: 'gem' }], say: 'missing' },
        { id: 'a', at: 'window', then: [], say: 'drawer' },
        {
          id: 'b',
          at: 'drawer',
          when: [{ fact: 'mystery', is: true }],
          then: [{ set: 'doorOpen', to: true }],
          say: 'drawer',
        },
        { id: 'c', at: 'door', then: [{ call: 'magic' }], say: 'door' },
      ]),
    )
      .filter((f) => f.level === 'error')
      .map((f) => `${f.rule} ${f.id}`)
    expect(errors).toEqual(
      expect.arrayContaining(['line a', 'item a', 'id a', 'hotspot a', 'fact b', 'unreachable b', 'model c']),
    )
  })
})

describe('clinic puzzle data', () => {
  const clinic = scenePuzzle('clinic')
  const scene = {
    ...toyScene(),
    id: 'clinic',
    def: clinic,
    model: CLINIC_MODEL,
    // The converted fixture has no story text: its line keys are the ones the puzzle says.
    story: {
      lines: Object.fromEntries(
        [...clinic.actions.map((a) => a.say), ...Object.values(clinic.fallback)].map((k) => [k, k]),
      ),
      items: Object.fromEntries(clinic.items.map((i) => [i, i])),
    },
    cutscenes: [
      ...new Set(
        clinic.actions.flatMap((a) =>
          a.then.flatMap((e) => ('cutscene' in e ? [e.cutscene] : 'exit' in e ? [e.exit.cutscene] : [])),
        ),
      ),
    ],
  }

  it('has unique action ids', () => {
    expect(new Set(clinic.actions.map((a) => a.id)).size).toBe(clinic.actions.length)
  })

  it('names only hotspots it declares and items it lists, and validates with no error', () => {
    expect(validate(scene).filter((f) => f.level === 'error')).toEqual([])
  })

  it('reaches its goal through the exit, and every systemic and lethal entry names real actions', () => {
    const ids = new Set(clinic.actions.map((a) => a.id))
    expect(
      clinic.actions.some(
        (a) =>
          a.at === 'exit' &&
          a.then.some((e) => 'set' in e && clinic.goal.some((g) => 'fact' in g && g.fact === e.set)),
      ),
    ).toBe(true)
    for (const s of clinic.systemic) for (const v of s.via) expect(ids.has(v), `${s.id} via ${v}`).toBe(true)
    for (const l of clinic.lethal)
      for (const h of l.hintedBy) expect(ids.has(h), `${l.id} hinted by ${h}`).toBe(true)
  })
})
