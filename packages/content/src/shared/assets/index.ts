// `@automata/content/assets`: the asset build, kept out of the main entry so code that only
// compiles content, and any browser bundle, never loads the PNG codec or the font subsetter.

export { gameWords } from '../locale/game-words'
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
export { type FontRename, fontCoverage, subsetWoff2 } from './font-subset'
export type { FontSource, FontsFile } from './fonts.schema'
