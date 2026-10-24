import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import { createRng } from '../course-rng'
import { checkStage } from '../stage-checks'
import { printStage } from '../stage-codec'
import { minimal, PHRASES, withCourse } from '../testing/check-docs'
import { diffLines } from '../testing/diff-lines'
import { shippedStage } from '../testing/shipped-stages'
import { documentOf } from '../testing/stage-texts'
import {
  addCourse,
  addExtension,
  fitPhrasesToCourse,
  removeCourse,
  removeExtension,
  rerollSeed,
  setExtension,
  setPhrase,
  setSeed,
} from './course-edits'

// The Course view's edits (EDFF.1d step 4, spec §10.6): the seed, the four phrases that explain it, and the extension
// entries above them. A stage may have no course; every command but `addCourse` then refuses.

const course = {
  seed: 35229,
  phrases: PHRASES,
  extension: [{ fromFloor: 20, toFloor: 29, purpose: 'First stretch' }],
}
const two = withCourse({
  ...course,
  extension: [...course.extension, { fromFloor: 30, toFloor: 39, purpose: 'Second stretch' }],
})
const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))
const floors = (document: ReturnType<typeof minimal>): [number, number][] =>
  (document.value.course?.phrases ?? []).map((phrase) => [phrase.fromFloor, phrase.toFloor])

