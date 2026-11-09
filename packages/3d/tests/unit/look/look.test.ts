import { DEFAULT_PALETTE, step } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { addLookPass, createLookPasses, registeredLookPasses } from '#src/features/look/look-pass.ts'
import { rampLit } from '#src/features/look/ramp-light.ts'
import { targetSize } from '#src/features/look/target-size.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

describe('the look', () => {
  it('the default look is a 360-pixel field with outline off, and every pass the look can switch on', () => {
    expect(DEFAULT_LOOK.pixel.short).toBe(360)
    expect(DEFAULT_LOOK.switches).toEqual({
      outline: false,
      grade: true,
      dither: true,
      glow: true,
      rain: true,
      stars: true,
      reflect: true,
      shafts: true,
      particles: true,
    })
    expect(DEFAULT_LOOK.mood).toBeUndefined()
    expect(parseLook({ mood: 'sodium' }).mood).toBe('sodium')
  })

  it('a look names what is wrong with it', () => {
    expect(() => parseLook({ pixel: { short: 0 } })).toThrow(/short/)
    expect(parseLook({ steps: 7 }).steps).toBe(7)
  })
})

describe("the look's figure cells", () => {
  it('are painted from the sheets’ density up to three times it, in a cache of 32 MiB', () => {
    expect(DEFAULT_LOOK.figures).toEqual({ min: 1, max: 3, cacheBytes: 33554432 })
    expect(DEFAULT_LOOK.light).toEqual({
      step: 0.1,
      gain: 1,
      max: 1.6,
      strength: 2.6,
      key: { dir: [0.3, 0.8, 0.5], level: 0.09 },
      fade: [1.5, 4, 0.25],
    })
    expect(DEFAULT_LOOK.haze).toEqual({ colour: '#47655a', near: 0, far: 10, amount: 0.85, glow: 0.5 })
    expect(DEFAULT_LOOK.figureLight).toEqual({
      ambient: 1.5,
      threshold: 0.22,
      ink: 40,
      floor: 0.5,
      rim: 0.35,
      floorCap: 0.8,
    })
    expect(DEFAULT_LOOK.figureShadow).toBe(0.6)
    expect(parseLook({ figures: { max: 2 } }).figures).toEqual({ min: 1, max: 2, cacheBytes: 33554432 })
  })
})

describe('the low-resolution target', () => {
  it('keeps its short side at 360 and follows the stage', () => {
    expect(targetSize({ width: 1280, height: 720 })).toEqual({ width: 640, height: 360 })
    expect(targetSize({ width: 390, height: 844 })).toEqual({ width: 360, height: 779 })
    expect(targetSize({ width: 844, height: 390 })).toEqual({ width: 779, height: 360 })
  })

  it('is never empty before the stage has a size', () => {
    expect(targetSize({ width: 0, height: 0 })).toEqual({ width: 640, height: 360 })
  })
})

describe('ramp light', () => {
  it('moves a colour in whole steps along its ramp', () => {
    const index = 3 * 8 + 4
    expect(rampLit(index, 0.5, DEFAULT_LOOK)).toBe(step(index, -2))
    expect(rampLit(index, 1, DEFAULT_LOOK)).toBe(index)
    expect(rampLit(index, 1.25, DEFAULT_LOOK)).toBe(step(index, 1))
  })

  it('stops at the ends of the ramp and stays on it', () => {
    expect(rampLit(3 * 8, 0, DEFAULT_LOOK)).toBe(3 * 8)
    expect(rampLit(3 * 8 + 7, 9, DEFAULT_LOOK)).toBe(3 * 8 + 7)
    expect(DEFAULT_PALETTE.colors[rampLit(100, 0.7, DEFAULT_LOOK)]).toBeDefined()
  })
})

describe('look passes', () => {
  it('an added pass runs after core passes, and a taken name is refused', () => {
    const extra = { name: 'spec-rain', make: () => ({ stage: 'post' as const }) as never }
    addLookPass(extra)
    expect(registeredLookPasses().map((p) => p.name)).toEqual(['spec-rain'])
    expect(() => addLookPass(extra)).toThrow(/spec-rain/)
    const passes = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    // The finish is always last, after an extension's pass, which must keep alpha for it.
    expect(passes.list.at(-1)).toBe(passes.finish)
    expect(passes.list.at(-2)).toBe(passes.extra[0])
    expect(passes.list.indexOf(passes.extra[0] as never)).toBeGreaterThan(
      passes.list.indexOf(passes.snap as never),
    )
  })

  it('grades by the look’s mood, and a mood nobody named is refused', () => {
    const none = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(none.finish.graded).toBe(false)
    const sodium = createLookPasses(parseLook({ mood: 'sodium' }), timeOfDay('day'))
    expect(sodium.finish.graded).toBe(true)
    // The grade switch off leaves the palette as it is.
    expect(
      createLookPasses(parseLook({ mood: 'sodium', switches: { grade: false } }), timeOfDay('day')).finish
        .graded,
    ).toBe(false)
    expect(() => createLookPasses(parseLook({ mood: 'dusky' }), timeOfDay('day'))).toThrow(/dusky/)
  })

  it('outline is off by default, and a switch turns it on', () => {
    expect(createLookPasses(DEFAULT_LOOK, timeOfDay('day')).outline).toBeUndefined()
    const on = createLookPasses(parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(on.outline).toBeDefined()
  })
})
