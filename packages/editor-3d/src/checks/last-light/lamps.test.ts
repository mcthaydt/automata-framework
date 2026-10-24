// The `lamps` check (ED3D.2b-2): a lamp of a known kind sits within its archetype's colour tone and range band. Held to
// The Last Light's own `lampIssues` and `colourDistance` by the recorded corpus, then seeded and run over the shipped files.
import { describe, expect, it } from 'vitest'
import type { Blockout, BlockoutLamp } from '../../format/blockout.schema'
import { loadFixture } from '../../testing/fixtures'
import { loadGameFactCases, loadGameFacts } from '../../testing/game-facts'
import { BLOCKOUT_NAMES } from '../../testing/geometry-golden'
import { colourDistance, DEFAULT_TONE, lampProblems, oklab } from './lamps'

const facts = loadGameFacts()
const cases = loadGameFactCases()
const kinds = facts.options.lampKinds ?? {}
const tone = facts.options.tone ?? DEFAULT_TONE

const lamp = (more: Partial<BlockoutLamp> = {}): BlockoutLamp => ({
  id: 'l1',
  x: 2,
  y: 3,
  z: 5,
  range: 7,
  radius: 0,
  color: [1, 0.8352941176470589, 0.6078431372549019],
  kind: 'pendant',
  ...more,
})

