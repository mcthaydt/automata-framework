// `@mcthaydt/automata-content/assets` (M5.6): the asset build, kept out of the main entry so code that only
// compiles content, and any browser bundle, never loads the PNG codec.

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
