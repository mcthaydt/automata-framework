// The kit's geometry goldens (goldens/dress.json): every garment, hair piece and finish the kit adds on four bodies, built
// here and compared part for part with the recording, and shown not to move when a last bit does. The recording is byte for
// byte the one these outfits had in core before the kit existed (the `fall` that listed locks is written `strands`).

import { build, type FigureLibrary, skeleton } from '@automata/3d/figures'
import {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  figureOf,
  type OutfitGoldens,
} from '@automata/3d/testing'
import { beforeAll, describe, expect, it } from 'vitest'
import '#src/app/character-kit.extension.ts'
import { kitFixture } from '#src/testing/kit-fixture.ts'
import { KIT_OUTFITS } from '#src/testing/kit-outfits.ts'
import goldens from '../../goldens/dress.json' with { type: 'json' }

const recorded = goldens as unknown as OutfitGoldens
let library: FigureLibrary
beforeAll(async () => {
  library = (await kitFixture()).library
})

describe('build() matches the kit’s goldens part for part', () => {
  for (const outfit of KIT_OUTFITS)
    it(`${outfit.name}: the same parts, bones, skins, anchors and clearance`, () => {
      expectMatchesGolden(outfit, library, recorded)
    })
})

describe('build() is platform-stable: a last-bit change moves no part past the goldens’ tolerance', () => {
  for (const outfit of KIT_OUTFITS) it(outfit.name, () => expectPlatformStable(outfit, library))
})

describe('the kit’s outfits dress', () => {
  // One test for each outfit, so a slow machine fails the one that is slow and not the sum of all eleven.
  for (const outfit of KIT_OUTFITS)
    it(`${outfit.name} is sound: parts bound to real joints, finite, indexed inside their mesh`, () => {
      const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
      expectSound(build(def, skeleton(def), 'golden', null, library))
    })
  it('the pony’s cuffs are built on every other braid (the source’s density gate is a sprite’s)', () => {
    const outfit = KIT_OUTFITS.find((o) => o.name === 'model-braids')
    if (!outfit) throw new Error('no model-braids')
    const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
    const cuffs = build(def, skeleton(def), 'golden', null, library).parts.filter((p) => p.tag === 'cuff')
    // Seven ropes, the four on top cuffed.
    expect(cuffs).toHaveLength(4)
    for (const cuff of cuffs) {
      expect(cuff.material).toBe('chrome-dark')
      expect(cuff.skin?.length).toBe(cuff.mesh.positions.length / 3)
    }
  })
})
