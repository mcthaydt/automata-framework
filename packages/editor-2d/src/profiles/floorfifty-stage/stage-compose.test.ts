import { describe, expect, it } from 'vitest'
import { composeStage, SKIRT_HEIGHT } from './stage-compose'
import { resolveScenery, type Scenery } from './stage-scenery'
import { composeGoldens } from './testing/goldens'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf } from './testing/stage-texts'

// Where each layer of a stage stands for a climb (2D editor spec §10.4, decision FF-D4). The goldens are FloorFifty's own
// `StageLayers.update`, run on `pixi.js` by `testing/make-goldens.mjs`; every number must be equal to the last bit. The
// other tests pin the rules one at a time, on small sceneries.

const goldens = composeGoldens()

// JSON cannot carry a negative zero, and a position of -0 is the same place as 0.
const plain = (n: number): number => (n === 0 ? 0 : n)

describe.each(SHIPPED_STAGE_IDS)('composeStage against the game: %s', (id) => {
  const scenery = resolveScenery(documentOf(shippedStage(id)).value)
  const golden = goldens.stages[id]

  it('draws the layers in the game’s order, with its parallax factors', () => {
    const composition = composeStage(scenery, { cameraY: 0, progress: 0, timeSeconds: 0 })
    expect(composition.layers.map((l) => l.alias)).toEqual(golden?.labels)
    expect(composition.layers.map((l) => l.depth)).toEqual(golden?.factors)
  })

  it.each(
    goldens.states.flatMap((_, state) => goldens.framings.map((_, framing) => [state, framing] as const)),
  )(
    'places every layer, the light, the lift and the city as the game does (state %i, framing %i)',
    (stateIndex, framingIndex) => {
      const frame = golden?.frames.find((f) => f.state === stateIndex && f.framing === framingIndex)
      const state = goldens.states[stateIndex]
      const framing = goldens.framings[framingIndex]
      if (frame === undefined || state === undefined || framing === undefined)
        throw new Error('no such golden frame')

      const composition = composeStage(scenery, {
        ...state,
        framing: { ...framing, heights: goldens.heights },
      })

      expect(plain(composition.lift)).toBe(frame.lift)
      expect(plain(composition.citySink)).toBe(frame.citySink)
      expect(composition.light === undefined ? null : plain(composition.light.y)).toBe(frame.sunY)
      expect(
        composition.layers.map((l) => [l.alias, plain(l.y), l.tileX === undefined ? null : plain(l.tileX)]),
      ).toEqual(frame.layers)
    },
  )
})

// -- one rule at a time ------------------------------------------------------------------------------------------------

const baseScenery: Scenery = {
  lightAlias: undefined,
  lightHeight: -60,
  horizonLift: 0,
  citySink: [],
  layers: [],
}

function scene(...layers: Scenery['layers'][number][]): Scenery {
  return { ...baseScenery, layers }
}

const sky = (
  alias: string,
  depth: number,
  rest: Partial<Scenery['layers'][number]> = {},
): Scenery['layers'][number] => ({
  alias,
  plate: 'sky',
  depth,
  sink: 0,
  haze: 0,
  extend: 'none',
  arc: 0,
  drift: 0,
  ...rest,
})

const city = (
  alias: string,
  depth: number,
  rest: Partial<Scenery['layers'][number]> = {},
): Scenery['layers'][number] => ({
  alias,
  plate: 'city',
  depth,
  sink: 0,
  haze: 0,
  extend: 'none',
  arc: depth / 0.35,
  drift: 0,
  ...rest,
})

const at = { cameraY: 0, progress: 0, timeSeconds: 0 }

