import { describe, expect, it } from 'vitest'
import { BASE_PAIR } from '#src/entries/base.ts'
import { FACE_DEFAULTS, faceOf, figureSchema } from '#src/features/figures/figure/figure.schema.ts'

describe("a figure's face fields: the painter's sprite cheats", () => {
  it("are the base pair's values when a figure names none", () => {
    expect(FACE_DEFAULTS).toEqual({ camera: 0.6, turn: 0.1, blink: 3.7, drawn: true })
    expect(faceOf(BASE_PAIR.man)).toEqual(FACE_DEFAULTS)
  })
  it('take any of the four, and keep the rest', () => {
    const def = { ...BASE_PAIR.man, face: { camera: 0.2, blink: 0 } }
    expect(figureSchema.parse(def).face).toEqual({ camera: 0.2, blink: 0 })
    expect(faceOf(def)).toEqual({ camera: 0.2, turn: 0.1, blink: 0, drawn: true })
  })
  it('refuse a field the painter does not read, and a camera outside 0 to 1', () => {
    expect(figureSchema.safeParse({ ...BASE_PAIR.man, face: { zoom: 1 } }).success).toBe(false)
    expect(figureSchema.safeParse({ ...BASE_PAIR.man, face: { camera: 2 } }).success).toBe(false)
  })
})
