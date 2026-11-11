import { describe, expect, it } from 'vitest'
import { RETRO_CLINIC, RETRO_NEUTRAL } from '#src/features/retro/retro-profile.schema.ts'
import { RETRO_GLSL, RETRO_WGSL } from '#src/features/retro/retro-shader.ts'
import { RETRO_UNIFORMS, retroUniformValues } from '#src/features/retro/retro-uniforms.ts'

describe('the two shaders', () => {
  it('both read every uniform', () => {
    for (const name of RETRO_UNIFORMS) {
      expect(RETRO_GLSL, `GLSL ${name}`).toContain(name)
      expect(RETRO_WGSL, `WGSL ${name}`).toContain(`fx.${name}`)
    }
  })
})

describe('retroUniformValues', () => {
  it('folds the grade into the shader constants', () => {
    const u = retroUniformValues(RETRO_CLINIC)
    expect(u.uGain).toBe(1)
    expect(u.uWarmR).toBeCloseTo(-0.12 * 0.1 - 0.08 * 0.05, 9)
    expect(u.uWarmB).toBeCloseTo(-(-0.12 * 0.1 + 0.08 * 0.05), 9)
    expect(u.uTintG).toBeCloseTo(0.008, 9)
    expect(u.uFadeR).toBeCloseTo((0x4b / 255) * 0.13, 6)
    expect(u.uQuantise).toBe(0)
  })

  it('exposure is stops: +1 doubles the gain', () => {
    expect(retroUniformValues({ ...RETRO_CLINIC, grade: { ...RETRO_CLINIC.grade, exposure: 1 } }).uGain).toBe(
      2,
    )
  })

  it('has no quantise, no fade and no sharpening in the neutral profile', () => {
    expect(retroUniformValues(RETRO_NEUTRAL)).toMatchObject({
      uQuantise: 0,
      uFadeR: 0,
      uFadeWhite: 1,
      uSharpness: 0,
      uVignette: 0,
    })
  })

  it('reads quantise levels when the profile has them', () => {
    expect(retroUniformValues({ ...RETRO_CLINIC, quantise: { levels: 6, lumaWeight: 0.5 } })).toMatchObject({
      uQuantise: 6,
      uLumaWeight: 0.5,
    })
  })
})
