import { DEFAULT_PALETTE } from '@automata/content'
import { describe, expect, it } from 'vitest'
import { gaitSchema } from '#src/features/figures/content/gait.schema.ts'
import { DEFAULT_RIG_LIMITS, rigLimitsSchema } from '#src/features/figures/content/rig-limits.schema.ts'
import { swatchColourProblems } from '#src/features/figures/content/swatch-colours.ts'

describe('library schemas', () => {
  it('requires every gait number the motion reads', () => {
    expect(gaitSchema.safeParse({ cycle: 0.5 }).success).toBe(false)
  })
  it('refuses a limit range whose minimum passes its maximum', () => {
    const limits = {
      elbow: { min: 0, max: 150 },
      knee: { min: 0, max: 150 },
      shoulder: { cone: 110 },
      hip: { cone: 95 },
      chest: { twist: { min: -35, max: 35 }, pitch: { min: -20, max: 30 } },
      neck: { yaw: { min: -70, max: 70 }, pitch: { min: -40, max: 50 } },
      head: { yaw: { min: -70, max: 70 }, pitch: { min: -40, max: 50 }, roll: { min: -25, max: 25 } },
    }
    expect(rigLimitsSchema.safeParse(limits).success).toBe(true)
    const bad = rigLimitsSchema.safeParse({ ...limits, knee: { min: 150, max: 0 } })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['knee', 'min'])
  })
})

describe('swatchColourProblems', () => {
  it("reports a swatch whose colour is past the end of the game's palette, at the swatch", () => {
    const small = { name: 'Sixteen', colors: DEFAULT_PALETTE.colors.slice(0, 16) }
    expect(
      swatchColourProblems({ fair: { ramp: 'grey', step: 7 }, glow: { ramp: 'ember', step: 7 } }, small),
    ).toEqual([
      { swatch: 'glow', message: 'ember step 7 (colour 255) is not in the palette Sixteen (0 to 15)' },
    ])
  })
})

describe('DEFAULT_RIG_LIMITS', () => {
  it('is a valid rig, the one a figure without `rig` gets even when the game has no figure-rig content', () => {
    expect(rigLimitsSchema.parse(DEFAULT_RIG_LIMITS)).toEqual(DEFAULT_RIG_LIMITS)
    expect(DEFAULT_RIG_LIMITS.knee).toEqual({ min: 0, max: 150 })
    // M3.6a split the spec's head turn (±70°) over the neck and the head.
    expect(DEFAULT_RIG_LIMITS.neck.yaw).toEqual({ min: -35, max: 35 })
  })
})
