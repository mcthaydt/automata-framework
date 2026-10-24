import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { PHRASE_NAMES, stageSchema } from './stage.schema'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'

// The vendored stage schema (2D editor spec §10.2). The rules are FloorFifty's own; these tests pin each one so a
// refresh from a newer FloorFifty commit shows what changed.

type Json = Record<string, unknown>

const skyPlate = { alias: 'world.sky', plate: 'sky', depth: 0.1, sink: 0, extend: 'plate' }
const city = { alias: 'world.city', plate: 'city', depth: 0.3, sink: 100, extend: 'skirt' }

/** The smallest stage the schema accepts. */
const minimal = (): Json => ({
  id: 'tiny',
  displayName: 'Tiny',
  platformAlias: 'world.platform',
  courseTuning: {},
  theme: { backdropAlias: 'world.sky', layers: [skyPlate] },
})

const phrase = (name: string, fromFloor: number, toFloor: number) => ({
  name,
  fromFloor,
  toFloor,
  purpose: `${name} purpose`,
})
const course = (): Json => ({
  seed: 7,
  phrases: [
    phrase('teach', 1, 5),
    phrase('combine', 6, 11),
    phrase('recover', 12, 15),
    phrase('finish', 16, 19),
  ],
})

/** A copy of the minimal stage with `edit` applied. */
function stage(edit: (value: Json & { theme: Json & { layers: Json[] } }) => void): unknown {
  const value = minimal() as Json & { theme: Json & { layers: Json[] } }
  edit(value)
  return value
}

