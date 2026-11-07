// @automata/world-kit/textures: the kit's photo textures and the checks that read them. Node only: it reads the photo
// library from disk. `photoToTile` makes a tile from a PNG's bytes; `checkReads` holds a level's textured swatches to the
// `reads` they declare. The `automata-world-textures` command makes the tiles the kit commits.
export { checkReads } from '../features/textures/check-reads.ts'
export {
  PHOTO_DIR,
  type Photo,
  type PhotoLibrary,
  photoBytes,
  photoHash,
  photoOf,
  readPhotoLibrary,
} from '../features/textures/photos.ts'
export { decodePng, type Image } from '../features/textures/png.ts'
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
} from '../features/textures/structure.ts'
export { swatchIssues } from '../features/textures/swatch-issues.ts'
export {
  decodeTileFile,
  ladderOf,
  staleTiles,
  type TexturedSwatch,
  TILE_FORMAT,
  type TileFile,
  type TileProblem,
  textureOf,
  tileFileOf,
} from '../features/textures/swatch-tiles.ts'
export { TEXTURE_DEFAULTS, type TextureSpec } from '../features/textures/texture-spec.ts'
export { readTiles, runTextures, TILE_DIR } from '../features/textures/textures-command.ts'
export {
  type Ladder,
  type PhotoKnobs,
  photoToTile,
  type Tile,
  tileColours,
  unpack,
} from '../features/textures/tile.ts'