describe('composeStage rules', () => {
  it('stands a sky layer against the camera by what it lacks of full depth, plus its sink', () => {
    const [layer] = composeStage(scene(sky('s', 0.25, { sink: 40 })), { ...at, cameraY: 200 }).layers
    expect(layer?.y).toBe(-200 * (1 - 0.25) + 40)
  })

  it('keeps a small share of the camera for a city layer, and drops it by the arc’s share of the sink', () => {
    const arc = {
      ...scene(city('c', 0.35, { sink: 290, arc: 0.5 })),
      horizonLift: 10,
      citySink: [
        { at: 0, sink: 0 },
        { at: 1, sink: 100 },
      ],
    }
    const [layer] = composeStage(arc, {
      cameraY: 200,
      progress: 1,
      timeSeconds: 0,
      framing: { pixelsPerUnit: 0 },
    }).layers
    // -camera + camera x depth x 0.15, then sink, the arc’s share of the sunk city, and the lift.
    expect(layer?.y).toBe(-200 + 200 * 0.35 * 0.15 + 290 + 100 * 0.5 + 10)
  })

  it('eases the lift with the smoothstep of progress, and clamps progress', () => {
    const lifted = { ...scene(sky('s', 0.1)), horizonLift: 24 }
    expect(composeStage(lifted, { ...at, progress: 0.5 }).lift).toBe(12)
    expect(composeStage(lifted, { ...at, progress: 0.25 }).lift).toBe(24 * 0.25 * 0.25 * 2.5)
    expect(composeStage(lifted, { ...at, progress: -2 }).lift).toBe(0)
    expect(composeStage(lifted, { ...at, progress: 9 }).lift).toBe(24)
  })

  it('moves a layer with the lift', () => {
    const lifted = { ...scene(sky('s', 0.1), city('c', 0.2)), horizonLift: 24 }
    const [s, c] = composeStage(lifted, { ...at, progress: 1 }).layers
    expect(s?.y).toBe(24)
    expect(c?.y).toBe(24)
  })

  it('runs a tiled layer’s strip 4000 units below its art, so its foot stands that much lower', () => {
    expect(SKIRT_HEIGHT).toBe(4000)
    const [layer] = composeStage(scene(city('c', 0.4, { sink: 180, extend: 'tile' })), at).layers
    expect(layer?.y).toBe(180 + 4000)
  })

  it('tiles by the camera’s share, and by drift over time only when the layer drifts', () => {
    const drifting = scene(sky('a', 0.5, { drift: 2 }), sky('b', 0.5))
    const [a, b] = composeStage(drifting, { cameraY: 300, progress: 0, timeSeconds: 10 }).layers
    expect(a?.tileX).toBe(300 * 0.5 * 0.2 + 10 * 2)
    expect(b?.tileX).toBe(300 * 0.5 * 0.2)
  })

  it('does not drift backward: a negative drift is no drift, as in the game', () => {
    const [layer] = composeStage(scene(sky('a', 0.5, { drift: -2 })), {
      cameraY: 300,
      progress: 0,
      timeSeconds: 10,
    }).layers
    expect(layer?.tileX).toBe(300 * 0.5 * 0.2)
  })

  it('stands the light low behind the rooftops, moving against the camera almost not at all', () => {
    const lit = { ...scene(sky('s', 0.1)), lightAlias: 'world.sun', lightHeight: 60, horizonLift: 20 }
    const { light } = composeStage(lit, { cameraY: 500, progress: 1, timeSeconds: 0 })
    expect(light).toEqual({ alias: 'world.sun', y: -60 - 500 * (1 - 0.06) + 20, scale: 0.55, after: 0 })
  })

  it('has no light when the stage names none', () => {
    expect(composeStage(scene(sky('s', 0.1)), at).light).toBeUndefined()
  })

  it('reports the layer’s alias, plate, depth, extension and haze for the canvas', () => {
    const [layer] = composeStage(scene(city('c', 0.4, { haze: 0.3, extend: 'skirt' })), at).layers
    expect(layer).toMatchObject({ alias: 'c', plate: 'city', depth: 0.4, extend: 'skirt', haze: 0.3 })
  })
})

describe('composeStage plates', () => {
  const plate = sky('plate', 0.06, { extend: 'plate', sink: 440 })

  it('draws a sky plate that is the first sky layer first, and the light right after it', () => {
    const lit = { ...scene(city('far', 0.15), plate, sky('clouds', 0.1)), lightAlias: 'sun' }
    const { layers, light } = composeStage(lit, at)
    expect(layers.map((l) => l.alias)).toEqual(['plate', 'far', 'clouds'])
    expect(light?.after).toBe(1)
  })

  it('leaves a plate that is not the first sky layer where the list puts it', () => {
    const lit = { ...scene(sky('clouds', 0.1), city('far', 0.15), plate), lightAlias: 'sun' }
    const { layers, light } = composeStage(lit, at)
    expect(layers.map((l) => l.alias)).toEqual(['clouds', 'far', 'plate'])
    expect(light?.after).toBe(0)
  })

  it('does not tile a plate, and lowers it with the framing like the city', () => {
    const framed = scene(plate, city('c', 0.2, { sink: 100 }))
    const { layers } = composeStage(framed, { ...at, framing: { cityTopMin: 300, heights: { c: 150 } } })
    const [p, c] = layers
    expect(p?.tileX).toBeUndefined()
    // The city’s top starts at 100 - 150 = -50; the framing lowers everything by 350.
    expect(p?.y).toBe(440 + 350)
    expect(c?.y).toBe(100 + 350)
  })

  it('draws a plate as sky and gives it no arc, whatever plate the file says', () => {
    const odd = {
      ...scene({ ...city('odd', 0.2, { extend: 'plate', sink: 50 }) }),
      citySink: [
        { at: 0, sink: 0 },
        { at: 1, sink: 100 },
      ],
    }
    const [layer] = composeStage(odd, { cameraY: 100, progress: 1, timeSeconds: 0 }).layers
    expect(layer?.plate).toBe('sky')
    expect(layer?.y).toBe(-100 * (1 - 0.2) + 50)
  })
})

