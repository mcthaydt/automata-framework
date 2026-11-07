// The wardrobe as an extension: once loaded, a figure may wear its eleven garments after core's fifteen; without it, a
// figure naming one is refused, at compile time and at dressing.

import { registeredGarments } from '@automata/3d/figures-kit'
import { compileFixture } from '@automata/3d/testing'
import { describe, expect, it, vi } from 'vitest'
import wardrobeExtension from '../../wardrobe.extension.ts'

const KEEPER = 'content/figures/keeper.toml'
const SHIRT = 'top = "starch"\nsleeves = "short"'
const CLASSIC = [
  'top',
  'waistcoat',
  'trousers',
  'legs',
  'shoes',
  'skirt',
  'apron',
  'coat',
  'belt',
  'cape',
  'gloves',
  'hair',
  'cap',
  'eyes',
  'mark',
]
const STREETWEAR = [
  'tee',
  'hoodie',
  'puffer',
  'jacket',
  'bomber',
  'wideLegs',
  'cargos',
  'sneakers',
  'chain',
  'hoops',
  'shades',
]

/** The keeper's shirtsleeves outfit with its shirt swapped for `garment`, compiled with the wardrobe loaded. */
async function keeperIn(garment: string) {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { FIXTURE_ROOT } = await import('@automata/3d/testing')
  const text = readFileSync(join(FIXTURE_ROOT, KEEPER), 'utf8')
  return { text: text.replace(SHIRT, garment) }
}

describe('the wardrobe extension', () => {
  it('is a named extension that needs the figures', () => {
    expect(wardrobeExtension.name).toBe('wardrobe')
    expect(wardrobeExtension.requires).toEqual(['figures'])
  })
  it("registers its eleven garments after core's fifteen, in that order", () => {
    expect(registeredGarments()).toEqual([...CLASSIC, ...STREETWEAR])
  })
  it('lets a figure wear a bomber: the figure file compiles', async () => {
    const { text } = await keeperIn('bomber = "navy"')
    const result = await compileFixture({ [KEEPER]: text })
    expect(result.ok, result.ok ? '' : result.message).toBe(true)
  })
  it('fills in the swatches a garment wears where the file names none', async () => {
    const { text } = await keeperIn('bomber = "navy"')
    const result = await compileFixture({ [KEEPER]: text })
    if (!result.ok) throw new Error(result.message)
    const figures = result.content.data.figure as Record<string, { outfits: Record<string, unknown[]> }>
    expect(figures.keeper?.outfits.shirtsleeves?.[0]).toEqual({
      bomber: 'navy',
      hardware: 'chrome-dark',
      zip: ['holo-cyan'],
    })
  })
})

describe('without the wardrobe', () => {
  it('a figure in a bomber is refused when its file compiles, and when it is dressed', async () => {
    // A fresh copy of core: nothing has loaded the wardrobe into its registry.
    vi.resetModules()
    const core = await import('@automata/3d/testing')
    const figures = await import('@automata/3d/figures')
    const { text } = await keeperIn('bomber = "navy"')
    const compiled = await core.compileFixture({ [KEEPER]: text })
    expect(compiled.ok).toBe(false)
    expect(compiled.ok ? '' : compiled.message).toContain('a garment has one of: top, waistcoat')
    const fixture = await core.fixtureFigures()
    const def = core.figureOf({}, 'fair', [{ bomber: 'navy' }])
    expect(() => figures.build(def, figures.skeleton(def), 'golden', null, fixture.library)).toThrow(
      'No garment called "bomber" is registered',
    )
  })
})
