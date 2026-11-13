// Where each of the look's passes runs on `@pixi/3d` 0.1.0-beta.3, which stages post effects: `'beforeToneMapping'` (the
// default) hands an effect linear `rgba16float` light, `'afterToneMapping'` the picture as it shows. Every pass of the look
// works on the picture: the sky and the haze write the palette's authored colours, the snap and the outline compare colours
// with the DUEL palette, the grade and the present pass move display colours. A pass left at the default would read them as
// linear light, put the scene in a float target and take the curve out of its materials (and throw where WebGL2 has no
// `EXT_color_buffer_float`).
import { describe, expect, it } from 'vitest'
import { parseLook } from '#src/features/look/look.ts'
import { createLookPasses } from '#src/features/look/look-pass.ts'
import { SkyEffect } from '#src/features/look/sky-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

describe('the look’s passes run after tone mapping', () => {
  it('puts the haze, the grade, the snap, the outline and the present pass on the picture as shown', () => {
    const made = createLookPasses(parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(made.list.map((pass) => pass.constructor.name)).toEqual([
      'HazeEffect',
      'GradeEffect',
      'DuelSnapEffect',
      'OutlineEffect',
      'PresentEffect',
    ])
    for (const pass of made.list) expect(pass.stage, pass.constructor.name).toBe('afterToneMapping')
  })

  it('puts the sky there too', () => {
    expect(new SkyEffect(timeOfDay('day')).stage).toBe('afterToneMapping')
  })
})
