import { describe, expect, it } from 'vitest'
import { checkSchema } from './check-schema'
import type { StageDocument } from './stage-document'
import { minimal, PHRASES, withCourse } from './testing/check-docs'
import { setAt } from './testing/stage-texts'

// The stage-level rules the vendored schema enforces, as findings (EDFF.1b decisions 1 and 2): the stage's identity, the
// aliases that may not be empty, the presentation's ranges and the shape of the course.

const error = (code: string, path: string, message: string, fix?: string) => ({
  severity: 'error',
  code,
  path,
  message,
  ...(fix === undefined ? {} : { fix }),
})

const check = (document: StageDocument) => checkSchema(document)

describe('identity', () => {
  it('finds nothing in a valid stage', () => {
    expect(check(minimal())).toEqual([])
  })

  it.each([
    ['Tiny Stage', 'The id "Tiny Stage" may only use lowercase letters, digits and hyphens.'],
    ['snow_shrine', 'The id "snow_shrine" may only use lowercase letters, digits and hyphens.'],
    ['', 'The stage needs an id.'],
  ])('refuses the id %j', (id, message) => {
    expect(check(setAt(minimal(), ['id'], id))).toEqual([error('id', 'id', message)])
  })

  it('accepts digits and hyphens in an id', () => {
    expect(check(setAt(minimal(), ['id'], 'stage-2-b'))).toEqual([])
  })

  it('checks the unlock the same way, and leaves an absent one alone', () => {
    expect(check(setAt(minimal(), ['unlock'], 'Day One'))).toEqual([
      error('id', 'unlock', 'The unlock "Day One" may only use lowercase letters, digits and hyphens.'),
    ])
    expect(check(setAt(minimal(), ['unlock'], ''))).toEqual([
      error('id', 'unlock', 'The unlock is empty; leave it out for a stage that is open from the start.'),
    ])
    expect(check(setAt(minimal(), ['unlock'], 'first-win'))).toEqual([])
    expect(check(setAt(minimal(), ['unlock'], undefined))).toEqual([])
  })

  it('refuses an empty name and one past the 48 characters the select screen has room for', () => {
    expect(check(setAt(minimal(), ['displayName'], ''))).toEqual([
      error('displayName', 'displayName', 'The stage needs a name.'),
    ])
    expect(check(setAt(minimal(), ['displayName'], 'x'.repeat(49)))).toEqual([
      error('displayName', 'displayName', 'The name is 49 characters; the select screen has room for 48.'),
    ])
    expect(check(setAt(minimal(), ['displayName'], 'x'.repeat(48)))).toEqual([])
  })
})

describe('aliases that may not be empty', () => {
  it.each([
    [['platformAlias'], 'platformAlias', 'The platform alias is empty.'],
    [['theme', 'backdropAlias'], 'theme.backdropAlias', 'The backdrop alias is empty.'],
    [
      ['theme', 'lightAlias'],
      'theme.lightAlias',
      'The light alias is empty; leave it out for a stage with no sun or moon.',
    ],
    [
      ['theme', 'previewAlias'],
      'theme.previewAlias',
      'The preview alias is empty; leave it out for a stage with no select-screen still.',
    ],
    [
      ['theme', 'ambienceAlias'],
      'theme.ambienceAlias',
      'The ambience alias is empty; leave it out for a stage with no ambience.',
    ],
  ] as const)('refuses an empty %j', (field, path, message) => {
    expect(check(setAt(minimal(), field, ''))).toEqual([error('emptyAlias', path, message)])
  })

  it('accepts the optional aliases when they are absent', () => {
    expect(check(setAt(minimal(), ['theme', 'lightAlias'], undefined))).toEqual([])
  })
})

describe('presentation ranges', () => {
  const presentation = { profile: 'aquarian', refractionIntensity: 0.4, horizonLift: 8 }
  const withPresentation = (changes: Record<string, unknown>) =>
    setAt(minimal(), ['theme', 'presentation'], { ...presentation, ...changes })

  it('accepts a presentation in range, at the bounds', () => {
    expect(check(withPresentation({}))).toEqual([])
    expect(
      check(
        withPresentation({
          refractionIntensity: 0.8,
          horizonLift: 48,
          lightHeight: 600,
          citySink: { teach: 0, combine: 720, recover: 1, finish: 2 },
        }),
      ),
    ).toEqual([])
    expect(check(withPresentation({ refractionIntensity: 0, horizonLift: 0, lightHeight: -200 }))).toEqual([])
  })

  it.each([
    [
      { refractionIntensity: 0.9 },
      'refractionIntensity',
      'Refraction intensity is 0.9; it goes from 0 to 0.8.',
    ],
    [
      { refractionIntensity: -0.1 },
      'refractionIntensity',
      'Refraction intensity is -0.1; it goes from 0 to 0.8.',
    ],
    [{ horizonLift: 49 }, 'horizonLift', 'Horizon lift is 49; it goes from 0 to 48.'],
    [{ lightHeight: 601 }, 'lightHeight', 'Light height is 601; it goes from -200 to 600.'],
    [{ lightHeight: -201 }, 'lightHeight', 'Light height is -201; it goes from -200 to 600.'],
    [
      { citySink: { teach: 721, combine: 0, recover: 0, finish: 0 } },
      'citySink.teach',
      'The city sink for the teach phrase is 721; it goes from 0 to 720.',
    ],
    [
      { citySink: { teach: 0, combine: -1, recover: 0, finish: 0 } },
      'citySink.combine',
      'The city sink for the combine phrase is -1; it goes from 0 to 720.',
    ],
    [
      { citySink: { teach: 0, combine: 0, recover: 721, finish: 0 } },
      'citySink.recover',
      'The city sink for the recover phrase is 721; it goes from 0 to 720.',
    ],
    [
      { citySink: { teach: 0, combine: 0, recover: 0, finish: 721 } },
      'citySink.finish',
      'The city sink for the finish phrase is 721; it goes from 0 to 720.',
    ],
  ])('refuses %j', (changes, field, message) => {
    expect(check(withPresentation(changes))).toEqual([
      error('presentationRange', `theme.presentation.${field}`, message),
    ])
  })

  it('says a value that is not a number is not a number', () => {
    expect(check(withPresentation({ horizonLift: Number.NaN }))).toEqual([
      error('presentationRange', 'theme.presentation.horizonLift', 'Horizon lift is not a number.'),
    ])
  })
})