describe('colourDistance', () => {
  it('is the game’s own distance, to a rounding of the last digit, for each lamp of the corpus whose kind is one', () => {
    for (const recorded of facts.lamps) {
      if (recorded.distance === null) continue
      const { lamp: seeded } = cases.lamps.find((c) => c.id === recorded.id) ?? { lamp: undefined }
      const kind = kinds[seeded?.kind ?? '']
      expect(colourDistance(seeded?.color ?? [], kind?.color ?? []), recorded.id).toBeCloseTo(
        recorded.distance,
        12,
      )
    }
  })

  it('is nothing between a colour and itself, and the same either way round', () => {
    expect(colourDistance([0.2, 0.4, 0.6], [0.2, 0.4, 0.6])).toBe(0)
    expect(colourDistance([0.2, 0.4, 0.6], [0.9, 0.1, 0.3])).toBe(
      colourDistance([0.9, 0.1, 0.3], [0.2, 0.4, 0.6]),
    )
  })

  it('reads a dark colour on the straight part of the sRGB curve: a grey of 0.04 has the lightness of its linear light’s cube root', () => {
    expect(oklab([0.04, 0.04, 0.04])[0]).toBeCloseTo(Math.cbrt(0.04 / 12.92), 6)
  })

  it('has the game’s tone, 0.06, as its default', () => {
    expect(DEFAULT_TONE).toBe(0.06)
  })

  it('puts white at lightness one and black at none (OKLab)', () => {
    expect(oklab([1, 1, 1])[0]).toBeCloseTo(1, 4)
    expect(oklab([0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('lampProblems: against the game', () => {
  it('says exactly what the game’s `lampIssues` says of each lamp of the corpus whose kind is an archetype', () => {
    for (const recorded of facts.lamps) {
      const seeded = cases.lamps.find((c) => c.id === recorded.id)?.lamp
      if (seeded === undefined || recorded.distance === null) continue
      expect(
        lampProblems([seeded], kinds, tone).map((problem) => problem.message),
        recorded.id,
      ).toEqual(recorded.issues)
    }
  })

  it('takes colour and range separately: a lamp can break both, and the colour is said first', () => {
    const both = cases.lamps.find((c) => c.id === 'bulb-both')?.lamp
    expect(lampProblems([both as BlockoutLamp], kinds, tone)).toHaveLength(2)
    expect(lampProblems([both as BlockoutLamp], kinds, tone)[0]?.message).toMatch(/colour is/)
  })
})

describe('lampProblems: what the editor says that the game says otherwise', () => {
  it('says a kind the list lacks, naming the kinds in the list’s order', () => {
    const [problem] = lampProblems([lamp({ id: 'odd', kind: 'candle' })], kinds, tone)
    expect(problem?.message).toBe(
      'lamp odd: kind candle is not one of pendant, bulb, desk, fluorescent, sodium, fire, gas, screen, moon, fill, spark',
    )
  })

  it('takes a kind that is the name of an inherited member as a kind the list lacks, and does not fail on it', () => {
    const problems = lampProblems(
      [lamp({ kind: 'constructor' }), lamp({ id: 'l2', kind: 'toString' })],
      kinds,
      tone,
    )
    expect(problems.map((problem) => problem.message.slice(0, 40))).toEqual([
      'lamp l1: kind constructor is not one of ',
      'lamp l2: kind toString is not one of pen',
    ])
  })

  it('does not check a lamp with no kind: it has no archetype to be outside of (the game’s own gate says it is not from the kit)', () => {
    const { kind: _kind, ...bare } = lamp({ range: 99, color: [0, 0, 1] })
    expect(lampProblems([bare], kinds, tone)).toEqual([])
  })
})

describe('lampProblems: places, order and the tone', () => {
  it('locates a problem at the lamp, framed at its place', () => {
    const [problem] = lampProblems([lamp({ range: 12 })], kinds, tone)
    expect(problem?.locator).toEqual({ selection: 'entity:lamp/l1', at: { x: 2, z: 5 } })
  })

  it('gives a lamp whose id cannot be a selection no place, and does not fail on it', () => {
    const [problem] = lampProblems([lamp({ id: 'a/b', range: 12 })], kinds, tone)
    expect(problem?.message).toBe('lamp a/b (pendant): range 12 m outside 5.5–9 m')
    expect(problem?.locator).toBeUndefined()
  })

  it('says the lamps in file order', () => {
    const lamps = [lamp({ id: 'x', range: 12 }), lamp({ id: 'y', range: 1 }), lamp({ id: 'z', range: 20 })]
    expect(lampProblems(lamps, kinds, tone).map((problem) => problem.message.slice(0, 7))).toEqual([
      'lamp x ',
      'lamp y ',
      'lamp z ',
    ])
  })

  it('says a range at an edge of the band is within it, and just past is not', () => {
    expect(lampProblems([lamp({ range: 5.5 }), lamp({ range: 9 })], kinds, tone)).toEqual([])
    expect(lampProblems([lamp({ range: 5.49 }), lamp({ range: 9.01 })], kinds, tone)).toHaveLength(2)
  })

  it('takes the tone it is given: the same lamp passes at the game’s tone and fails at a tighter one', () => {
    const shifted = lamp({ color: [1, 0.7432941176470589, 0.6078431372549019] })
    expect(lampProblems([shifted], kinds, 0.06)).toEqual([])
    expect(lampProblems([shifted], kinds, 0.05)[0]?.message).toMatch(
      /colour is 0\.059 from the archetype's, over 0\.05 \(OKLab\)/,
    )
  })

  it('says nothing for no lamps', () => {
    expect(lampProblems([], kinds, tone)).toEqual([])
  })
})

describe('lampProblems: the shipped files', () => {
  it.each(BLOCKOUT_NAMES)('passes the lamps of %s against the game’s own archetypes', (name) => {
    const blockout = JSON.parse(loadFixture(name)) as Blockout
    expect(lampProblems(blockout.lamps, kinds, tone)).toEqual([])
  })

  it('checks the lamps of the clinic that have a kind, and the bay has none that do', () => {
    const kinded = (name: (typeof BLOCKOUT_NAMES)[number]) =>
      (JSON.parse(loadFixture(name)) as Blockout).lamps.filter((l) => l.kind !== undefined).length
    expect(kinded('blockout-clinic')).toBe(15)
    expect(kinded('blockout-bay')).toBe(0)
  })
})