describe('composeStage framing', () => {
  const framed = scene(
    sky('s', 0.1, { sink: 10 }),
    city('far', 0.15, { sink: 240 }),
    city('near', 0.35, { sink: 290 }),
  )
  const heights = { far: 360, near: 440 }

  it('sinks the city until no strip starts above the line, and leaves the sky', () => {
    const [s, far, near] = composeStage(framed, { ...at, framing: { cityTopMin: 0, heights } }).layers
    // far starts at 240 - 360 = -120, near at 290 - 440 = -150: the highest is -150, so everything sinks 150.
    expect(s?.y).toBe(10)
    expect(far?.y).toBe(240 + 150)
    expect(near?.y).toBe(290 + 150)
  })

  it('never lifts the city: a line above every strip changes nothing', () => {
    const [, far] = composeStage(framed, { ...at, framing: { cityTopMin: -500, heights } }).layers
    expect(far?.y).toBe(240)
  })

  it('does nothing without a line, without heights, or when no city layer has a height', () => {
    expect(composeStage(framed, { ...at, framing: { heights } }).layers[1]?.y).toBe(240)
    expect(composeStage(framed, { ...at, framing: { cityTopMin: 0 } }).layers[1]?.y).toBe(240)
    expect(composeStage(framed, { ...at, framing: { cityTopMin: 0, heights: { s: 10 } } }).layers[1]?.y).toBe(
      240,
    )
  })

  it('leaves a layer with no height out of the framing, as the game leaves out a layer with no art', () => {
    const [, far, near] = composeStage(framed, {
      ...at,
      framing: { cityTopMin: 0, heights: { far: 360 } },
    }).layers
    expect(far?.y).toBe(240 + 120)
    expect(near?.y).toBe(290 + 120)
  })

  it('does not measure a plate, which is drawn with the sky even when the file says city', () => {
    const odd = scene(city('odd', 0.2, { extend: 'plate' }), city('c', 0.3, { sink: 100 }))
    const [plate, strip] = composeStage(odd, {
      ...at,
      framing: { cityTopMin: 0, heights: { odd: 500, c: 150 } },
    }).layers
    // Only c counts: its top starts at 100 - 150 = -50, so the framing sinks 50, not the 500 the plate would ask for.
    expect(strip?.y).toBe(150)
    expect(plate?.y).toBe(50)
  })

  it('rounds city layers to whole device pixels, not the sky', () => {
    const odd = scene(sky('s', 0.1, { sink: 0.3 }), city('c', 0.2, { sink: 0.3 }))
    const [s, c] = composeStage(odd, {
      cameraY: 3,
      progress: 0,
      timeSeconds: 0,
      framing: { pixelsPerUnit: 2 },
    }).layers
    expect(s?.y).toBe(-3 * (1 - 0.1) + 0.3)
    expect(c?.y).toBe(Math.round((-3 + 3 * 0.2 * 0.15 + 0.3 + 0 * (0.2 / 0.35)) * 2) / 2)
    expect(c?.tileX).toBe(Math.round(3 * 0.2 * 0.2 * 2) / 2)
  })

  it('rounds city layers to whole units when no scale is given, and nothing when the scale is 0', () => {
    const odd = scene(city('c', 0.2, { sink: 0.3 }), city('d', 0.2, { sink: 0.7 }))
    const [c, d] = composeStage(odd, at).layers
    expect([c?.y, d?.y]).toEqual([0, 1])
    const [raw] = composeStage(odd, { ...at, framing: { pixelsPerUnit: 0 } }).layers
    expect(raw?.y).toBe(0.3)
    expect(composeStage(odd, { ...at, framing: {} }).layers[0]?.y).toBe(0)
  })
})
