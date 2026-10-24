import { describe, expect, it } from 'vitest'
import { checkLayers } from './check-layers'
import { layer, withLayers } from './testing/check-docs'

// The rules of the scenery layers (EDFF.1b decision 1), with the same messages the Compose view shows beside the field.

const error = (code: string, path: string, message: string, fix?: string) => ({
  severity: 'error',
  code,
  path,
  message,
  ...(fix === undefined ? {} : { fix }),
})

const check = (...layers: ReturnType<typeof layer>[]) => checkLayers(withLayers(layers))

describe('a valid composition', () => {
  it('finds nothing in a sky plate, a sky layer and two city layers back to front', () => {
    expect(
      check(
        layer('world.sky', 'sky', 0.1, { extend: 'plate' }),
        layer('sky.clouds', 'sky', 0.3, { drift: 0.5 }),
        layer('city.far', 'city', 0.2, { arc: 0.4 }),
        layer('city.near', 'city', 0.5, { haze: 0.3, arc: 1 }),
      ),
    ).toEqual([])
  })

  it('accepts every field at its bounds', () => {
    expect(
      check(
        layer('a', 'city', 0, { sink: -720, haze: 0, arc: 0, drift: 0 }),
        layer('b', 'city', 1, { sink: 1440, haze: 1, arc: 2, drift: 3 }),
      ),
    ).toEqual([])
  })

  it('lets layers of equal depth keep their list order', () => {
    expect(check(layer('a', 'city', 0.4), layer('b', 'city', 0.4))).toEqual([])
  })
})

describe('noLayers', () => {
  it('asks for at least one layer', () => {
    expect(check()).toEqual([
      error(
        'noLayers',
        'theme.layers',
        'The theme needs at least one layer; the scenery is drawn from them.',
      ),
    ])
  })
})

describe('layerRange', () => {
  it.each([
    ['depth', 1.2, 'city.near', 0, 1],
    ['depth', -0.1, 'city.near', 0, 1],
    ['sink', 1441, 'city.near', -720, 1440],
    ['sink', -721, 'city.near', -720, 1440],
    ['haze', 1.5, 'city.near', 0, 1],
    ['haze', -0.5, 'city.near', 0, 1],
    ['arc', 2.5, 'city.near', 0, 2],
    ['arc', -1, 'city.near', 0, 2],
    ['drift', 3.5, 'city.near', 0, 3],
    ['drift', -1, 'city.near', 0, 3],
  ] as const)('refuses %s %j', (field, value, alias, min, max) => {
    expect(
      check(
        layer(alias, 'city', field === 'depth' ? value : 0.5, field === 'depth' ? {} : { [field]: value }),
      ),
    ).toEqual([
      error(
        'layerRange',
        `theme.layers[b0].${field}`,
        `"${alias}" has ${field} ${value}; it goes from ${min} to ${max}.`,
      ),
    ])
  })

  it('says a value that is not a number is not a number', () => {
    expect(check(layer('city.near', 'city', Number.NaN))).toEqual([
      error('layerRange', 'theme.layers[b0].depth', 'The depth of "city.near" is not a number.'),
    ])
  })

  it('addresses the layer by its id, whatever its place in the list', () => {
    const [found] = check(
      layer('a', 'city', 0.1),
      layer('b', 'city', 0.2),
      layer('c', 'city', 0.3, { sink: 5000 }),
    )
    expect(found?.path).toBe('theme.layers[b2].sink')
  })
})

