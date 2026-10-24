// `@mcthaydt/automata-content/assets` (M5.6, M5.5): the asset build, kept out of the main entry so code that only
// compiles content, and any browser bundle, never loads the PNG codec or the font subsetter.

export {
  ATLAS_EXTRUDE,
  ATLAS_PADDING,
  ATLAS_PAGE_MAX,
  AtlasFrameTooLarge,
  type FrameSize,
  type PackedAtlas,
  type Placement,
  packFrames,
} from './atlas-pack'
export { type AtlasOutputs, buildAtlases } from './build-atlases'
export { buildFonts, type FontOutputs } from './build-fonts'
export { fontCoverage, subsetWoff2 } from './font-subset'
export type { FontSource, FontsFile } from './fonts.schema'
