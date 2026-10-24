import { describe, expect, it } from 'vitest'
import { checkCourse } from './check-course'
import { resolveContext, type StageCheckContext } from './check-types'
import type { StageCourse } from './stage.schema'
import type { StageDocument } from './stage-document'
import { minimal, PHRASES, withCourse } from './testing/check-docs'

// The course against the climb it describes (EDFF.1b decision 4), by FloorFifty's `validate/course.ts` and its own cases.

const error = (code: string, path: string, message: string, fix?: string) => ({
  severity: 'error',
  code,
  path,
  message,
  ...(fix === undefined ? {} : { fix }),
})

const phrase = (name: 'teach' | 'combine' | 'recover' | 'finish', fromFloor: number, toFloor: number) => ({
  name,
  fromFloor,
  toFloor,
  purpose: 'Fixture phrase.',
})

const entry = (fromFloor: number, toFloor: number) => ({ fromFloor, toFloor, purpose: 'Fixture extension.' })

/** A course whose phrases tile floors 1 to 23: the climb of a stage with 24 floors. */
const TILING = [
  phrase('teach', 1, 6),
  phrase('combine', 7, 12),
  phrase('recover', 13, 18),
  phrase('finish', 19, 23),
]

const check = (
  course: Partial<StageCourse> | undefined,
  context: StageCheckContext = {},
  document?: StageDocument,
) =>
  checkCourse(
    document ?? (course === undefined ? minimal() : withCourse({ seed: 1, phrases: PHRASES, ...course })),
    resolveContext({ baseTuning: { COURSE_FLOOR_COUNT: 24 }, tallestFloor: 23, ...context }),
  )