/** Where and why the schema refuses `value`: `path: message` per issue. */
function refusals(value: unknown): string[] {
  const result = stageSchema.safeParse(value)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('stage schema: what it accepts', () => {
  it.each(SHIPPED_STAGE_IDS)('accepts the shipped stage %s', (id) => {
    expect(refusals(parse(shippedStage(id)))).toEqual([])
  })

  it('accepts the smallest stage, with an empty set piece list by default', () => {
    const result = stageSchema.parse(minimal())
    expect(result.theme.setPieces).toEqual([])
  })

  it('names the four phrases in the order a player meets them', () => {
    expect(PHRASE_NAMES).toEqual(['teach', 'combine', 'recover', 'finish'])
  })
})

describe('stage schema: the stage', () => {
  it('refuses an id outside lower-case letters, digits and hyphens', () => {
    expect(refusals(stage((v) => (v.id = 'Roof_tops')))).toEqual([
      'id: Invalid string: must match pattern /^[a-z0-9-]+$/',
    ])
  })

  it('refuses a display name over 48 characters, and an empty one', () => {
    expect(refusals(stage((v) => (v.displayName = 'x'.repeat(49))))).toHaveLength(1)
    expect(refusals(stage((v) => (v.displayName = 'x'.repeat(48))))).toEqual([])
    expect(refusals(stage((v) => (v.displayName = ''))).join()).toContain('displayName')
  })

  it('refuses an unknown key at the root, in the theme, in a layer, in the presentation and in a set piece', () => {
    expect(refusals(stage((v) => (v.extra = 1)))).toHaveLength(1)
    expect(refusals(stage((v) => (v.theme.extra = 1)))).toHaveLength(1)
    expect(refusals(stage((v) => (v.theme.layers[0] = { ...skyPlate, extra: 1 })))).toHaveLength(1)
    expect(
      refusals(
        stage(
          (v) =>
            (v.theme.presentation = {
              profile: 'aquarian',
              refractionIntensity: 0,
              horizonLift: 0,
              extra: 1,
            }),
        ),
      ),
    ).toHaveLength(1)
    expect(
      refusals(stage((v) => (v.theme.setPieces = [{ kind: 'lightsOut', floor: 1, holdMs: 500, extra: 1 }]))),
    ).toHaveLength(1)
  })

  it('wants the platform and backdrop aliases to be non-empty', () => {
    expect(refusals(stage((v) => (v.platformAlias = '')))).toHaveLength(1)
    expect(refusals(stage((v) => (v.theme.backdropAlias = '')))).toHaveLength(1)
  })

  it('takes an unlock that is a content id', () => {
    expect(refusals(stage((v) => (v.unlock = 'first-win')))).toEqual([])
    expect(refusals(stage((v) => (v.unlock = 'First_Win')))).toHaveLength(1)
  })

  it('wants an optional alias to be non-empty when it is there', () => {
    for (const key of ['lightAlias', 'previewAlias', 'ambienceAlias'])
      expect(refusals(stage((v) => (v.theme[key] = ''))), key).toHaveLength(1)
  })

  it('refuses a course tuning value that is not a finite number', () => {
    expect(refusals(stage((v) => (v.courseTuning = { GRAVITY: Number.POSITIVE_INFINITY })))).toHaveLength(1)
    expect(refusals(stage((v) => (v.courseTuning = { GRAVITY: '9' })))).toHaveLength(1)
    expect(refusals(stage((v) => (v.courseTuning = { GRAVITY: -980 })))).toEqual([])
  })
})

describe('stage schema: the course', () => {
  const withCourse = (edit: (course: Json & { phrases: Json[] }) => void) =>
    stage((v) => {
      const c = course() as Json & { phrases: Json[] }
      edit(c)
      v.course = c
    })

  it('accepts a course with four phrases and an optional extension', () => {
    expect(refusals(withCourse(() => {}))).toEqual([])
    expect(
      refusals(withCourse((c) => (c.extension = [{ fromFloor: 20, toFloor: 29, purpose: 'more' }]))),
    ).toEqual([])
  })

  it('refuses a negative or fractional seed', () => {
    expect(refusals(withCourse((c) => (c.seed = -1)))).toHaveLength(1)
    expect(refusals(withCourse((c) => (c.seed = 1.5)))).toHaveLength(1)
    expect(refusals(withCourse((c) => (c.seed = 0)))).toEqual([])
  })

  it('refuses phrases that are not teach, combine, recover, finish once each in that order', () => {
    const expected = ['course.phrases: must name teach, combine, recover, finish exactly once, in that order']
    expect(refusals(withCourse((c) => c.phrases.reverse()))).toEqual(expected)
    expect(refusals(withCourse((c) => c.phrases.pop()))).toEqual(expected)
    expect(refusals(withCourse((c) => c.phrases.push(phrase('finish', 20, 21))))).toEqual(expected)
  })

  it('refuses a phrase whose end is below its start, or that starts below floor 1', () => {
    expect(refusals(withCourse((c) => (c.phrases[0] = phrase('teach', 5, 4))))).toEqual([
      'course.phrases.0.toFloor: must not be below fromFloor',
    ])
    expect(refusals(withCourse((c) => (c.phrases[0] = phrase('teach', 0, 4))))).toHaveLength(1)
  })

  it('refuses a phrase with no purpose or one over 240 characters', () => {
    expect(
      refusals(withCourse((c) => (c.phrases[1] = { ...phrase('combine', 6, 11), purpose: '' }))),
    ).toHaveLength(1)
    expect(
      refusals(withCourse((c) => (c.phrases[1] = { ...phrase('combine', 6, 11), purpose: 'x'.repeat(241) }))),
    ).toHaveLength(1)
    expect(
      refusals(withCourse((c) => (c.phrases[1] = { ...phrase('combine', 6, 11), purpose: 'x'.repeat(240) }))),
    ).toEqual([])
  })

  it('keeps the floors of an extension at 1 or more and wants a purpose', () => {
    const extension = (entry: Json) =>
      withCourse((c) => (c.extension = [{ fromFloor: 1, toFloor: 1, purpose: 'x', ...entry }]))
    expect(refusals(extension({}))).toEqual([])
    expect(refusals(extension({ fromFloor: 0 })).length).toBeGreaterThan(0)
    expect(refusals(extension({ fromFloor: 0, toFloor: 0 })).length).toBeGreaterThan(0)
    expect(refusals(extension({ purpose: '' })).length).toBeGreaterThan(0)
  })

  it('refuses an extension whose end is below its start', () => {
    expect(
      refusals(withCourse((c) => (c.extension = [{ fromFloor: 30, toFloor: 29, purpose: 'x' }]))),
    ).toEqual(['course.extension.0.toFloor: must not be below fromFloor'])
  })
})

describe('stage schema: the layers', () => {
  const layers = (...list: Json[]) =>
    stage((v) => {
      v.theme.layers = list
    })

  it('wants at least one layer', () => {
    expect(refusals(layers())).toHaveLength(1)
  })

  it.each([
    ['depth', -0.01, 1.01],
    ['sink', -721, 1441],
    ['haze', -0.1, 1.1],
  ])('keeps %s inside its range', (key, below, above) => {
    // A depth below 0 is also "further than" the empty start, so look for the range issue by its path.
    for (const value of [below, above])
      expect(
        refusals(layers({ ...city, [key]: value })).some((issue) =>
          issue.startsWith(`theme.layers.0.${key}:`),
        ),
        `${key} ${value}`,
      ).toBe(true)
  })

  it('keeps arc in 0 to 2 on a city layer and drift in 0 to 3', () => {
    expect(refusals(layers({ ...city, arc: 2.1 }))).toHaveLength(1)
    expect(refusals(layers({ ...city, arc: 2 }))).toEqual([])
    expect(refusals(layers({ ...city, drift: 3.1 }))).toHaveLength(1)
    expect(refusals(layers({ ...city, drift: 3 }))).toEqual([])
  })

  it('says a depth below 0 is too small, not merely out of order', () => {
    expect(refusals(layers({ ...city, depth: -0.5 })).join()).toContain('theme.layers.0.depth: Too small')
  })

  it('accepts the range ends of depth and sink', () => {
    expect(refusals(layers({ ...city, depth: 0, sink: -720 }))).toEqual([])
    expect(refusals(layers({ ...city, depth: 1, sink: 1440 }))).toEqual([])
  })

  it('refuses a plate or an extend it does not know', () => {
    expect(refusals(layers({ ...city, plate: 'ground' }))).toHaveLength(1)
    expect(refusals(layers({ ...city, extend: 'stretch' }))).toHaveLength(1)
  })

  it('allows a full-frame plate on a sky layer only', () => {
    expect(refusals(layers({ ...city, extend: 'plate' }))).toEqual([
      'theme.layers.0.extend: a full-frame plate is a sky picture: only with plate = "sky"',
    ])
  })

  it('allows the ascent arc on a city layer only', () => {
    expect(refusals(layers({ ...skyPlate, extend: 'none', arc: 0.5 }))).toEqual([
      'theme.layers.0.arc: the ascent arc moves the city; a sky layer has none',
    ])
  })

  it('refuses drift on a plate, and allows a drift of 0 on one', () => {
    expect(refusals(layers({ ...skyPlate, drift: 1 }))).toEqual([
      'theme.layers.0.drift: a sky plate is one picture and cannot drift',
    ])
    expect(refusals(layers({ ...skyPlate, drift: 0 }))).toEqual([])
  })

  it('wants a sky plate to be the first sky layer', () => {
    const cloud = { alias: 'world.cloud', plate: 'sky', depth: 0.05, sink: 0, extend: 'none' }
    expect(refusals(layers(cloud, skyPlate))).toEqual([
      'theme.layers.1.extend: a sky plate is drawn behind the light and the other sky layers, so it must be the first sky layer',
    ])
    // A city layer before the plate does not count: only sky layers are drawn behind the light.
    expect(refusals(layers(city, skyPlate))).toEqual([])
  })

  it('refuses a duplicate alias, naming the second', () => {
    expect(refusals(layers(city, { ...city, depth: 0.4 }))).toEqual([
      'theme.layers.1.alias: world.city is already in the list',
    ])
  })

  it('wants layers back to front within each plate', () => {
    expect(refusals(layers(city, { ...city, alias: 'world.far', depth: 0.1 }))).toEqual([
      'theme.layers.1.depth: is further than the city layer before it; list layers back to front',
    ])
    // The nearest layer so far is the bar, not just the one before: 0.5, then 0.2 (too far), then 0.4 (still too far).
    expect(
      refusals(
        layers(
          { ...city, depth: 0.5 },
          { ...city, alias: 'b', depth: 0.2 },
          { ...city, alias: 'c', depth: 0.4 },
        ),
      ),
    ).toEqual([
      'theme.layers.1.depth: is further than the city layer before it; list layers back to front',
      'theme.layers.2.depth: is further than the city layer before it; list layers back to front',
    ])
    // The plates are counted apart, and equal depths keep list order.
    expect(refusals(layers(city, { ...skyPlate, depth: 0.01 }, { ...city, alias: 'world.same' }))).toEqual([])
  })
})

describe('stage schema: the presentation', () => {
  const presentation = (extra: Json) =>
    stage((v) => {
      v.theme.presentation = { profile: 'aquarian', refractionIntensity: 0.4, horizonLift: 10, ...extra }
    })

  it('accepts a presentation with its optional keys', () => {
    expect(
      refusals(
        presentation({
          lightHeight: 100,
          lightShimmer: false,
          silhouette: true,
          citySink: { teach: 0, combine: 40, recover: 120, finish: 560 },
        }),
      ),
    ).toEqual([])
  })

  it.each([
    ['refractionIntensity', -0.1, 0.81],
    ['horizonLift', -1, 49],
    ['lightHeight', -201, 601],
  ])('keeps %s inside its range', (key, below, above) => {
    expect(refusals(presentation({ [key]: below })), `${key} ${below}`).toHaveLength(1)
    expect(refusals(presentation({ [key]: above })), `${key} ${above}`).toHaveLength(1)
  })

  it('knows one profile, aquarian', () => {
    expect(refusals(presentation({ profile: 'plain' }))).toHaveLength(1)
  })

  it('wants every phrase in citySink, each 0 to 720', () => {
    expect(refusals(presentation({ citySink: { teach: 0, combine: 0, recover: 0 } }))).toHaveLength(1)
    expect(
      refusals(presentation({ citySink: { teach: 0, combine: 0, recover: 0, finish: 721 } })),
    ).toHaveLength(1)
    expect(
      refusals(presentation({ citySink: { teach: -1, combine: 0, recover: 0, finish: 720 } })),
    ).toHaveLength(1)
  })
})

describe('stage schema: the set pieces', () => {
  const pieces = (...list: Json[]) =>
    stage((v) => {
      v.theme.setPieces = list
    })
  const base = { floor: 10, holdMs: 1000 }

  it('accepts one of each kind', () => {
    expect(
      refusals(
        pieces(
          { ...base, kind: 'lightsOut', invert: true },
          { ...base, kind: 'paletteShift', mood: 'night', stay: true },
          { ...base, kind: 'weatherBurst', particle: 'snow', density: 0.5, layers: ['world.sky'] },
          { ...base, kind: 'skyFlash', flashes: 3, tone: 'lightning', kick: 4 },
          { ...base, kind: 'swarm', layers: ['world.sky'], speed: 20 },
        ),
      ),
    ).toEqual([])
  })

  it('refuses a kind it does not know', () => {
    expect(refusals(pieces({ ...base, kind: 'fireworks' }))).toHaveLength(1)
  })

  it.each([
    ['floor', 0, 51],
    ['holdMs', 499, 20_001],
  ])('keeps %s inside its range', (key, below, above) => {
    expect(refusals(pieces({ ...base, kind: 'lightsOut', [key]: below })), `${key} ${below}`).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'lightsOut', [key]: above })), `${key} ${above}`).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'lightsOut', floor: 1, holdMs: 500 }))).toEqual([])
    expect(refusals(pieces({ ...base, kind: 'lightsOut', floor: 50, holdMs: 20_000 }))).toEqual([])
  })

  it('wants a mood from the list for a palette shift', () => {
    expect(refusals(pieces({ ...base, kind: 'paletteShift', mood: 'noon' }))).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'paletteShift' }))).toHaveLength(1)
  })

  it('keeps weather density in 0 to 1 and the particle to snow, rain or bubble', () => {
    expect(refusals(pieces({ ...base, kind: 'weatherBurst', particle: 'hail', density: 0.5 }))).toHaveLength(
      1,
    )
    expect(refusals(pieces({ ...base, kind: 'weatherBurst', particle: 'rain', density: 1.1 }))).toHaveLength(
      1,
    )
    expect(refusals(pieces({ ...base, kind: 'weatherBurst', particle: 'rain', density: -0.1 }))).toHaveLength(
      1,
    )
  })

  it('allows at most three flashes, at least one, and a kick of 0 to 4', () => {
    for (const flashes of [0, 4])
      expect(refusals(pieces({ ...base, kind: 'skyFlash', flashes, tone: 'aurora' }))).toHaveLength(1)
    expect(
      refusals(pieces({ ...base, kind: 'skyFlash', flashes: 1, tone: 'aurora', kick: 4.1 })),
    ).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'skyFlash', flashes: 1, tone: 'sunrise' }))).toHaveLength(1)
  })

  it('wants a swarm to name one to six layers and a speed of 1 to 20', () => {
    expect(refusals(pieces({ ...base, kind: 'swarm', layers: [], speed: 5 }))).toHaveLength(1)
    expect(
      refusals(pieces({ ...base, kind: 'swarm', layers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], speed: 5 })),
    ).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'swarm', layers: ['a'], speed: 0.9 }))).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'swarm', layers: ['a'], speed: 20.1 }))).toHaveLength(1)
    expect(refusals(pieces({ ...base, kind: 'swarm', layers: [''], speed: 5 }))).toHaveLength(1)
  })

  it('allows 16 set pieces and refuses 17', () => {
    const many = (n: number) => Array.from({ length: n }, () => ({ ...base, kind: 'lightsOut' }))
    expect(refusals(pieces(...many(16)))).toEqual([])
    expect(refusals(pieces(...many(17)))).toHaveLength(1)
  })
})

