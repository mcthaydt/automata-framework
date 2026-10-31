import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import { setCourseTuning, setUnlock } from '../commands/identity-edits'
import { COURSE_TUNABLE_NAMES } from '../course-tuning'
import { emptyTemplate, simpleCityTemplate } from '../templates/stage-templates'
import { TUNABLES } from '../tunables'
import { stageForm } from './stage-form'

// What the Stage view shows (plan EDFF.2a-1 step 3): the stage's identity, its presentation block and its course
// tuning overrides, with each override's declaration and the tunables that can still be added.

describe('stageForm', () => {
  it("shows a new Simple city stage's identity and presentation, with no overrides", () => {
    const document = simpleCityTemplate.create(counterIds())
    const form = stageForm(document)
    expect(form.identity).toEqual({
      id: document.value.id,
      name: document.value.displayName,
      unlock: '',
      platformAlias: document.value.platformAlias,
    })
    expect(form.presentation).toEqual({
      refraction: 0.45,
      horizonLift: 12,
      lightHeight: undefined,
      lightShimmer: false,
      silhouette: false,
    })
    expect(form.overrides).toEqual([])
    expect(form.available).toEqual(COURSE_TUNABLE_NAMES)
  })

  it('says a stage has no presentation block, and shows its unlock', () => {
    const document = setUnlock(emptyTemplate.create(counterIds()), 'rooftops-cleared')
    const form = stageForm(document)
    expect(form.presentation).toBeUndefined()
    expect(form.identity.unlock).toBe('rooftops-cleared')
  })

  it('lists an override with its declaration, in the course order, and no longer offers it', () => {
    const base = emptyTemplate.create(counterIds())
    const document = setCourseTuning(setCourseTuning(base, 'MAX_MOVE_SPEED', 400), 'COURSE_FLOOR_COUNT', 30)
    const form = stageForm(document)
    expect(form.overrides).toEqual([
      { name: 'COURSE_FLOOR_COUNT', value: 30, declared: TUNABLES.COURSE_FLOOR_COUNT },
      { name: 'MAX_MOVE_SPEED', value: 400, declared: TUNABLES.MAX_MOVE_SPEED },
    ])
    expect(form.available).not.toContain('MAX_MOVE_SPEED')
    expect(form.available).toHaveLength(COURSE_TUNABLE_NAMES.length - 2)
  })

  it('keeps an override of a name the course does not read, after the others, for the checks to report', () => {
    const document = setCourseTuning(emptyTemplate.create(counterIds()), 'NOT_A_TUNABLE', 1)
    expect(stageForm(document).overrides).toEqual([{ name: 'NOT_A_TUNABLE', value: 1, declared: undefined }])
  })
})
