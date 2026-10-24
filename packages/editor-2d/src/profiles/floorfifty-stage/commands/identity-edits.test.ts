import { describe, expect, it } from 'vitest'
import { printStage } from '../stage-codec'
import { minimal } from '../testing/check-docs'
import { diffLines } from '../testing/diff-lines'
import { shippedStage } from '../testing/shipped-stages'
import { documentOf, MINIMAL_STAGE } from '../testing/stage-texts'
import {
  renameStage,
  setAmbienceAlias,
  setBackdropAlias,
  setCourseTuning,
  setLight,
  setPlatformAlias,
  setPreviewAlias,
  setStageId,
  setUnlock,
} from './identity-edits'

// The stage's identity, its five optional and required aliases and its tuning (EDFF.1d step 1, spec §10.6): each
// command changes its field and nothing else, and its printed text differs from the base in the lines that hold it.

const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))

describe('the required fields', () => {
  it('renameStage sets the name, keeps the ids, and is a no-op for the name it has', () => {
    const before = minimal()
    const after = renameStage(before, 'Roofs')
    expect(after.value).toEqual({ ...before.value, displayName: 'Roofs' })
    expect(after.ids).toBe(before.ids)
    expect(renameStage(before, before.value.displayName)).toBe(before)
  })

  it('setStageId sets the id', () => {
    const before = minimal()
    const after = setStageId(before, 'roofs')
    expect(after.value).toEqual({ ...before.value, id: 'roofs' })
    expect(after.ids).toBe(before.ids)
    expect(setStageId(before, before.value.id)).toBe(before)
  })

  it('setPlatformAlias sets the platform', () => {
    const before = minimal()
    const after = setPlatformAlias(before, 'world.other')
    expect(after.value).toEqual({ ...before.value, platformAlias: 'world.other' })
    expect(after.ids).toBe(before.ids)
    expect(setPlatformAlias(before, before.value.platformAlias)).toBe(before)
  })

  it('setBackdropAlias sets the backdrop and nothing else of the theme', () => {
    const before = minimal()
    const after = setBackdropAlias(before, 'world.other')
    expect(after.value).toEqual({
      ...before.value,
      theme: { ...before.value.theme, backdropAlias: 'world.other' },
    })
    expect(after.value.theme.layers).toBe(before.value.theme.layers)
    expect(after.ids).toBe(before.ids)
    expect(setBackdropAlias(before, before.value.theme.backdropAlias)).toBe(before)
  })

  it('each prints as the one line that holds the value', () => {
    const before = shippedStage('rooftops')
    const lines = (text: string): string[] => diffLines(before, text).added.map((line) => line.text)
    const print = (next: ReturnType<typeof rooftops>): string => printStage(before, next)
    expect(lines(print(renameStage(rooftops(), 'Roofs')))).toEqual(['displayName = "Roofs"'])
    expect(lines(print(setStageId(rooftops(), 'roofs')))).toEqual(['id = "roofs"'])
    expect(lines(print(setPlatformAlias(rooftops(), 'world.snowShrinePlatform')))).toEqual([
      'platformAlias = "world.snowShrinePlatform"',
    ])
    expect(lines(print(setBackdropAlias(rooftops(), 'world.cityFar')))).toEqual([
      'backdropAlias = "world.cityFar"',
    ])
  })
})

describe('the optional aliases', () => {
  const cases = [
    ['setLight', setLight, 'lightAlias', 'world.sun'],
    ['setPreviewAlias', setPreviewAlias, 'previewAlias', 'still.preview'],
    ['setAmbienceAlias', setAmbienceAlias, 'ambienceAlias', 'ambience.dawn'],
  ] as const

  for (const [name, command, key, alias] of cases) {
    it(`${name} adds the key, changes it, and drops it again`, () => {
      const before = minimal()
      const added = command(before, alias)
      expect(added.value.theme[key]).toBe(alias)
      const changed = command(added, 'world.other')
      expect(changed.value.theme[key]).toBe('world.other')
      const dropped = command(changed, undefined)
      expect(key in dropped.value.theme).toBe(false)
      expect(dropped.value).toEqual(before.value)
    })

    it(`${name} returns the same document when nothing changes`, () => {
      const before = minimal()
      expect(command(before, undefined)).toBe(before)
      const added = command(before, alias)
      expect(command(added, alias)).toBe(added)
    })
  }

  it('dropping the light removes its line and the comment above it', () => {
    const before = shippedStage('rooftops')
    const withoutLight = printStage(before, setLight(rooftops(), undefined))
    const removed = diffLines(before, withoutLight).removed.map((line) => line.text)
    expect(removed).toContain('lightAlias = "world.sun"')
    expect(removed).toContain(
      "# The sun. A theme that omits it draws none; the renderer names no stage's art",
    )
    expect(diffLines(before, withoutLight).added).toEqual([])
  })

  it('a minimal stage prints a new alias as one new line', () => {
    const next = printStage(MINIMAL_STAGE, setLight(minimal(), 'world.sun'))
    expect(diffLines(MINIMAL_STAGE, next)).toEqual({
      removed: [],
      added: [{ line: expect.any(Number), text: 'lightAlias = "world.sun"' }],
    })
  })
})

