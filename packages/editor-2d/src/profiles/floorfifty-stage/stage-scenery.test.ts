import { describe, expect, it } from 'vitest'
import type { StageCitySink, StagePhrase, StageValue } from './stage.schema'
import { citySinkAt, DEFAULT_LIGHT_HEIGHT, NEAR_CITY_FACTOR, resolveScenery } from './stage-scenery'
import { layer } from './testing/check-docs'
import { shippedStage } from './testing/shipped-stages'
import { documentOf, MINIMAL_STAGE } from './testing/stage-texts'

// The scenery a stage resolves to (FloorFifty `apps/client/src/systems/render/stage-presentation.ts`): the layers with
// their defaults, the light, the horizon lift and the ascent arc of the city. `composeStage` places them.

const minimal = documentOf(MINIMAL_STAGE).value
const rooftops = documentOf(shippedStage('rooftops')).value

function withTheme(theme: Partial<StageValue['theme']>, course?: StageValue['course']): StageValue {
  return { ...minimal, theme: { ...minimal.theme, ...theme }, course }
}

const PHRASES: readonly StagePhrase[] = [
  { name: 'teach', fromFloor: 1, toFloor: 5, purpose: 'a' },
  { name: 'combine', fromFloor: 6, toFloor: 10, purpose: 'b' },
  { name: 'recover', fromFloor: 11, toFloor: 14, purpose: 'c' },
  { name: 'finish', fromFloor: 15, toFloor: 19, purpose: 'd' },
]

function withArc(citySink: StageCitySink, phrases: readonly StagePhrase[] = PHRASES): StageValue {
  return {
    ...minimal,
    course: { seed: 1, phrases },
    theme: {
      ...minimal.theme,
      presentation: { profile: 'aquarian', refractionIntensity: 0, horizonLift: 0, citySink },
    },
  }
}

describe('resolveScenery layers', () => {
  it('keeps the layers in the file’s order, back to front', () => {
    const scenery = resolveScenery(
      withTheme({ layers: [layer('a', 'sky', 0.1), layer('b', 'city', 0.2), layer('c', 'city', 0.3)] }),
    )
    expect(scenery.layers.map((l) => l.alias)).toEqual(['a', 'b', 'c'])
  })

  it('fills in haze and drift with 0', () => {
    const [resolved] = resolveScenery(
      withTheme({ layers: [layer('a', 'city', 0.2, { sink: 90, extend: 'skirt' })] }),
    ).layers
    expect(resolved).toEqual({
      alias: 'a',
      plate: 'city',
      depth: 0.2,
      sink: 90,
      extend: 'skirt',
      haze: 0,
      arc: 0.2 / 0.35,
      drift: 0,
    })
  })

  it('shares a city layer’s arc by its depth over the near skyline’s, unless the file says', () => {
    expect(NEAR_CITY_FACTOR).toBe(0.35)
    const [far, near, set, zero] = resolveScenery(
      withTheme({
        layers: [
          layer('f', 'city', 0.15),
          layer('n', 'city', 0.35),
          layer('s', 'city', 0.4, { arc: 0.5 }),
          layer('z', 'city', 0.4, { arc: 0 }),
        ],
      }),
    ).layers
    expect(far?.arc).toBe(0.15 / 0.35)
    expect(near?.arc).toBe(1)
    expect(set?.arc).toBe(0.5)
    expect(zero?.arc).toBe(0)
  })

  it('gives a sky layer no arc, whatever the file says', () => {
    const [sky] = resolveScenery(withTheme({ layers: [layer('s', 'sky', 0.1, { arc: 1.5 })] })).layers
    expect(sky?.arc).toBe(0)
  })

  it('keeps the haze and the drift the file says', () => {
    const [resolved] = resolveScenery(
      withTheme({ layers: [layer('a', 'city', 0.2, { haze: 0.4, drift: 1.5 })] }),
    ).layers
    expect(resolved?.haze).toBe(0.4)
    expect(resolved?.drift).toBe(1.5)
  })
})

describe('resolveScenery light and lift', () => {
  it('has no light and no lift for a stage without presentation', () => {
    const scenery = resolveScenery(minimal)
    expect(scenery.lightAlias).toBeUndefined()
    expect(scenery.horizonLift).toBe(0)
    expect(scenery.lightHeight).toBe(DEFAULT_LIGHT_HEIGHT)
    expect(DEFAULT_LIGHT_HEIGHT).toBe(-60)
  })

  it('reads the light and the lift of the stage', () => {
    const scenery = resolveScenery(rooftops)
    expect(scenery.lightAlias).toBe('world.sun')
    expect(scenery.lightHeight).toBe(60)
    expect(scenery.horizonLift).toBe(24)
  })

  it('takes the default height when the presentation does not say, and keeps a height of 0', () => {
    const presented = (lightHeight?: number): StageValue =>
      withTheme({
        presentation: { profile: 'aquarian', refractionIntensity: 0, horizonLift: 8, lightHeight },
      })
    expect(resolveScenery(presented()).lightHeight).toBe(-60)
    expect(resolveScenery(presented(0)).lightHeight).toBe(0)
    expect(resolveScenery(presented()).horizonLift).toBe(8)
  })
})

