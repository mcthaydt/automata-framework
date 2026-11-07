// @automata/world-kit: ready-made props, furnished rooms, signs and generated maps for AF's 3D worlds. Loading it
// registers its prop generators.
export { dressedBaseScenes } from '../app/dressed-base-scenes.ts'
export { worldKitExtension } from '../app/world-kit.extension.ts'
export { worldKitLibrary } from '../app/world-kit-library.ts'
export { type Dressed, dressLevel } from '../features/furnish/dress.ts'
export { worldKitContent } from '../features/furnish/kit.content.ts'
export type { Kit, KitSlot, SlotRule } from '../features/furnish/kit.schema.ts'
export { generateMap, MAP_NAMES, type MapName } from '../features/maps/generate-map.ts'
export { type FigureRead, type Frame, figureReads } from '../features/reads/figure-reads.ts'
export {
  DEFAULT_READS,
  HOT,
  isHot,
  MIN_READ,
  readsAgainst,
  waivedBy,
} from '../features/reads/reads-against.ts'
