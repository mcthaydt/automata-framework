// The recorded answers of The Last Light's own code to the game-fact corpus: the lists the checks of ED3D.2b-2 take as
// input, and what the game says about the lamps and room policies that the checks must say the same about.
import { describe, expect, it } from 'vitest'
import { loadGameFactCases, loadGameFacts } from './game-facts'

const facts = loadGameFacts()
const cases = loadGameFactCases()
const issuesOf = (id: string) => facts.lamps.find((lamp) => lamp.id === id)?.issues
const thrownBy = (id: string) => facts.policies.find((policy) => policy.id === id)?.thrown

describe('the game facts: the lists', () => {
  it('has the materials of the renderer, sorted, without repeats: the keys of its lit and unlit tables', () => {
    const { materials } = facts.options
    expect(materials).toHaveLength(21)
    expect(materials).toEqual([...new Set(materials)].sort())
    expect(materials).toEqual(
      expect.arrayContaining(['plaster', 'floor', 'ceilingTile', 'glass', 'moonGlass']),
    )
  })

  it('keeps the answer of the game’s own reader for the materials, which is null: it looks for a declaration with an object, and the tables are assigned with ??=', () => {
    expect(facts.reader.materials).toBeNull()
  })

  it('has the eleven lamp archetypes with a colour of three channels and a band of two metres', () => {
    const kinds = facts.options.lampKinds
    expect(Object.keys(kinds ?? {})).toEqual([
      'pendant',
      'bulb',
      'desk',
      'fluorescent',
      'sodium',
      'fire',
      'gas',
      'screen',
      'moon',
      'fill',
      'spark',
    ])
    for (const kind of Object.values(kinds ?? {})) {
      expect(kind.color).toHaveLength(3)
      expect(kind.color.every((channel) => channel >= 0 && channel <= 1)).toBe(true)
      expect(kind.range[0]).toBeLessThan(kind.range[1])
    }
    expect(kinds?.desk?.range).toEqual([3.5, 5.5])
  })

  it('has the tone the game allows', () => {
    expect(facts.options.tone).toBe(0.06)
  })
})

describe('the game facts: the answers', () => {
  it('has an answer for every case of the corpus, in its order', () => {
    expect(facts.lamps.map((lamp) => lamp.id)).toEqual(cases.lamps.map((lamp) => lamp.id))
    expect(facts.policies.map((policy) => policy.id)).toEqual(cases.policies.map((policy) => policy.id))
  })

  it('says what the game says of a lamp: an archetype is clean, a colour is over the tone, a range is outside the band', () => {
    for (const kind of Object.keys(facts.options.lampKinds ?? {}))
      expect(issuesOf(`${kind}-archetype`), kind).toEqual([])
    expect(issuesOf('pendant-tone-inside')).toEqual([])
    expect(issuesOf('pendant-tone-outside')?.join()).toMatch(
      /colour is 0\.06\d from the archetype's, over 0\.06 \(OKLab\)/,
    )
    expect(issuesOf('desk-far')).toEqual(['lamp far (desk): range 12 m outside 3.5–5.5 m'])
    expect(issuesOf('bulb-both')).toHaveLength(2)
    expect(issuesOf('pendant-range-min')).toEqual([])
    expect(issuesOf('pendant-range-max')).toEqual([])
    expect(issuesOf('pendant-range-below')).toHaveLength(1)
    expect(issuesOf('pendant-range-above')).toHaveLength(1)
  })

  it('says a lamp with no kind, or a kind that is not an archetype, is not from the kit (the game’s own gate, not the editor’s)', () => {
    expect(issuesOf('raw-no-kind')?.[0]).toMatch(/lamp raw: not from the kit/)
    expect(issuesOf('kind-not-in-list')?.[0]).toMatch(/lamp odd: not from the kit/)
  })

  it('keeps the distance of a lamp from its archetype, and none for a kind that is not one', () => {
    expect(facts.lamps.find((lamp) => lamp.id === 'pendant-archetype')?.distance).toBe(0)
    expect(facts.lamps.find((lamp) => lamp.id === 'raw-no-kind')?.distance).toBeNull()
    expect(facts.lamps.find((lamp) => lamp.id === 'kind-not-in-list')?.distance).toBeNull()
  })

  it('says what the game throws at a room policy, and nothing for a complete one', () => {
    expect(thrownBy('complete')).toBeNull()
    expect(thrownBy('unassigned-sector')).toBe('unassigned sector closet')
    expect(thrownBy('duplicate-sector')).toBe('duplicate: unknown or duplicate sector hall')
    expect(thrownBy('unknown-sector')).toBe('reception: unknown or duplicate sector porch')
    expect(thrownBy('empty-room')).toBe('attic: empty room')
    expect(thrownBy('zone-owner-unknown-room')).toBe('hall: invalid room owners')
    expect(thrownBy('zone-owners-empty')).toBe('hall: invalid room owners')
    expect(thrownBy('unassigned-zone')).toBe('unassigned zone closet')
    expect(thrownBy('unknown-zone')).toBe('unknown zone porch')
    expect(thrownBy('unassigned-mass')).toBe('unassigned mass 0')
    expect(thrownBy('mass-owner-unknown-room')).toBe('mass 0: invalid room owners')
    expect(thrownBy('mass-global')).toBeNull()
    expect(thrownBy('mass-owned')).toBeNull()
    expect(thrownBy('unknown-mass-past-count')).toBe('unknown mass 3')
    expect(thrownBy('unknown-mass-negative')).toBe('unknown mass -1')
    expect(thrownBy('unknown-mass-fraction')).toBe('unknown mass 1.5')
  })

  it('says only the first fault of a policy with several: the game stops there', () => {
    expect(thrownBy('several-faults')).toBe('reception: unknown or duplicate sector porch')
  })
})
