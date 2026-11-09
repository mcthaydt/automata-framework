import { DEFAULT_PALETTE, step } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { addLookPass, createLookPasses, registeredLookPasses } from '#src/features/look/look-pass.ts'
import { rampLit } from '#src/features/look/ramp-light.ts'
import { spriteLight } from '#src/features/look/sprite-light.ts'
import { targetSize } from '#src/features/look/target-size.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

describe('the look', () => {
  it('the default look is a 180-pixel field with outline off, as the source profile has it', () => {
    expect(DEFAULT_LOOK.pixel.short).toBe(180)
    expect(DEFAULT_LOOK.switches).toEqual({ outline: false, grade: true, dither: true })
  })

  it('a look names what is wrong with it', () => {
    expect(() => parseLook({ pixel: { short: 0 } })).toThrow(/short/)
    expect(parseLook({ steps: 7 }).steps).toBe(7)
  })
})

describe('the low-resolution target', () => {
  it('keeps its short side at 180 and follows the stage', () => {
    expect(targetSize({ width: 1280, height: 720 })).toEqual({ width: 320, height: 180 })
    expect(targetSize({ width: 390, height: 844 })).toEqual({ width: 180, height: 390 })
    expect(targetSize({ width: 844, height: 390 })).toEqual({ width: 390, height: 180 })
  })

  it('is never empty before the stage has a size', () => {
    expect(targetSize({ width: 0, height: 0 })).toEqual({ width: 320, height: 180 })
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

describe('sprite light', () => {
  const lamp = { dir: [0, 1, 0] as const, rgb: [1, 1, 1] as const }

  it('gives a flat light at the chest: ambient plus each lamp at its share, stepped, never under the floor', () => {
    const lit = spriteLight({ lamps: [lamp], chestNormals: [[1, 0, 0]] }, timeOfDay('day'))
    // A lamp straight overhead meets a chest's side-on normal edge-on: the floor keeps the figure lit.
    expect(lit.flat[0]).toBeGreaterThan(0.2)
    expect(lit.flat.every((c) => Math.abs(c * 10 - Math.round(c * 10)) < 1e-9)).toBe(true)
  })

  it('takes a one-step form toward the lamp and away from it', () => {
    const lit = spriteLight(
      {
        lamps: [lamp],
        chestNormals: [
          [0, 1, 0],
          [0, 0, 1],
          [0, -1, 0],
          [1, 0, 0],
        ],
      },
      timeOfDay('day'),
    )
    expect(lit.form([0, 1, 0])).toBe(1)
    expect(lit.form([0, -1, 0])).toBe(-1)
    expect(lit.form([0, 0.4, 0.9])).toBe(0)
  })

  it('rims an edge on the lamp side and no other', () => {
    const side = { dir: [0.8, 0.3, 0.1] as const, rgb: [1, 1, 1] as const }
    const lit = spriteLight({ lamps: [side], chestNormals: [[0, 0, 1]] }, timeOfDay('day'))
    expect(lit.rim(1, 0)).toBe(true)
    expect(lit.rim(-1, 0)).toBe(false)
  })

  it('rims nothing for a lamp straight from the viewer', () => {
    const front = { dir: [0, 0, 1] as const, rgb: [1, 1, 1] as const }
    const lit = spriteLight({ lamps: [front], chestNormals: [[0, 0, 1]] }, timeOfDay('day'))
    expect(lit.rim(1, 0)).toBe(false)
  })
})

describe('look passes', () => {
  it('an added pass runs after core passes, and a taken name is refused', () => {
    const extra = { name: 'spec-rain', make: () => ({ stage: 'post' as const }) as never }
    addLookPass(extra)
    expect(registeredLookPasses().map((p) => p.name)).toEqual(['spec-rain'])
    expect(() => addLookPass(extra)).toThrow(/spec-rain/)
    const passes = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(passes.list.at(-1)).toBe(passes.extra[0])
    expect(passes.list.indexOf(passes.extra[0] as never)).toBeGreaterThan(
      passes.list.indexOf(passes.snap as never),
    )
  })

  it('outline is off by default, and a switch turns it on', () => {
    expect(createLookPasses(DEFAULT_LOOK, timeOfDay('day')).outline).toBeUndefined()
    const on = createLookPasses(parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(on.outline).toBeDefined()
  })
})
