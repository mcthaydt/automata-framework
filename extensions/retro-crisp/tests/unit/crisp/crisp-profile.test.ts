import { describe, expect, it } from 'vitest'
import { crispCanvasStyle } from '#src/features/crisp/crisp-canvas.ts'
import { CRISP_CLINIC, crispFromQuery, parseCrispProfile } from '#src/features/crisp/crisp-profile.schema.ts'
import { letterboxScale } from '#src/features/crisp/crisp-scale.ts'

describe('the crisp profile', () => {
  it('is whole-pixel scaling with the clinic cap, and every look change off', () => {
    expect(parseCrispProfile({})).toEqual({
      scale: 'letterbox',
      cap: { width: 640, height: 480 },
      figures: false,
      lcd: false,
      sampler: false,
    })
    expect(CRISP_CLINIC).toEqual(parseCrispProfile({}))
  })

  it('refuses a cap that is not whole pixels', () => {
    expect(() => parseCrispProfile({ cap: { width: 640.5, height: 480 } })).toThrow()
  })
})

describe('crispFromQuery', () => {
  it('reads 1 as figures and sampler, and names as themselves', () => {
    expect(crispFromQuery('?crisp=1')).toMatchObject({ figures: true, sampler: true, lcd: false })
    expect(crispFromQuery('?crisp=figures,lcd')).toMatchObject({ figures: true, lcd: true, sampler: false })
    expect(crispFromQuery('')).toMatchObject({ figures: false, lcd: false, sampler: false })
  })

  it('reads the scale override, and ignores a word it does not know', () => {
    expect(crispFromQuery('?scale=fit').scale).toBe('fit')
    expect(crispFromQuery('?scale=huge').scale).toBe('letterbox')
  })
})

describe('crispCanvasStyle', () => {
  it('sizes and places the canvas in whole device pixels, drawn pixelated', () => {
    const style = crispCanvasStyle(letterboxScale(1400, 1000, 1, { width: 640, height: 480 }))
    expect(style).toEqual({
      width: '1280px',
      height: '960px',
      marginLeft: '60px',
      marginTop: '20px',
      imageRendering: 'pixelated',
    })
  })
})