describe('resolveScenery ascent arc', () => {
  it('puts each phrase’s value where the phrase ends, the finish at the top of the climb', () => {
    const scenery = resolveScenery(rooftops)
    expect(scenery.citySink).toEqual([
      { at: 0, sink: 0 },
      { at: 6 / 20, sink: 0 },
      { at: 12 / 20, sink: 40 },
      { at: 16 / 20, sink: 120 },
      { at: 1, sink: 560 },
    ])
  })

  it('holds a smaller value at the one before it, because a city rising again would read as the tower sinking', () => {
    const { citySink } = resolveScenery(withArc({ teach: 100, combine: 30, recover: 200, finish: 150 }))
    expect(citySink.map((k) => k.sink)).toEqual([0, 100, 100, 200, 200])
  })

  it('starts from 0 even when the first value is below it', () => {
    const { citySink } = resolveScenery(withArc({ teach: -50, combine: 0, recover: 0, finish: 10 }))
    expect(citySink.map((k) => k.sink)).toEqual([0, 0, 0, 0, 10])
  })

  it('orders the phrases by the floor they end on', () => {
    const shuffled = [PHRASES[3], PHRASES[0], PHRASES[2], PHRASES[1]] as readonly StagePhrase[]
    const { citySink } = resolveScenery(
      withArc({ teach: 10, combine: 20, recover: 30, finish: 40 }, shuffled),
    )
    expect(citySink.map((k) => k.sink)).toEqual([0, 10, 20, 30, 40])
    expect(citySink.map((k) => k.at)).toEqual([0, 6 / 20, 11 / 20, 15 / 20, 1])
  })

  it('has no arc without a course, without phrases, or without values', () => {
    const presentation = { profile: 'aquarian', refractionIntensity: 0, horizonLift: 0 } as const
    expect(
      resolveScenery(
        withTheme({
          presentation: { ...presentation, citySink: { teach: 1, combine: 2, recover: 3, finish: 4 } },
        }),
      ).citySink,
    ).toEqual([])
    expect(resolveScenery(withArc({ teach: 1, combine: 2, recover: 3, finish: 4 }, [])).citySink).toEqual([])
    expect(
      resolveScenery({ ...rooftops, theme: { ...rooftops.theme, presentation: presentation } }).citySink,
    ).toEqual([])
  })
})

describe('citySinkAt', () => {
  const scenery = resolveScenery(rooftops)

  it('is 0 where no arc is authored', () => {
    expect(citySinkAt(resolveScenery(minimal), 0.7)).toBe(0)
  })

  it('is the value at a knot', () => {
    expect(citySinkAt(scenery, 0)).toBe(0)
    expect(citySinkAt(scenery, 0.3)).toBe(0)
    expect(citySinkAt(scenery, 0.6)).toBeCloseTo(40, 9)
    expect(citySinkAt(scenery, 0.8)).toBeCloseTo(120, 9)
    expect(citySinkAt(scenery, 1)).toBe(560)
  })

  it('is linear between knots, so it moves continuously across a phrase boundary', () => {
    expect(citySinkAt(scenery, 0.45)).toBeCloseTo(20, 9)
    expect(citySinkAt(scenery, 0.7)).toBeCloseTo(80, 9)
    expect(citySinkAt(scenery, 0.9)).toBeCloseTo(340, 9)
  })

  it('reads a progress outside 0 to 1 as the nearer end', () => {
    expect(citySinkAt(scenery, -3)).toBe(0)
    expect(citySinkAt(scenery, 7)).toBe(560)
  })

  it('reads a progress outside 0 to 1 as the nearer end, also where the arc starts to slope at once', () => {
    const sloped = resolveScenery(withArc({ teach: 100, combine: 100, recover: 100, finish: 300 }))
    expect(citySinkAt(sloped, -1)).toBe(0)
    expect(citySinkAt(sloped, 2)).toBe(300)
  })

  it('does not divide by zero where a phrase ends before the first floor, at 0 of the climb', () => {
    const early = resolveScenery(
      withArc({ teach: 50, combine: 60, recover: 70, finish: 80 }, [
        { name: 'teach', fromFloor: 1, toFloor: -1, purpose: 'a' },
        { name: 'combine', fromFloor: 1, toFloor: 9, purpose: 'b' },
        { name: 'recover', fromFloor: 10, toFloor: 14, purpose: 'c' },
        { name: 'finish', fromFloor: 15, toFloor: 19, purpose: 'd' },
      ]),
    )
    expect(citySinkAt(early, 0)).toBe(50)
  })

  it('steps where two phrases end on one floor: the earlier value on the floor, the later just above it', () => {
    const twins = resolveScenery(
      withArc({ teach: 0, combine: 100, recover: 200, finish: 300 }, [
        { name: 'teach', fromFloor: 1, toFloor: 5, purpose: 'a' },
        { name: 'combine', fromFloor: 6, toFloor: 5, purpose: 'b' },
        { name: 'recover', fromFloor: 6, toFloor: 9, purpose: 'c' },
        { name: 'finish', fromFloor: 10, toFloor: 19, purpose: 'd' },
      ]),
    )
    expect(citySinkAt(twins, 0.3)).toBe(0)
    expect(citySinkAt(twins, 0.3001)).toBeGreaterThan(100)
    expect(citySinkAt(twins, 0.3001)).toBeLessThan(101)
  })
})
