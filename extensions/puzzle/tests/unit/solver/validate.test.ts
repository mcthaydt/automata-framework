// `validate` (M6 spec §4.5, §6): the adventure source's static checks of a puzzle against its scene and model. The
// clinic's own data checks are in `clinic-solver.test.ts`, beside the clinic's model.
import { describe, expect, it } from 'vitest'
import { validate } from '#src/entries/solver.ts'
import { toyScene } from '#src/testing/toy-scene.ts'

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