describe('addCourse', () => {
  const options = { seed: 7, top: 19, tallest: 49 }

  it('adds a course of four phrases that tile the floors 1 to the top', () => {
    const after = addCourse(minimal(), counterIds(), options)
    expect(after.value.course?.seed).toBe(7)
    expect(after.value.course?.phrases.map((phrase) => phrase.name)).toEqual([
      'teach',
      'combine',
      'recover',
      'finish',
    ])
    expect(floors(after)).toEqual([
      [1, 4],
      [5, 9],
      [10, 14],
      [15, 19],
    ])
  })

  it('records the floors above the top, up to the tallest course, as one extension entry', () => {
    const source = counterIds()
    const after = addCourse(minimal(), source, options)
    expect(after.value.course?.extension).toEqual([
      { fromFloor: 20, toFloor: 49, purpose: expect.any(String) },
    ])
    expect(after.ids.extension).toEqual(['00000001'])
    expect(source.next()).toBe('00000002')
  })

  it('adds no extension, and takes no id, when the course reaches the tallest', () => {
    const source = counterIds()
    const after = addCourse(minimal(), source, { seed: 7, top: 19, tallest: 19 })
    expect('extension' in (after.value.course ?? {})).toBe(false)
    expect(after.ids).toEqual(minimal().ids)
    expect(source.next()).toBe('00000001')
  })

  it('gives every purpose some text within the limit, and leaves the checks nothing to report', () => {
    const after = addCourse(minimal(), counterIds(), options)
    for (const { purpose } of [
      ...(after.value.course?.phrases ?? []),
      ...(after.value.course?.extension ?? []),
    ]) {
      expect(purpose.length).toBeGreaterThan(0)
      expect(purpose.length).toBeLessThanOrEqual(240)
    }
    expect(checkStage(after).filter((finding) => finding.severity === 'error')).toEqual([])
  })

  it('tiles any course from four floors up', () => {
    for (const top of [4, 5, 19, 49, 99]) {
      const after = addCourse(minimal(), counterIds(), { seed: 0, top, tallest: top })
      const spans = floors(after)
      expect(spans[0]?.[0], String(top)).toBe(1)
      expect(spans.at(-1)?.[1], String(top)).toBe(top)
      spans.forEach(([from, to], index) => {
        expect(to, `${top} phrase ${index}`).toBeGreaterThanOrEqual(from)
        if (index > 0) expect(from, `${top} phrase ${index}`).toBe((spans[index - 1]?.[1] ?? 0) + 1)
      })
    }
  })

  it('refuses a top that leaves a phrase without a floor, and a stage that has a course', () => {
    expect(() => addCourse(minimal(), counterIds(), { ...options, top: 3 })).toThrow(RangeError)
    expect(() => addCourse(minimal(), counterIds(), { ...options, top: 19.5 })).toThrow(RangeError)
    expect(() => addCourse(two, counterIds(), options)).toThrow('already has a course')
  })

  it('leaves a seed out of range for the checks, as setSeed does', () => {
    const after = addCourse(minimal(), counterIds(), { ...options, seed: -1 })
    expect(checkStage(after).map((finding) => finding.code)).toContain('seedInvalid')
  })

  it('prints as the course table, its four phrases and the entry, after the courseTuning table', () => {
    const base = shippedStage('dawn')
    const edited = addCourse(documentOf(base), counterIds(), options)
    const text = printStage(base, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    expect(text.indexOf('[course]')).toBeGreaterThan(text.indexOf('[courseTuning]'))
    expect(text.indexOf('[course]')).toBeLessThan(text.indexOf('[theme]'))
    expect(diffLines(base, text).removed).toEqual([])
  })
})

describe('removeCourse', () => {
  it('drops the course and the ids of its extension', () => {
    const after = removeCourse(two)
    expect(after.value.course).toBeUndefined()
    expect('course' in after.value).toBe(false)
    expect(after.ids.extension).toEqual([])
  })

  it('is the same document when there is none', () => {
    const before = minimal()
    expect(removeCourse(before)).toBe(before)
  })

  it('removes the tables from the text', () => {
    const text = printStage(shippedStage('rooftops'), removeCourse(rooftops()))
    expect(text).not.toContain('[course]')
    expect(text).not.toContain('[[course.phrases]]')
    expect(documentOf(text).value.course).toBeUndefined()
  })
})

describe('setSeed and rerollSeed', () => {
  it('sets the seed and keeps the phrases', () => {
    const after = setSeed(two, 99)
    expect(after.value.course).toEqual({ ...two.value.course, seed: 99 })
    expect(after.value.course?.phrases).toBe(two.value.course?.phrases)
    expect(after.ids).toBe(two.ids)
  })

  it('is the same document for the seed it has', () => {
    expect(setSeed(two, 35229)).toBe(two)
  })

  it('prints as the one line that holds the seed', () => {
    const before = shippedStage('rooftops')
    const diff = diffLines(before, printStage(before, setSeed(rooftops(), 1234)))
    expect(diff.added.map((line) => line.text)).toEqual(['seed = 1234'])
    expect(diff.removed.map((line) => line.text)).toEqual(['seed = 35229'])
  })

  it('rerolls from the rng it is given: a whole number from 0 to 99 999, deterministic for the rng', () => {
    const a = rerollSeed(two, createRng(5))
    const b = rerollSeed(two, createRng(5))
    expect(a.value.course?.seed).toBe(b.value.course?.seed)
    for (let salt = 0; salt < 200; salt++) {
      const seed = rerollSeed(two, createRng(salt)).value.course?.seed ?? -1
      expect(Number.isInteger(seed), String(salt)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(99_999)
    }
  })

  it('never rerolls to the seed the course has, even when the draw lands on it', () => {
    const sameDraw = { nextInt: () => 35229 }
    expect(rerollSeed(two, sameDraw).value.course?.seed).toBe(35230)
    const lastDraw = withCourse({ ...course, seed: 99_999 })
    expect(rerollSeed(lastDraw, { nextInt: () => 99_999 }).value.course?.seed).toBe(0)
  })

  it('asks the rng for the range once', () => {
    const asked: [number, number][] = []
    rerollSeed(two, {
      nextInt: (min, max) => {
        asked.push([min, max])
        return 5
      },
    })
    expect(asked).toEqual([[0, 99_999]])
  })

  it('refuse a stage with no course', () => {
    expect(() => setSeed(minimal(), 1)).toThrow('no course')
    expect(() => rerollSeed(minimal(), createRng(1))).toThrow('no course')
  })
})

describe('setPhrase', () => {
  it('sets a floor or the purpose of the phrase named, and no other', () => {
    const after = setPhrase(two, 'combine', 'toFloor', 11)
    expect(after.value.course?.phrases[1]).toEqual({ ...PHRASES[1], toFloor: 11 })
    expect(after.value.course?.phrases[0]).toBe(PHRASES[0])
    expect(after.value.course?.phrases[2]).toBe(PHRASES[2])
    expect(setPhrase(two, 'finish', 'fromFloor', 16).value.course?.phrases[3]?.fromFloor).toBe(16)
    expect(setPhrase(two, 'teach', 'purpose', 'New').value.course?.phrases[0]?.purpose).toBe('New')
    expect(after.ids).toBe(two.ids)
  })

  it('is the same document for the value it has', () => {
    expect(setPhrase(two, 'teach', 'fromFloor', 1)).toBe(two)
  })

  it('refuses a stage with no course and a phrase the course does not have', () => {
    expect(() => setPhrase(minimal(), 'teach', 'fromFloor', 1)).toThrow('no course')
    const odd = withCourse({ seed: 1, phrases: PHRASES.slice(0, 2) })
    expect(() => setPhrase(odd, 'finish', 'fromFloor', 1)).toThrow('no finish phrase')
  })

  it('leaves a range that does not fit to the checks', () => {
    const after = setPhrase(two, 'teach', 'toFloor', 8)
    expect(checkStage(after).some((finding) => finding.code === 'phraseOverlap')).toBe(true)
  })
})

describe('fitPhrasesToCourse', () => {
  const fitted = (overrides: [number, number][], top = 19): [number, number][] => {
    const phrases = PHRASES.map((phrase, index) => ({
      ...phrase,
      fromFloor: overrides[index]?.[0] ?? phrase.fromFloor,
      toFloor: overrides[index]?.[1] ?? phrase.toFloor,
    }))
    return floors(fitPhrasesToCourse(withCourse({ seed: 1, phrases }), top))
  }

  it('is the same document when the phrases already tile 1 to the top', () => {
    const before = withCourse({ seed: 1, phrases: PHRASES })
    expect(fitPhrasesToCourse(before, 19)).toBe(before)
  })

  it('stretches the last phrase over floors nobody claims above it (FF-f)', () => {
    expect(
      fitted([
        [1, 5],
        [6, 10],
        [11, 14],
        [15, 17],
      ]),
    ).toEqual([
      [1, 5],
      [6, 10],
      [11, 14],
      [15, 19],
    ])
  })

  it('lets a phrase absorb a gap after it', () => {
    expect(
      fitted([
        [1, 5],
        [6, 8],
        [11, 14],
        [15, 19],
      ]),
    ).toEqual([
      [1, 5],
      [6, 10],
      [11, 14],
      [15, 19],
    ])
  })

  it('trims an overlap from the earlier phrase: the later start stands', () => {
    expect(
      fitted([
        [1, 7],
        [6, 10],
        [11, 14],
        [15, 19],
      ]),
    ).toEqual([
      [1, 5],
      [6, 10],
      [11, 14],
      [15, 19],
    ])
  })

  it('starts the first phrase at floor 1', () => {
    expect(
      fitted([
        [3, 5],
        [6, 10],
        [11, 14],
        [15, 19],
      ])[0],
    ).toEqual([1, 5])
  })

  it('shortens the course to a new top', () => {
    expect(
      fitted(
        [
          [1, 5],
          [6, 10],
          [11, 14],
          [15, 19],
        ],
        12,
      ),
    ).toEqual([
      [1, 5],
      [6, 10],
      [11, 11],
      [12, 12],
    ])
  })

  it('leaves a floor for every phrase after the one it places', () => {
    expect(
      fitted(
        [
          [1, 5],
          [6, 10],
          [11, 14],
          [15, 19],
        ],
        10,
      ),
    ).toEqual([
      [1, 5],
      [6, 8],
      [9, 9],
      [10, 10],
    ])
  })

  it('tiles the least course there is, one floor to a phrase', () => {
    expect(
      fitted(
        [
          [1, 5],
          [6, 10],
          [11, 14],
          [15, 19],
        ],
        4,
      ),
    ).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ])
  })

  it('moves a start that is out of order just far enough', () => {
    expect(
      fitted([
        [1, 5],
        [4, 10],
        [3, 14],
        [15, 19],
      ]),
    ).toEqual([
      [1, 3],
      [4, 4],
      [5, 14],
      [15, 19],
    ])
  })

  it('treats a start that is not a whole number as missing', () => {
    expect(
      fitted([
        [1, 5],
        [Number.NaN, 10],
        [11, 14],
        [15, 19],
      ]),
    ).toEqual([
      [1, 1],
      [2, 10],
      [11, 14],
      [15, 19],
    ])
  })

  it('keeps names and purposes, and the extension and ids as they were', () => {
    const before = withCourse({
      seed: 1,
      phrases: PHRASES.map((phrase, index) => ({ ...phrase, toFloor: index === 3 ? 17 : phrase.toFloor })),
      extension: [{ fromFloor: 20, toFloor: 25, purpose: 'x' }],
    })
    const after = fitPhrasesToCourse(before, 19)
    expect(after.value.course?.phrases.map((phrase) => [phrase.name, phrase.purpose])).toEqual(
      PHRASES.map((phrase) => [phrase.name, phrase.purpose]),
    )
    expect(after.value.course?.extension).toBe(before.value.course?.extension)
    expect(after.ids).toBe(before.ids)
    expect(after.value.course?.seed).toBe(1)
  })

  it('clears floorsUnaccounted (FF-f)', () => {
    const short = setPhrase(withCourse({ seed: 1, phrases: PHRASES }), 'finish', 'toFloor', 17)
    expect(checkStage(short).map((finding) => finding.code)).toContain('floorsUnaccounted')
    const after = fitPhrasesToCourse(short, 19)
    expect(checkStage(after).map((finding) => finding.code)).not.toContain('floorsUnaccounted')
  })

  it('refuses a top with fewer floors than phrases, and a stage with no course', () => {
    expect(() => fitPhrasesToCourse(withCourse({ seed: 1, phrases: PHRASES }), 3)).toThrow(RangeError)
    expect(() => fitPhrasesToCourse(withCourse({ seed: 1, phrases: PHRASES }), 7.5)).toThrow(RangeError)
    expect(() => fitPhrasesToCourse(minimal(), 19)).toThrow('no course')
  })
})

