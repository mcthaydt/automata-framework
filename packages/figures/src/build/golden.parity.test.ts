// The FigureBuilder goldens in Chromium, WebKit and Firefox (the `browsers` project). build.test.ts runs the same
// checks in Node, so between them the goldens hold in four engines: the geometry must match FigureBuilder to the
// same 1e-9 everywhere, and a last-bit change must move nothing past it (decision 16). A mismatch in one engine is
// investigated, never re-recorded per engine.
//
// The fixture library is compiled by the content compiler, which reads files, so the `figureFixture` command
// (vitest.config.ts) compiles it in Node and hands the page its data; build() then runs in the browser.

import { beforeAll, describe, it } from 'vitest'
import { commands } from 'vitest/browser'
import { expectMatchesGolden, expectPlatformStable } from '../testing/golden-checks'
import { GOLDEN_OUTFITS } from '../testing/golden-outfits'
import type { FigureLibrary } from './build'

let library: FigureLibrary
beforeAll(async () => {
  const figureFixture = (commands as unknown as { figureFixture?: () => Promise<FigureLibrary> })
    .figureFixture
  if (typeof figureFixture !== 'function')
    throw new Error('no figureFixture command: run this file in the browsers project')
  library = await figureFixture()
})

describe('build() matches FigureBuilder dress() part for part in every browser (goldens, a1f7246)', () => {
  for (const outfit of GOLDEN_OUTFITS)
    it(`${outfit.name}: the same parts, bones, skins, anchors and clearance`, () => {
      expectMatchesGolden(outfit, library)
    })
})

describe('build() is platform-stable in every browser: a last-bit change moves no part past the tolerance', () => {
  // Two builds of a streetwear outfit take a few seconds, more with three engines sharing the CPU.
  for (const outfit of GOLDEN_OUTFITS) it(outfit.name, () => expectPlatformStable(outfit, library), 90_000)
})
