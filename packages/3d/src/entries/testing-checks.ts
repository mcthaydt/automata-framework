// `@automata/3d/testing-checks`: the golden checks a wardrobe runs in a browser page (the `@automata/3d/testing` entry
// also loads the content compiler, which reads files and cannot load in a page).

export { KEEPER_SLIDERS, WICK_SLIDERS } from '../testing/fixture-sliders.ts'
export {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  type Golden,
  type OutfitGoldens,
} from '../testing/golden-checks.ts'
export { figureOf, type GoldenOutfit } from '../testing/golden-outfits.ts'
