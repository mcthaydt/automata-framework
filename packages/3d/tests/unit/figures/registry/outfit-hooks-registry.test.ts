// The outfit hooks (spec 8.2, H2): what an extension tunes in `dress` without editing it, set once. With none set,
// dressing is as it always was.

import { beforeAll, describe, expect, it } from 'vitest'
import { build, type FigureLibrary } from '#src/features/figures/figure/build.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { outfitHooks, registerOutfitHooks } from '#src/features/figures/registry/outfit-hooks-registry.ts'
import { RegistryClash } from '#src/features/figures/registry/registry-clash.ts'
import { fixtureFigures } from '#src/testing/fixture-library.ts'
import { figureOf, GOLDEN_OUTFITS } from '#src/testing/golden-outfits.ts'

let library: FigureLibrary
/** The anchors the first golden outfit that has any is built with. */
const anchorsOfFirst = (): { count: number; outfit: (typeof GOLDEN_OUTFITS)[number] } => {
  for (const outfit of GOLDEN_OUTFITS) {
    const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
    const count = build(def, skeleton(def), 'golden', null, library).anchors.length
    if (count > 0) return { count, outfit }
  }
  throw new Error('no golden outfit has an opening a hand can reach')
}

beforeAll(async () => {
  library = (await fixtureFigures()).library
})

describe('the outfit hooks', () => {
  it('are empty until an extension sets them, and dressing then keeps the openings a hand can reach', () => {
    expect(outfitHooks()).toEqual({})
    expect(anchorsOfFirst().count).toBeGreaterThan(0)
  })
  it('pick the openings when they are set, in place of the kinds’ own, and are set only once', () => {
    const { outfit } = anchorsOfFirst()
    const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
    const hooks = { anchors: () => [] }
    registerOutfitHooks(hooks)
    expect(outfitHooks()).toBe(hooks)
    expect(build(def, skeleton(def), 'golden', null, library).anchors).toEqual([])
    expect(() => registerOutfitHooks({})).toThrow('The outfit hooks are already registered')
    expect(() => registerOutfitHooks({})).toThrow(RegistryClash)
  })
})