describe('setUnlock', () => {
  it('adds the condition, changes it and drops it', () => {
    const before = minimal()
    const added = setUnlock(before, 'first-win')
    expect(added.value.unlock).toBe('first-win')
    expect(setUnlock(added, undefined).value).toEqual(before.value)
    expect('unlock' in setUnlock(added, undefined).value).toBe(false)
    expect(setUnlock(before, undefined)).toBe(before)
    expect(setUnlock(added, 'first-win')).toBe(added)
  })

  it('prints as one line', () => {
    const next = printStage(MINIMAL_STAGE, setUnlock(minimal(), 'first-win'))
    expect(diffLines(MINIMAL_STAGE, next).added.map((line) => line.text)).toEqual(['unlock = "first-win"'])
    expect(diffLines(MINIMAL_STAGE, next).removed).toEqual([])
  })
})

describe('setCourseTuning', () => {
  it('adds a tunable, changes it, and removes it', () => {
    const before = minimal()
    const added = setCourseTuning(before, 'GRAVITY', 1500)
    expect(added.value.courseTuning).toEqual({ GRAVITY: 1500 })
    const changed = setCourseTuning(added, 'GRAVITY', 1600)
    expect(changed.value.courseTuning).toEqual({ GRAVITY: 1600 })
    const second = setCourseTuning(changed, 'COURSE_FLOOR_COUNT', 30)
    expect(second.value.courseTuning).toEqual({ GRAVITY: 1600, COURSE_FLOOR_COUNT: 30 })
    const removed = setCourseTuning(second, 'GRAVITY', undefined)
    expect(removed.value.courseTuning).toEqual({ COURSE_FLOOR_COUNT: 30 })
    expect('GRAVITY' in removed.value.courseTuning).toBe(false)
  })

  it('keeps the ids and everything else', () => {
    const before = rooftops()
    const after = setCourseTuning(before, 'GRAVITY', 1500)
    expect(after.ids).toBe(before.ids)
    expect(after.value.theme).toBe(before.value.theme)
    expect(after.value.course).toBe(before.value.course)
  })

  it('is the same document when nothing changes', () => {
    const before = minimal()
    expect(setCourseTuning(before, 'GRAVITY', undefined)).toBe(before)
    const added = setCourseTuning(before, 'GRAVITY', 1500)
    expect(setCourseTuning(added, 'GRAVITY', 1500)).toBe(added)
  })

  it('does not change the table it was given', () => {
    const before = setCourseTuning(minimal(), 'GRAVITY', 1500)
    setCourseTuning(before, 'GRAVITY', undefined)
    setCourseTuning(before, 'GRAVITY', 1)
    expect(before.value.courseTuning).toEqual({ GRAVITY: 1500 })
  })

  it('prints a new tunable as one line in the table, and its removal as that line going', () => {
    const added = printStage(MINIMAL_STAGE, setCourseTuning(minimal(), 'GRAVITY', 1500))
    expect(diffLines(MINIMAL_STAGE, added).added.map((line) => line.text)).toEqual(['GRAVITY = 1500'])
    expect(diffLines(MINIMAL_STAGE, added).removed).toEqual([])
    expect(added.indexOf('GRAVITY')).toBeGreaterThan(added.indexOf('[courseTuning]'))
    expect(added.indexOf('GRAVITY')).toBeLessThan(added.indexOf('[theme]'))
    const withIt = documentOf(added)
    const back = printStage(added, setCourseTuning(withIt, 'GRAVITY', undefined))
    expect(back).toBe(MINIMAL_STAGE)
  })
})
