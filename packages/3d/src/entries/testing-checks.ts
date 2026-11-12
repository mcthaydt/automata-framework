// `@automataframework/3d/testing-checks`: the golden checks a wardrobe runs in a browser page (the `@automataframework/3d/testing` entry
// also loads the content compiler, which reads files and cannot load in a page).

// The renderer on a page, for an extension's parity tests: build it, give it a fixed target, read its canvas.
export { builtRenderer } from '../testing/built-renderer.ts'
export { KEEPER_SLIDERS, WICK_SLIDERS } from '../testing/fixture-sliders.ts'
export {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  type Golden,
  type OutfitGoldens,
} from '../testing/golden-checks.ts'
export { figureOf, type GoldenOutfit } from '../testing/golden-outfits.ts'
export { snapshot } from '../testing/snapshot.ts'
export { type TestTarget, testTarget } from '../testing/test-target.ts'
