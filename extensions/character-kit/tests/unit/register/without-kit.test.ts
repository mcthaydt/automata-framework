import { build, garmentSchema, hairStyleSchema, skeleton } from '@automata/3d/figures'
import { hairParts } from '@automata/3d/figures-kit'
import { figureOf, fixtureFigures } from '@automata/3d/testing'
import { describe, expect, it } from 'vitest'
import coreFigures from '../../fixtures/core-figures.json' with { type: 'json' }
import { coreFigureDigests, expectClose } from '../../fixtures/core-figures.ts'

// This file never loads the kit, and nothing it imports does: what it shows is what core does alone. register/with-kit.test.ts
// shows the same figures and styles with the kit loaded.

describe('without the kit', () => {
  it('a figure in a skirt fails, naming the skirt', async () => {
    const { library } = await fixtureFigures()
    const def = figureOf({}, 'fair', [{ top: 'navy' }, { skirt: 'navy', length: 0.5 }])
    expect(() => build(def, skeleton(def), 'golden', null, library)).toThrow('No garment called "skirt"')
  })
  it('none of the kit’s garments is a garment', () => {
    for (const name of ['apron', 'belt', 'coat', 'gloves', 'legs', 'mark', 'skirt', 'waistcoat'])
      expect(garmentSchema.safeParse({ [name]: 'navy' }).success, name).toBe(false)
  })
  it('a style with a bun is refused, and so is building one', () => {
    const style = { pieces: [{ bun: { at: [0, -0.35, -1], r: 0.5, rope: { r: 0.16 } } }] }
    expect(hairStyleSchema.safeParse(style).success).toBe(false)
    expect(() =>
      hairParts({ m: {}, s: {}, hair: 'hair', skin: 'skin', made: {} } as never, style as never),
    ).toThrow()
  })
  it('Wick and the base pair are what the recording says', async () => {
    expectClose(await coreFigureDigests(), coreFigures)
  })
})