describe('the course', () => {
  const course = { seed: 7, phrases: PHRASES }

  it('accepts the four phrases in order with an extension', () => {
    expect(check(withCourse(course))).toEqual([])
    expect(
      check(
        withCourse({ ...course, extension: [{ fromFloor: 20, toFloor: 30, purpose: 'The long climb' }] }),
      ),
    ).toEqual([])
  })

  it.each([1.5, -3])('refuses the seed %j', (seed) => {
    expect(check(withCourse({ ...course, seed }))).toEqual([
      error('seedInvalid', 'course.seed', `The seed ${seed} is not a whole number from 0.`),
    ])
  })

  it('accepts seed 0', () => {
    expect(check(withCourse({ ...course, seed: 0 }))).toEqual([])
  })

  const order =
    'The course needs the four phrases teach, combine, recover and finish, once each, in that order.'

  it('refuses phrases out of order, repeated, missing or too many', () => {
    const [teach, combine, recover, finish] = PHRASES as [
      (typeof PHRASES)[0],
      (typeof PHRASES)[1],
      (typeof PHRASES)[2],
      (typeof PHRASES)[3],
    ]
    for (const phrases of [
      [combine, teach, recover, finish],
      [teach, teach, recover, finish],
      [teach, combine, recover],
      [teach, combine, recover, finish, finish],
      [],
    ])
      expect(check(withCourse({ ...course, phrases }))).toEqual([
        error('phraseOrder', 'course.phrases', order),
      ])
  })

  it('refuses a floor that is not a whole number from 1, and a phrase that ends before it starts', () => {
    const phrases = (change: Partial<(typeof PHRASES)[number]>) =>
      PHRASES.map((phrase, i) => (i === 1 ? { ...phrase, ...change } : phrase))
    expect(check(withCourse({ ...course, phrases: phrases({ fromFloor: 0 }) }))).toEqual([
      error(
        'phraseRange',
        'course.phrases[1].fromFloor',
        'The combine phrase starts at floor 0; a floor is a whole number from 1.',
      ),
    ])
    expect(check(withCourse({ ...course, phrases: phrases({ toFloor: 7.5 }) }))).toEqual([
      error(
        'phraseRange',
        'course.phrases[1].toFloor',
        'The combine phrase ends at floor 7.5; a floor is a whole number from 1.',
      ),
    ])
    expect(check(withCourse({ ...course, phrases: phrases({ fromFloor: 8, toFloor: 7 }) }))).toEqual([
      error(
        'phraseRange',
        'course.phrases[1].toFloor',
        'The combine phrase ends at floor 7, before it starts at floor 8.',
      ),
    ])
    expect(check(withCourse({ ...course, phrases: phrases({ fromFloor: 8, toFloor: 8 }) }))).toEqual([])
  })

  it('says the same of the extension, by its id', () => {
    const extension = (entry: Record<string, unknown>) =>
      withCourse({
        ...course,
        extension: [
          { fromFloor: 20, toFloor: 25, purpose: 'First stretch' },
          { fromFloor: 26, toFloor: 30, purpose: 'Second stretch', ...entry },
        ],
      })
    expect(check(extension({ toFloor: 25 }))).toEqual([
      error(
        'phraseRange',
        'course.extension[b1].toFloor',
        'The extension entry 2 ends at floor 25, before it starts at floor 26.',
      ),
    ])
    expect(check(extension({ fromFloor: 0 }))).toEqual([
      error(
        'phraseRange',
        'course.extension[b1].fromFloor',
        'The extension entry 2 starts at floor 0; a floor is a whole number from 1.',
      ),
    ])
  })

  it('refuses an empty purpose, and one past 240 characters', () => {
    const phrases = (purpose: string) =>
      PHRASES.map((phrase, i) => (i === 2 ? { ...phrase, purpose } : phrase))
    expect(check(withCourse({ ...course, phrases: phrases('') }))).toEqual([
      error(
        'emptyPurpose',
        'course.phrases[2].purpose',
        'The recover phrase has no purpose; say what the player learns there.',
      ),
    ])
    expect(check(withCourse({ ...course, phrases: phrases('x'.repeat(241)) }))).toEqual([
      error(
        'purposeTooLong',
        'course.phrases[2].purpose',
        'The purpose of the recover phrase is 241 characters; the limit is 240.',
      ),
    ])
    expect(check(withCourse({ ...course, phrases: phrases('x'.repeat(240)) }))).toEqual([])
    expect(
      check(withCourse({ ...course, extension: [{ fromFloor: 20, toFloor: 25, purpose: '' }] })),
    ).toEqual([
      error(
        'emptyPurpose',
        'course.extension[b0].purpose',
        'The extension entry 1 has no purpose; say what the stretch is for.',
      ),
    ])
    expect(
      check(withCourse({ ...course, extension: [{ fromFloor: 20, toFloor: 25, purpose: 'x'.repeat(241) }] })),
    ).toEqual([
      error(
        'purposeTooLong',
        'course.extension[b0].purpose',
        'The purpose of the extension entry 1 is 241 characters; the limit is 240.',
      ),
    ])
  })
})
