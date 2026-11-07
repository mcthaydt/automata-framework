// The wardrobe's geometry goldens (goldens/dress.json): every streetwear garment on four bodies, built here and compared
// part for part with the recording, and shown not to move when a last bit does. The recording is byte for byte the one
// these outfits had in core before the wardrobe became an extension.

import { build, type FigureLibrary, skeleton } from '@automata/3d/figures'
import {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  figureOf,
  fixtureFigures,
  type OutfitGoldens,
} from '@automata/3d/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import goldens from '../../goldens/dress.json' with { type: 'json' }
import '../../wardrobe.extension.ts'
import { WARDROBE_OUTFITS } from '../../testing/wardrobe-outfits.ts'

const recorded = goldens as unknown as OutfitGoldens
let library: FigureLibrary
beforeAll(async () => {
  library = (await fixtureFigures()).library
})

describe('build() matches the wardrobe goldens part for part', () => {
  for (const outfit of WARDROBE_OUTFITS)
    it(`${outfit.name}: the same parts, bones, skins, anchors and clearance`, () => {
      expectMatchesGolden(outfit, library, recorded)
    })
})

describe('build() is platform-stable: a last-bit change moves no part past the goldens’ tolerance', () => {
  // Two builds of a streetwear outfit take a few seconds while the whole repository's checks share the CPU.
  for (const outfit of WARDROBE_OUTFITS) it(outfit.name, () => expectPlatformStable(outfit, library), 90_000)
})

describe('the wardrobe dresses', () => {
  it("every garment's openings are reachable: the moto outfit offers hips and pockets, none under a longer top", () => {
    const moto = WARDROBE_OUTFITS.find((o) => o.name === 'model-moto')
    if (!moto) throw new Error('no model-moto')
    const def = figureOf(moto.sliders, moto.skin, moto.garments)
    const built = build(def, skeleton(def), 'golden', null, library)
    expectSound(built)
    expect(built.anchors.length).toBeGreaterThan(0)
    expect(built.anchors.some((a) => a.kind === 'hip')).toBe(true)
  })
})