describe('the extension', () => {
  const entry = { fromFloor: 40, toFloor: 49, purpose: 'The run home' }

  it('adds an entry at the end, with an id from the source', () => {
    const after = addExtension(two, counterIds(), entry)
    expect(after.value.course?.extension).toEqual([...(two.value.course?.extension ?? []), entry])
    expect(after.ids.extension).toEqual(['b0', 'b1', '00000001'])
  })

  it('refuses an id the document already has', () => {
    expect(() => addExtension(two, { next: () => 'b0' }, entry)).toThrow(RangeError)
  })

  it('makes the list when the course has none', () => {
    const bare = withCourse({ seed: 1, phrases: PHRASES })
    const after = addExtension(bare, counterIds(), entry)
    expect(after.value.course?.extension).toEqual([entry])
    expect(after.ids.extension).toEqual(['00000001'])
  })

  it('sets a field of one entry and no other', () => {
    const after = setExtension(two, 1, 'toFloor', 45)
    expect(after.value.course?.extension?.[1]).toEqual({ ...two.value.course?.extension?.[1], toFloor: 45 })
    expect(after.value.course?.extension?.[0]).toBe(two.value.course?.extension?.[0])
    expect(after.ids).toBe(two.ids)
    expect(setExtension(two, 0, 'fromFloor', 20)).toBe(two)
    expect(setExtension(two, 0, 'purpose', 'New').value.course?.extension?.[0]?.purpose).toBe('New')
  })

  it('removes an entry and its id', () => {
    const after = removeExtension(two, 0)
    expect(after.value.course?.extension).toEqual([two.value.course?.extension?.[1]])
    expect(after.ids.extension).toEqual(['b1'])
  })

  it('leaves the list unset, not empty, when the last entry goes', () => {
    const one = withCourse(course)
    const after = removeExtension(one, 0)
    expect('extension' in (after.value.course ?? {})).toBe(false)
    expect(after.ids.extension).toEqual([])
  })

  it('refuses an entry that is not there and a stage with no course', () => {
    expect(() => removeExtension(two, 2)).toThrow(RangeError)
    expect(() => setExtension(two, -1, 'purpose', 'x')).toThrow(RangeError)
    expect(() => addExtension(minimal(), counterIds(), entry)).toThrow('no course')
    const bare = withCourse({ seed: 1, phrases: PHRASES })
    expect(() => removeExtension(bare, 0)).toThrow(RangeError)
  })

  it('prints an added entry as a new table after the others', () => {
    const base = shippedStage('rooftops')
    const edited = addExtension(documentOf(base), counterIds(), {
      fromFloor: 40,
      toFloor: 49,
      purpose: 'More',
    })
    const text = printStage(base, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    expect(diffLines(base, text).removed).toEqual([])
  })
})
