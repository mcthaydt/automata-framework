import { describe, expect, it } from 'vitest'
import {
  parseRetroProfile,
  RETRO_CLINIC,
  RETRO_NEUTRAL,
  retroProfileSchema,
} from '#src/features/retro/retro-profile.schema.ts'

describe('the retro profile', () => {
  it('has the clinic numbers when nothing is given', () => {
    expect(parseRetroProfile({})).toEqual({
      sharpness: 0.35,
      grade: {
        exposure: 0,
        warmth: -0.12,
        tint: 0.08,
        brilliance: 0,
        contrast: 1.05,
        highlights: -0.05,
        shadows: 0,
        saturation: 0.85,
        vibrance: 0.1,
        blackCrush: 0.025,
        moodBlend: 0.85,
      },
      vignette: 0.85,
      fade: {
        colour: '#4b5a56',
        lift: 0.13,
        white: 0.96,
        grain: 0.04,
        fps: 12,
        speck: 3,
        specks: 0.0008,
        scratch: 0.25,
      },
      quantise: null,
      cell: 1,
    })
    expect(RETRO_CLINIC).toEqual(parseRetroProfile({}))
  })

  it('fills a part of a section from the clinic', () => {
    expect(parseRetroProfile({ grade: { saturation: 1 } }).grade).toMatchObject({
      saturation: 1,
      contrast: 1.05,
    })
  })

  it('refuses a setting it does not know, and a colour that is not #rrggbb', () => {
    expect(() => parseRetroProfile({ grade: { warmht: 1 } })).toThrow()
    expect(retroProfileSchema.safeParse({ fade: { colour: 'green' } }).success).toBe(false)
  })

  it('asks for at least two levels when it quantises', () => {
    expect(retroProfileSchema.safeParse({ quantise: { levels: 1 } }).success).toBe(false)
    expect(parseRetroProfile({ quantise: {} }).quantise).toEqual({ levels: 8, lumaWeight: 0.5 })
  })

  it('has a neutral profile that changes nothing', () => {
    expect(RETRO_NEUTRAL.grade).toMatchObject({ contrast: 1, saturation: 1, moodBlend: 0, blackCrush: 0 })
    expect(RETRO_NEUTRAL).toMatchObject({ sharpness: 0, vignette: 0, quantise: null })
    expect(RETRO_NEUTRAL.fade).toMatchObject({ lift: 0, white: 1, grain: 0, specks: 0, scratch: 0 })
  })
})
