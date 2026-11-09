// @automata/3d/photo: the photo library and the pipeline that turns a photo into a tile, for the world's textures and for the
// checks and the editors that read them. Pixi-free, and the same code in Node and in a browser: the caller fetches a photo's
// bytes (a URL in the game, a file in a test) and `photoSource` reads them.
export { checkReads } from '../app/check-reads.ts'
export {
  PHOTOS,
  type Photo,
  type PhotoLibrary,
  type PhotoSourceLoader,
  photoOf,
  photoSource,
} from '../features/photo/photo-library.ts'
export { decodePng, type Image } from '../features/photo/png.ts'
export {
  PATCH_MAX,
  PATCH_MIN,
  READS,
  type Reads,
  readsOf,
  SPOT_MAX,
  SPOT_MIN,
  structureIssues,
  type TileStructure,
  tileStructure,
} from '../features/photo/structure.ts'
export { swatchIssues } from '../features/photo/swatch-issues.ts'
export { ladderOf, swatchTile, type TexturedSwatch, textureOf } from '../features/photo/swatch-tile.ts'
export { TEXTURE_DEFAULTS, type TextureSpec, texelScale } from '../features/photo/texture-spec.ts'
export {
  type Ladder,
  type PhotoKnobs,
  type PhotoSource,
  photoToTile,
  type Tile,
  tileColours,
  tileFromLab,
  unpack,
} from '../features/photo/tile.ts'
