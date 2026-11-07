// The figures package's test fixtures for other packages' tests (@automata/3d's figure view, and the wardrobe
// extension's): the compiled fixture content, with Wick and the keeper, and its libraries, and the same content as a
// `MotionLibrary`; and what a wardrobe checks its own garments with: the golden checks, the seeded random cast, the
// motion goldens' comparisons and the fixture content's compile.
export { compileFixture, FIXTURE_ROOT } from './compile-fixture.ts'
export { type Fingerprint, fingerprint } from './fingerprint.ts'
export { type FixtureFigures, fixtureFigures } from './fixture-library.ts'
export { type FixtureMotion, fixtureMotion } from './fixture-motion.ts'
export { KEEPER_SLIDERS, WICK_SLIDERS } from './fixture-sliders.ts'
export {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  type Golden,
  type OutfitGoldens,
} from './golden-checks.ts'
export { figureOf, type GoldenOutfit } from './golden-outfits.ts'
export { recordDress, recordStands, section } from './golden-recorders.ts'
export { type Digest, expectClose, expectDigest, type GoldenHold } from './motion-goldens.ts'
export { AT_REST } from './motion-states.ts'
export { random, randomCharacter, type Wear } from './random-character.ts'
export { surfaceOf } from './stand-surface.ts'