describe('the phrases', () => {
  it('accepts phrases that tile the climb, and a stage with no course', () => {
    expect(check({ phrases: TILING })).toEqual([])
    expect(check(undefined)).toEqual([])
  })

  it('uses the default climb of 19 floors and the tallest course of 49 without a context', () => {
    const document = withCourse({ seed: 1, phrases: PHRASES, extension: [entry(20, 49)] })
    expect(checkCourse(document, resolveContext({}))).toEqual([])
  })

  it('reports a floor no phrase accounts for, with the repair', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 6),
          phrase('combine', 8, 12),
          phrase('recover', 13, 18),
          phrase('finish', 19, 23),
        ],
      }),
    ).toEqual([
      error(
        'floorsUnaccounted',
        'course.phrases',
        'No phrase accounts for floor 7; every floor a player climbs needs a recorded purpose.',
        'fit-phrases',
      ),
    ])
  })

  it('names every floor left out, as ranges', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 6),
          phrase('combine', 7, 12),
          phrase('recover', 14, 18),
          phrase('finish', 19, 20),
        ],
      }),
    ).toEqual([
      error(
        'floorsUnaccounted',
        'course.phrases',
        'No phrase accounts for floors 13, 21–23; every floor a player climbs needs a recorded purpose.',
        'fit-phrases',
      ),
    ])
  })

  it('reports a floor two phrases claim, on the later phrase', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 6),
          phrase('combine', 6, 12),
          phrase('recover', 13, 18),
          phrase('finish', 19, 23),
        ],
      }),
    ).toEqual([
      error(
        'phraseOverlap',
        'course.phrases[1]',
        'The combine phrase claims floor 6, which the teach phrase already has.',
      ),
    ])
  })

  it('reports a run of floors as one finding for each phrase that already has them', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 10),
          phrase('combine', 5, 14),
          phrase('recover', 8, 18),
          phrase('finish', 19, 23),
        ],
      }).map((finding) => finding.message),
    ).toEqual([
      'The combine phrase claims floors 5–10, which the teach phrase already has.',
      'The recover phrase claims floors 8–10, which the teach phrase already has.',
      'The recover phrase claims floors 11–14, which the combine phrase already has.',
    ])
  })

  it('reports a phrase that runs off the top of the course', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 6),
          phrase('combine', 7, 12),
          phrase('recover', 13, 18),
          phrase('finish', 19, 26),
        ],
      }),
    ).toEqual([
      error(
        'phrasePastTop',
        'course.phrases[3]',
        'The finish phrase claims floors 24–26, past the top of the course (floor 23).',
      ),
    ])
  })

  it('says a floor that is both claimed twice and past the top only once', () => {
    const found = check({
      phrases: [
        phrase('teach', 1, 6),
        phrase('combine', 7, 12),
        phrase('recover', 13, 30),
        phrase('finish', 25, 30),
      ],
    })
    expect(found.map((f) => `${f.code} ${f.path}`)).toEqual([
      'phrasePastTop course.phrases[2]',
      'phraseOverlap course.phrases[3]',
    ])
  })

  it('stays silent when the count of floors is itself out of range, which the tuning check reports', () => {
    const phrases = [
      phrase('teach', 1, 6),
      phrase('combine', 8, 12),
      phrase('recover', 13, 18),
      phrase('finish', 19, 23),
    ]
    expect(check({ phrases }, { baseTuning: { COURSE_FLOOR_COUNT: 5 } })).toEqual([])
    const document = withCourse({ seed: 1, phrases })
    const lengthened = {
      ...document,
      value: { ...document.value, courseTuning: { COURSE_FLOOR_COUNT: 101 } },
    }
    expect(check(undefined, {}, lengthened)).toEqual([])
  })

  it("measures against the stage's own tuning on top of the base", () => {
    const document = withCourse({ seed: 1, phrases: TILING })
    const lengthened = { ...document, value: { ...document.value, courseTuning: { COURSE_FLOOR_COUNT: 30 } } }
    expect(check(undefined, { tallestFloor: 29 }, lengthened).map((f) => f.message)).toEqual([
      'No phrase accounts for floors 24–29; every floor a player climbs needs a recorded purpose.',
    ])
  })

  it('does not judge a phrase whose floors are not whole numbers, which the shape check reports', () => {
    const found = check({
      phrases: [
        phrase('teach', 0, 6),
        phrase('combine', 7, 12),
        phrase('recover', 13, 18),
        phrase('finish', 19, 23),
      ],
    })
    expect(found.map((f) => f.code)).toEqual(['floorsUnaccounted'])
  })

  it('does not judge a phrase whose start is not a whole number either', () => {
    const found = check({
      phrases: [
        phrase('teach', 2.5, 6),
        phrase('combine', 7, 12),
        phrase('recover', 13, 18),
        phrase('finish', 19, 23),
      ],
    })
    expect(found.map((f) => f.message)).toEqual([
      'No phrase accounts for floors 1–6; every floor a player climbs needs a recorded purpose.',
    ])
  })

  it('counts a phrase of a single floor as claiming it', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 6),
          phrase('combine', 7, 7),
          phrase('recover', 8, 18),
          phrase('finish', 19, 23),
        ],
      }),
    ).toEqual([])
  })

  it('clips what a phrase shares to the phrase', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 1, 10),
          phrase('combine', 5, 7),
          phrase('recover', 11, 18),
          phrase('finish', 19, 23),
        ],
      }).map((f) => f.message),
    ).toEqual(['The combine phrase claims floors 5–7, which the teach phrase already has.'])
  })

  it('finds the overlap when an earlier phrase starts on the later one’s last floor', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 10, 15),
          phrase('combine', 1, 10),
          phrase('recover', 16, 18),
          phrase('finish', 19, 23),
        ],
      }).map((f) => f.message),
    ).toEqual(['The combine phrase claims floor 10, which the teach phrase already has.'])
  })

  it('counts the floors a phrase has beyond what an earlier phrase took', () => {
    // Floor 6 is combine's alone: teach has 1 to 5, and combine adds the one floor after it.
    expect(
      check({
        phrases: [
          phrase('teach', 1, 5),
          phrase('combine', 1, 6),
          phrase('recover', 7, 18),
          phrase('finish', 19, 23),
        ],
      }).map((f) => f.code),
    ).toEqual(['phraseOverlap'])
  })

  it('does not take two runs of an owner for one when floors lie between them', () => {
    // A name used twice (which the shape check refuses) leaves floors 4 to 6 unclaimed between its two runs.
    const found = check({
      phrases: [
        phrase('teach', 1, 3),
        phrase('teach', 7, 9),
        phrase('combine', 1, 9),
        phrase('finish', 10, 23),
      ],
    })
    expect(found.map((f) => f.message)).toEqual([
      'The combine phrase claims floors 1–3, 7–9, which the teach phrase already has.',
    ])
  })

  it('knows a claim made later in the list but earlier in the climb', () => {
    expect(
      check({
        phrases: [
          phrase('teach', 10, 15),
          phrase('combine', 1, 9),
          phrase('recover', 16, 18),
          phrase('finish', 19, 23),
        ],
      }),
    ).toEqual([])
  })

  it('does not walk a phrase floor by floor', () => {
    const started = Date.now()
    const found = check({
      phrases: [
        phrase('teach', 1, 6),
        phrase('combine', 7, 12),
        phrase('recover', 13, 18),
        phrase('finish', 19, 1e15),
      ],
    })
    expect(found.map((f) => f.code)).toEqual(['phrasePastTop'])
    expect(Date.now() - started).toBeLessThan(1000)
  })
})

