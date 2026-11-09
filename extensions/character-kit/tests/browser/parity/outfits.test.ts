// The kit's geometry goldens in Chromium, WebKit and Firefox (the `browser` project). tests/unit/outfits.test.ts runs the
// same checks in Node, so between them the goldens hold in four engines: the geometry must match the recording to the same
// 1e-9 everywhere, and a last-bit change must move nothing past it. A mismatch in one engine is investigated, never
// re-recorded per engine.
//
// The fixture library is compiled by the content compiler, which reads files, so the `kitFixture` command
// (vitest.config.ts) compiles it in Node and hands the page its data; build() then runs in the browser.

import type { FigureLibrary } from '@automata/3d/figures'
import { expectMatchesGolden, expectPlatformStable, type OutfitGoldens } from '@automata/3d/testing-checks'
import { beforeAll, describe, it } from 'vitest'
import { commands } from 'vitest/browser'
import '#src/features/garments/register-wardrobe.ts'
import '#src/features/hair/register-hair.ts'
import { KIT_OUTFITS } from '#src/testing/kit-outfits.ts'
import goldens from '../../fixtures/goldens/dress.json' with { type: 'json' }

const recorded = goldens as unknown as OutfitGoldens
let library: FigureLibrary
beforeAll(async () => {
  const kitFixture = (commands as unknown as { kitFixture?: () => Promise<FigureLibrary> }).kitFixture
  if (typeof kitFixture !== 'function')
    throw new Error('no kitFixture command: run this file in the browser project')
  library = await kitFixture()
})

describe('build() matches the kit’s goldens part for part in every browser', () => {
  for (const outfit of KIT_OUTFITS)
    it(`${outfit.name}: the same parts, bones, skins, anchors and clearance`, () => {
      expectMatchesGolden(outfit, library, recorded)
    })
})

describe('build() is platform-stable in every browser: a last-bit change moves no part past the tolerance', () => {
  for (const outfit of KIT_OUTFITS) it(outfit.name, () => expectPlatformStable(outfit, library), 90_000)
})
