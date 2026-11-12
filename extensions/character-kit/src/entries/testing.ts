// @automata/character-kit/testing: the fixture figures with the kit's hairstyles and seats on top, and the outfits the kit's
// geometry goldens are taken on, for the kit's own tests and for a game that wants to check its figures against the kit's.
export { type KitFixture, kitFixture } from '../testing/kit-fixture.ts'
export { KIT_OUTFITS } from '../testing/kit-outfits.ts'
export {
  type PaintedCell,
  paintedCell,
  paintedStand,
  paintedWalk,
  rowWidths,
  type Silhouette,
  silhouette,
  texelsOfSwatch,
} from '../testing/painted-cell.ts'
export {
  bald,
  type Proportions,
  proportions,
  proportionsOfCells,
  type RiggedHeights,
  riggedHeights,
} from '../testing/proportions.ts'
export {
  blit,
  crop,
  decodePng,
  encodePng,
  fill,
  newRaster,
  type Raster,
  type Rgba,
  text,
  textHeight,
  textWidth,
} from '../testing/raster.ts'