describe('stage schema: both ends of every range', () => {
  type Edit = (value: Json & { theme: Json & { layers: Json[] } }, field: string, n: number) => void

  const onCityLayer: Edit = (v, field, n) => {
    v.theme.layers = [{ ...city, [field]: n }]
  }
  const onPresentation: Edit = (v, field, n) => {
    v.theme.presentation = { profile: 'aquarian', refractionIntensity: 0.4, horizonLift: 10, [field]: n }
  }
  const onCitySink: Edit = (v, field, n) => {
    v.theme.presentation = {
      profile: 'aquarian',
      refractionIntensity: 0.4,
      horizonLift: 10,
      citySink: { teach: 0, combine: 0, recover: 0, finish: 0, [field]: n },
    }
  }
  const onPiece =
    (piece: Json): Edit =>
    (v, field, n) => {
      v.theme.setPieces = [{ floor: 10, holdMs: 1000, ...piece, [field]: n }]
    }

  // [where, field, lowest accepted, highest accepted, how to put a value there]
  const ranges: [string, string, number, number, Edit][] = [
    ['layer', 'depth', 0, 1, onCityLayer],
    ['layer', 'sink', -720, 1440, onCityLayer],
    ['layer', 'haze', 0, 1, onCityLayer],
    ['layer', 'arc', 0, 2, onCityLayer],
    ['layer', 'drift', 0, 3, onCityLayer],
    ['presentation', 'refractionIntensity', 0, 0.8, onPresentation],
    ['presentation', 'horizonLift', 0, 48, onPresentation],
    ['presentation', 'lightHeight', -200, 600, onPresentation],
    ['citySink', 'teach', 0, 720, onCitySink],
    ['citySink', 'combine', 0, 720, onCitySink],
    ['citySink', 'recover', 0, 720, onCitySink],
    ['citySink', 'finish', 0, 720, onCitySink],
    ['paletteShift', 'floor', 1, 50, onPiece({ kind: 'paletteShift', mood: 'day' })],
    ['paletteShift', 'holdMs', 500, 20_000, onPiece({ kind: 'paletteShift', mood: 'day' })],
    ['weatherBurst', 'density', 0, 1, onPiece({ kind: 'weatherBurst', particle: 'rain' })],
    ['skyFlash', 'flashes', 1, 3, onPiece({ kind: 'skyFlash', tone: 'aurora' })],
    ['skyFlash', 'kick', 0, 4, onPiece({ kind: 'skyFlash', tone: 'aurora', flashes: 1 })],
    ['swarm', 'speed', 1, 20, onPiece({ kind: 'swarm', layers: ['world.sky'] })],
  ]

  it.each(ranges)(
    '%s %s accepts %d and %d and refuses what lies beyond them',
    (_where, field, low, high, edit) => {
      const step =
        Number.isInteger(low) && Number.isInteger(high) && field !== 'refractionIntensity' ? 1 : 0.1
      for (const n of [low, high])
        expect(refusals(stage((v) => edit(v, field, n))), `${field} ${n}`).toEqual([])
      for (const n of [low - step, high + step])
        expect(
          refusals(stage((v) => edit(v, field, n))).some((issue) => issue.includes(field)),
          `${field} ${n}`,
        ).toBe(true)
    },
  )

  it('accepts a one-character string wherever a string must not be empty, and refuses an empty one', () => {
    const edits: [string, (v: Json & { theme: Json & { layers: Json[] } }, text: string) => void][] = [
      ['displayName', (v, text) => (v.displayName = text)],
      ['platformAlias', (v, text) => (v.platformAlias = text)],
      ['backdropAlias', (v, text) => (v.theme.backdropAlias = text)],
      ['lightAlias', (v, text) => (v.theme.lightAlias = text)],
      ['previewAlias', (v, text) => (v.theme.previewAlias = text)],
      ['ambienceAlias', (v, text) => (v.theme.ambienceAlias = text)],
      ['layer alias', (v, text) => (v.theme.layers = [{ ...skyPlate, alias: text }])],
      [
        'piece layer',
        (v, text) =>
          (v.theme.setPieces = [{ floor: 1, holdMs: 500, kind: 'swarm', layers: [text], speed: 1 }]),
      ],
    ]
    for (const [name, edit] of edits) {
      expect(refusals(stage((v) => edit(v, 'x'))), name).toEqual([])
      expect(refusals(stage((v) => edit(v, ''))).length, name).toBeGreaterThan(0)
    }
  })

  it('accepts one to six layers in a set piece and refuses none or seven', () => {
    const swarm = (n: number) =>
      stage((v) => {
        v.theme.setPieces = [
          {
            floor: 1,
            holdMs: 500,
            kind: 'swarm',
            layers: Array.from({ length: n }, (_, i) => `l${i}`),
            speed: 1,
          },
        ]
      })
    expect(refusals(swarm(1))).toEqual([])
    expect(refusals(swarm(6))).toEqual([])
    expect(refusals(swarm(0))).toHaveLength(1)
    expect(refusals(swarm(7))).toHaveLength(1)
  })

  it('accepts a phrase purpose of one character', () => {
    const value = stage((v) => {
      v.course = {
        seed: 0,
        phrases: [
          phrase('teach', 1, 1),
          phrase('combine', 2, 2),
          phrase('recover', 3, 3),
          phrase('finish', 4, 4),
        ].map((p) => ({ ...p, purpose: 'x' })),
      }
    })
    expect(refusals(value)).toEqual([])
  })
})