describe('the extension', () => {
  const tall = { tallestFloor: 49 }
  const withExtension = (...entries: ReturnType<typeof entry>[]) =>
    check({ phrases: TILING, extension: entries }, tall)

  it('accepts entries that tile the floors above the top up to the tallest course', () => {
    expect(withExtension(entry(24, 29), entry(30, 39), entry(40, 49))).toEqual([])
  })

  it('names the floors no entry accounts for', () => {
    expect(withExtension(entry(24, 29), entry(31, 49))).toEqual([
      error(
        'extensionUnaccounted',
        'course.extension',
        'No extension entry accounts for floor 30; a mode climbs it, so it needs a recorded purpose.',
      ),
    ])
  })

  it('says a stage with no extension lacks all of them', () => {
    expect(check({ phrases: TILING }, tall)).toEqual([
      error(
        'extensionUnaccounted',
        'course.extension',
        'No extension entry accounts for floors 24–49; a mode climbs them, so they need a recorded purpose.',
      ),
    ])
  })

  it('reports an entry that claims a floor an earlier entry has, by its id', () => {
    expect(withExtension(entry(24, 30), entry(30, 49))).toEqual([
      error(
        'extensionOverlap',
        'course.extension[b1]',
        'The extension entry 2 claims floor 30, which extension entry 1 already has.',
      ),
    ])
  })

  it('reports an entry that starts on the top floor of the climb', () => {
    expect(withExtension(entry(23, 49))).toEqual([
      error(
        'extensionOverlap',
        'course.extension[b0]',
        'The extension entry 1 claims floor 23, which the four phrases already have.',
      ),
    ])
  })

  it('says a single missing floor, and the one floor above the top', () => {
    expect(check({ phrases: TILING }, { tallestFloor: 24 }).map((f) => f.message)).toEqual([
      'No extension entry accounts for floor 24; a mode climbs it, so it needs a recorded purpose.',
    ])
  })

  it('says them when the missing floors are a single floor and a run', () => {
    expect(withExtension(entry(24, 29), entry(31, 39), entry(42, 49)).map((f) => f.message)).toEqual([
      'No extension entry accounts for floors 30, 40–41; a mode climbs them, so they need a recorded purpose.',
    ])
  })

  it('does not count floors past the tallest course as taken by an entry', () => {
    expect(withExtension(entry(24, 52), entry(50, 55)).map((f) => `${f.code} ${f.message}`)).toEqual([
      'extensionPastTallest The extension entry 1 claims floors 50–52, past the tallest course (floor 49).',
      'extensionPastTallest The extension entry 2 claims floors 50–55, past the tallest course (floor 49).',
    ])
  })

  it('reports an entry that claims floors the four phrases have', () => {
    expect(withExtension(entry(22, 49))).toEqual([
      error(
        'extensionOverlap',
        'course.extension[b0]',
        'The extension entry 1 claims floors 22–23, which the four phrases already have.',
      ),
    ])
  })

  it('reports floors past the tallest course', () => {
    expect(withExtension(entry(24, 52))).toEqual([
      error(
        'extensionPastTallest',
        'course.extension[b0]',
        'The extension entry 1 claims floors 50–52, past the tallest course (floor 49).',
      ),
    ])
  })

  it('refuses an extension when no course climbs past the stage', () => {
    expect(check({ phrases: TILING, extension: [entry(24, 29)] })).toEqual([
      error(
        'extensionPastTallest',
        'course.extension[b0]',
        'The extension entry 1 claims floors 24–29, past the tallest course (floor 23).',
      ),
    ])
  })

  it('needs no extension when the stage already climbs as high as the tallest course', () => {
    expect(check({ phrases: TILING })).toEqual([])
  })

  it('does not judge an entry whose floors are not whole numbers', () => {
    expect(withExtension(entry(24, 29.5), entry(30, 49)).map((f) => f.code)).toEqual(['extensionUnaccounted'])
  })
})
