import { describe, expect, it } from 'vitest'
import { printStage } from '../stage-codec'
import { minimal } from '../testing/check-docs'
import { diffLines } from '../testing/diff-lines'
import { shippedStage } from '../testing/shipped-stages'
import { documentOf, MINIMAL_STAGE } from '../testing/stage-texts'
import { removeCitySink, removePresentation, setCitySink, setPresentation } from './presentation-edits'

// The stage's presentation block and the city's ascent arc (EDFF.1d step 2, spec §10.6).

const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))
const dawn = (): ReturnType<typeof documentOf> => documentOf(shippedStage('dawn'))

describe('setPresentation', () => {
  it('creates the block with neutral values when the stage has none', () => {
    const after = setPresentation(minimal(), 'horizonLift', 12)
    expect(after.value.theme.presentation).toEqual({
      profile: 'aquarian',
      refractionIntensity: 0,
      horizonLift: 12,
    })
  })

  it('sets each field of an existing block and keeps the others', () => {
    const before = dawn()
    const refraction = setPresentation(before, 'refractionIntensity', 0.6)
    expect(refraction.value.theme.presentation).toEqual({
      ...before.value.theme.presentation,
      refractionIntensity: 0.6,
    })
    expect(setPresentation(before, 'horizonLift', 20).value.theme.presentation?.horizonLift).toBe(20)
    expect(setPresentation(before, 'lightHeight', -80).value.theme.presentation?.lightHeight).toBe(-80)
    expect(setPresentation(before, 'lightShimmer', true).value.theme.presentation?.lightShimmer).toBe(true)
    expect(setPresentation(before, 'silhouette', false).value.theme.presentation?.silhouette).toBe(false)
  })

  it('drops an optional field when given undefined', () => {
    const before = setPresentation(dawn(), 'lightHeight', -80)
    const after = setPresentation(before, 'lightHeight', undefined)
    expect('lightHeight' in (after.value.theme.presentation ?? {})).toBe(false)
    expect(after.value).toEqual(dawn().value)
  })

  it('keeps the ids, the layers and the arc', () => {
    const before = rooftops()
    const after = setPresentation(before, 'horizonLift', 20)
    expect(after.ids).toBe(before.ids)
    expect(after.value.theme.layers).toBe(before.value.theme.layers)
    expect(after.value.theme.presentation?.citySink).toBe(before.value.theme.presentation?.citySink)
  })

  it('is the same document when nothing changes', () => {
    const before = dawn()
    expect(setPresentation(before, 'horizonLift', 12)).toBe(before)
    expect(setPresentation(before, 'lightHeight', undefined)).toBe(before)
    const bare = minimal()
    expect(setPresentation(bare, 'lightHeight', undefined)).toBe(bare)
  })

  it('prints a changed value as the one line that holds it', () => {
    const before = shippedStage('dawn')
    const next = printStage(before, setPresentation(dawn(), 'horizonLift', 20))
    expect(diffLines(before, next).added.map((line) => line.text)).toEqual(['horizonLift = 20'])
    expect(diffLines(before, next).removed.map((line) => line.text)).toEqual(['horizonLift = 12'])
  })

  it('prints a new block as a table after the layers', () => {
    const next = printStage(MINIMAL_STAGE, setPresentation(minimal(), 'horizonLift', 12))
    expect(next).toContain(
      '[theme.presentation]\nprofile = "aquarian"\nrefractionIntensity = 0\nhorizonLift = 12',
    )
    expect(documentOf(next).value).toEqual(setPresentation(minimal(), 'horizonLift', 12).value)
  })
})

describe('removePresentation', () => {
  it('drops the block, the arc with it', () => {
    const after = removePresentation(rooftops())
    expect('presentation' in after.value.theme).toBe(false)
  })

  it('is the same document when there is none', () => {
    const before = minimal()
    expect(removePresentation(before)).toBe(before)
  })

  it('removes the table and its comment from the text', () => {
    const before = shippedStage('dawn')
    const next = printStage(before, removePresentation(dawn()))
    expect(next).not.toContain('[theme.presentation]')
    expect(documentOf(next).value.theme.presentation).toBeUndefined()
  })
})

describe('setCitySink', () => {
  it('creates the block and the arc when the stage has neither, with zeros for the other phrases', () => {
    const after = setCitySink(minimal(), 'recover', 300)
    expect(after.value.theme.presentation).toEqual({
      profile: 'aquarian',
      refractionIntensity: 0,
      horizonLift: 0,
      citySink: { teach: 0, combine: 0, recover: 300, finish: 0 },
    })
  })

  it('creates the arc in an existing block', () => {
    const before = dawn()
    const after = setCitySink(before, 'teach', 50)
    expect(after.value.theme.presentation).toEqual({
      ...before.value.theme.presentation,
      citySink: { teach: 50, combine: 0, recover: 0, finish: 0 },
    })
  })

  it('sets one phrase of an existing arc and keeps the other three', () => {
    const before = rooftops()
    const arc = before.value.theme.presentation?.citySink
    expect(arc).toBeDefined()
    const after = setCitySink(before, 'combine', 123)
    expect(after.value.theme.presentation?.citySink).toEqual({ ...arc, combine: 123 })
  })

  it('is the same document for the value it has', () => {
    const before = rooftops()
    const arc = before.value.theme.presentation?.citySink
    expect(setCitySink(before, 'teach', arc?.teach ?? Number.NaN)).toBe(before)
  })

  it('prints a changed phrase as one line', () => {
    const before = shippedStage('rooftops')
    const text = printStage(before, setCitySink(rooftops(), 'finish', 400))
    const diff = diffLines(before, text)
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0]?.text).toBe('finish = 400')
    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0]?.text).toMatch(/^finish = /)
  })
})

describe('removeCitySink', () => {
  it('drops the arc and keeps the rest of the block', () => {
    const before = rooftops()
    const after = removeCitySink(before)
    expect('citySink' in (after.value.theme.presentation ?? {})).toBe(false)
    expect({
      ...after.value.theme.presentation,
      citySink: before.value.theme.presentation?.citySink,
    }).toEqual(before.value.theme.presentation)
  })

  it('is the same document when there is no arc', () => {
    const before = dawn()
    expect(removeCitySink(before)).toBe(before)
    const bare = minimal()
    expect(removeCitySink(bare)).toBe(bare)
  })

  it('removes the arc table from the text', () => {
    const before = shippedStage('rooftops')
    const next = printStage(before, removeCitySink(rooftops()))
    expect(next).not.toContain('[theme.presentation.citySink]')
    expect(next).toContain('[theme.presentation]')
  })
})
