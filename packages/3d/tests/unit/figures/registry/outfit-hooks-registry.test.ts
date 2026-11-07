// The outfit hooks (spec 8.2, H2): what an extension tunes in `dress` without editing it, set once. With none set,
// dressing is as it always was.

import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { J } from '#src/features/figures/body/rig.ts'
import { build, type FigureLibrary } from '#src/features/figures/figure/build.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { registerGarment } from '#src/features/figures/registry/garment-registry.ts'
import { outfitHooks, registerOutfitHooks } from '#src/features/figures/registry/outfit-hooks-registry.ts'
import { RegistryClash } from '#src/shared/registry/registry-clash.ts'
import { fixtureFigures } from '#src/testing/fixture-library.ts'
import { figureOf, GOLDEN_OUTFITS } from '#src/testing/golden-outfits.ts'

let library: FigureLibrary
/** The golden outfit the pocketed garment is worn with, and how many openings it is built with. */
const anchorsOfFirst = (): { count: number; outfit: (typeof GOLDEN_OUTFITS)[number] } => {
  const outfit = GOLDEN_OUTFITS[0]
  if (!outfit) throw new Error('no golden outfit')
  const garments = [...outfit.garments, { pockets: 'navy' }]
  const def = figureOf(outfit.sliders, outfit.skin, garments)
  return {
    count: build(def, skeleton(def), 'golden', null, library).anchors.length,
    outfit: { ...outfit, garments },
  }
}

beforeAll(async () => {
  library = (await fixtureFigures()).library
  // Core's classic garments publish no openings, so the test wears a kind of its own that publishes one: a garment
  // with no parts and a single hip pocket, the way a wardrobe's trousers do.
  registerGarment('pockets', {
    schema: z.object({ pockets: z.string() }),
    swatches: {},
    build: () => ({
      parts: [],
      anchors: [{ kind: 'hip', side: 'R', bone: J['pelvis'], at: [0.1, 0.9, 0], open: [0, -1, 0] }],
    }),
  })
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
