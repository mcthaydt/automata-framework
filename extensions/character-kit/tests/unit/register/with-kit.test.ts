import {
  build,
  GROUP,
  garmentSchema,
  hairStyleSchema,
  registeredGarments,
  skeleton,
} from '@automata/3d/figures'
import { figureOf, fixtureFigures } from '@automata/3d/testing'
import { describe, expect, it } from 'vitest'
import { characterKitExtension } from '#src/app/character-kit.extension.ts'
import coreFigures from '../../fixtures/core-figures.json' with { type: 'json' }
import { coreFigureDigests, expectClose } from '../../fixtures/core-figures.ts'

// The same figures and styles as register/without-kit.test.ts, with the kit loaded.

const CORE = ['top', 'trousers', 'shoes', 'cape', 'hair', 'cap', 'eyes']
const KIT = ['waistcoat', 'legs', 'skirt', 'apron', 'coat', 'belt', 'gloves', 'mark']

describe('with the kit', () => {
  it('registers its eight garments after core’s seven, in the order a figure tells them apart', () => {
    expect(registeredGarments().slice(0, CORE.length + KIT.length)).toEqual([...CORE, ...KIT])
    expect(registeredGarments().indexOf('cap')).toBeLessThan(registeredGarments().indexOf('mark'))
  })
  it('a figure in a skirt builds, with the skirt’s part', async () => {
    const { library } = await fixtureFigures()
    const def = figureOf({}, 'fair', [{ top: 'navy' }, { skirt: 'navy', length: 0.5 }])
    const built = build(def, skeleton(def), 'golden', null, library)
    expect(built.parts.some((p) => p.group === GROUP.skirt)).toBe(true)
  })
  it('each garment of the kit parses, and a bad number is refused at its field', () => {
    for (const name of KIT) expect(registeredGarments(), name).toContain(name)
    expect(garmentSchema.safeParse({ waistcoat: 'tweed' }).success).toBe(true)
    const bad = garmentSchema.safeParse({ skirt: 'navy', length: 3 })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['length'])
  })
  it('a cap’s own mark is still the cap’s, and a mark with a colour is the kit’s', () => {
    expect(garmentSchema.safeParse({ cap: 'tweed', style: 'flat', mark: 'badge' }).success).toBe(true)
    expect(garmentSchema.safeParse({ mark: 'badge', colour: 'brass', side: 'L' }).success).toBe(true)
    expect(garmentSchema.safeParse({ mark: 'badge', colour: 'brass', side: 'up' }).success).toBe(false)
  })
  it('a style with a bun, rows or a ponytail parses, and a finish it names is known', () => {
    const rope = { r: 0.16 }
    expect(
      hairStyleSchema.safeParse({ pieces: [{ bun: { at: [0, -0.35, -1], r: 0.5, rope } }] }).success,
    ).toBe(true)
    const bun = { bun: { at: [0, -0.35, -1], r: 0.5, rope } }
    for (const finish of ['coil', 'braid', 'loc', 'smooth', 'curl', 'sleek'])
      expect(hairStyleSchema.safeParse({ finish, pieces: [bun] }).success, finish).toBe(true)
    expect(hairStyleSchema.safeParse({ finish: 'nope', pieces: [bun] }).success).toBe(false)
  })
  it('is an extension of the figures that brings the seat kind', () => {
    expect(characterKitExtension.name).toBe('character-kit')
    expect(characterKitExtension.requires).toEqual(['figures'])
    expect(characterKitExtension.content?.map((c) => c.kind)).toEqual(['figure-seat'])
  })
  it('leaves Wick and the base pair exactly as core draws them alone', async () => {
    expectClose(await coreFigureDigests(), coreFigures)
  })
})