describe('what a layer may be', () => {
  it('keeps the full-frame plate to sky layers', () => {
    expect(check(layer('city.near', 'city', 0.5, { extend: 'plate' }))).toEqual([
      error(
        'plateOnlySky',
        'theme.layers[b0].extend',
        '"city.near" is a city layer; only a sky layer can be the full-frame plate.',
      ),
    ])
  })

  it('keeps the ascent arc to city layers, and allows it to be zero', () => {
    expect(check(layer('sky.far', 'sky', 0.5, { arc: 0 }))).toEqual([
      error(
        'arcOnlyCity',
        'theme.layers[b0].arc',
        '"sky.far" is a sky layer; the ascent arc moves the city, so a sky layer has none.',
      ),
    ])
  })

  it('does not let a sky plate drift, though other layers may, and a still plate may say drift = 0', () => {
    expect(check(layer('world.sky', 'sky', 0.1, { extend: 'plate', drift: 0.5 }))).toEqual([
      error(
        'driftOnPlate',
        'theme.layers[b0].drift',
        '"world.sky" is a sky plate, one picture that cannot drift.',
      ),
    ])
    expect(check(layer('world.sky', 'sky', 0.1, { extend: 'plate', drift: 0 }))).toEqual([])
    expect(check(layer('sky.clouds', 'sky', 0.1, { extend: 'tile', drift: 3 }))).toEqual([])
  })

  it('makes the sky plate the first sky layer, even with city layers before it', () => {
    expect(
      check(
        layer('sky.clouds', 'sky', 0.1),
        layer('city.far', 'city', 0.1),
        layer('world.sky', 'sky', 0.2, { extend: 'plate' }),
      ),
    ).toEqual([
      error(
        'plateFirst',
        'theme.layers[b2].extend',
        'The sky plate "world.sky" is drawn behind the light and the other sky layers, so it must be the first sky layer.',
      ),
    ])
    expect(
      check(layer('city.far', 'city', 0.1), layer('world.sky', 'sky', 0.1, { extend: 'plate' })),
    ).toEqual([])
  })

  it('names the second of two layers with the same alias', () => {
    expect(
      check(layer('city.near', 'city', 0.1), layer('city.far', 'city', 0.2), layer('city.near', 'city', 0.3)),
    ).toEqual([error('duplicateAlias', 'theme.layers[b2].alias', '"city.near" is already in the list.')])
  })

  it('says a layer has no alias when it has none, and does not call it a duplicate', () => {
    expect(check(layer('', 'city', 0.1), layer('', 'city', 0.2))).toEqual([
      error('emptyAlias', 'theme.layers[b0].alias', 'A layer has no alias.'),
      error('emptyAlias', 'theme.layers[b1].alias', 'A layer has no alias.'),
    ])
  })
})

describe('layerOrder', () => {
  it('names the nearer layer before it and offers the reorder', () => {
    expect(check(layer('city.near', 'city', 0.5), layer('city.mid', 'city', 0.2))).toEqual([
      error(
        'layerOrder',
        'theme.layers[b1].depth',
        '"city.mid" has depth 0.2, further than "city.near" (0.5) before it; list layers back to front.',
        'reorder-layers',
      ),
    ])
  })

  it('keeps each plate in its own order: a sky layer is not compared with the city', () => {
    expect(check(layer('city.near', 'city', 0.9), layer('sky.far', 'sky', 0.1))).toEqual([])
  })

  it('compares with the nearest layer of the plate so far, not only the one before', () => {
    expect(check(layer('a', 'city', 0.6), layer('b', 'city', 0.7), layer('c', 'city', 0.65))).toEqual([
      error(
        'layerOrder',
        'theme.layers[b2].depth',
        '"c" has depth 0.65, further than "b" (0.7) before it; list layers back to front.',
        'reorder-layers',
      ),
    ])
  })

  it('names the first of the layers at the nearest depth', () => {
    const found = check(layer('a', 'city', 0.5), layer('b', 'city', 0.5), layer('c', 'city', 0.2))
    expect(found.map((f) => f.message)).toEqual([
      '"c" has depth 0.2, further than "a" (0.5) before it; list layers back to front.',
    ])
  })

  it('reports each layer that is further than the nearest so far', () => {
    const found = check(layer('a', 'city', 0.9), layer('b', 'city', 0.1), layer('c', 'city', 0.2))
    expect(found.map((f) => f.path)).toEqual(['theme.layers[b1].depth', 'theme.layers[b2].depth'])
  })

  it('is not thrown off by a layer whose depth is not a number', () => {
    const found = check(layer('a', 'city', Number.NaN), layer('b', 'city', 0.5), layer('c', 'city', 0.2))
    expect(found.map((f) => `${f.code} ${f.path}`)).toEqual([
      'layerRange theme.layers[b0].depth',
      'layerOrder theme.layers[b2].depth',
    ])
  })

  it('still orders layers when one has the wrong plate for its extend', () => {
    const found = check(layer('a', 'city', 0.5, { extend: 'plate' }), layer('b', 'city', 0.2))
    expect(found.map((f) => f.code)).toEqual(['plateOnlySky', 'layerOrder'])
  })
})
