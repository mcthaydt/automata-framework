import { figureSchema } from '@automata/3d/figures'
import { describe, expect, it } from 'vitest'
import { BODY_SLIDERS, FACE_GROUPS, sliderValue } from '#src/features/studio/studio-fields.ts'

describe('the Studio’s sliders', () => {
  it('list the face’s fourteen in five groups, as FigureBuilder groups them', () => {
    expect(FACE_GROUPS.map((group) => [group.label, group.sliders.length])).toEqual([
      ['Structure', 3],
      ['Cheeks', 2],
      ['Nose and lips', 3],
      ['Brows', 3],
      ['Lids', 3],
    ])
  })

  it('name only sliders the figures schema has, with its bounds', () => {
    const sliders = [...BODY_SLIDERS, ...FACE_GROUPS.flatMap((group) => group.sliders)]
    for (const field of sliders) {
      const at = field.path.length === 1 ? { [field.id]: field.min } : { face: { [field.id]: field.min } }
      const result = figureSchema.safeParse({
        sliders: at,
        skin: 'a',
        gait: 'b',
        hand: 'R',
        outfits: { x: [{ top: 'a' }] },
        default: 'x',
      })
      const issues = result.success ? [] : result.error.issues.filter((issue) => issue.path[0] === 'sliders')
      expect(issues, field.id).toEqual([])
    }
  })

  it('read a figure’s own value, or the default when it does not write one', () => {
    const jaw = FACE_GROUPS[0]?.sliders[1]
    expect(jaw?.id).toBe('jaw')
    if (jaw === undefined) return
    expect(sliderValue({ face: { jaw: 0.9 } }, jaw)).toBe(0.9)
    expect(sliderValue({}, jaw)).toBe(jaw.default)
  })
})
