import { DEFAULT_PALETTE } from '@automata/content'
import { describe, expect, it } from 'vitest'
import { gaitSchema } from '#src/features/figures/content/gait.schema.ts'
import { DEFAULT_RIG_LIMITS, rigLimitsSchema } from '#src/features/figures/content/rig-limits.schema.ts'
import { swatchSchema } from '#src/features/figures/content/swatch.schema.ts'
import { swatchColourProblems } from '#src/features/figures/content/swatch-colours.ts'

describe('library schemas', () => {
  it('reads a swatch as a palette colour and the material fields a mesh uses', () => {
    expect(swatchSchema.parse({ colour: 22 })).toEqual({ colour: 22 })
    expect(
      swatchSchema.parse({ colour: 45, gloss: 0.9, flat: true, kind: 'metal', role: 'hardware' }),
    ).toMatchObject({
      kind: 'metal',
    })
    expect(swatchSchema.safeParse({ colour: 1.5 }).success).toBe(false)
    expect(swatchSchema.safeParse({ colour: -1 }).success).toBe(false)
    expect(swatchSchema.safeParse({ colour: 3, paint: ['#ffffff'] }).success).toBe(false)
  })
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
  it("reports a colour index past the end of the game's palette, at the swatch", () => {
    expect(swatchColourProblems({ fair: { colour: 22 }, glow: { colour: 64 } }, DEFAULT_PALETTE)).toEqual([
      { swatch: 'glow', message: 'colour 64 is not in the palette Endesga 64 (0 to 63)' },
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
