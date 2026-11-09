// @automata/3d/props-kit: what an extension author needs to make props, the things a room is furnished with. A
// generator turns a library preset's parameters into pieces (a mesh, the swatch it is painted with, a label);
// `registerPropGenerator` gives it a `kind` a preset can name. The room's plan (rings, walls, the way is inward) is
// here too, for an extension that places props (a dresser). Core ships a box, a cylinder and the five props the base
// scenes use. The rest of the kit (chairs, beds, shelves, plants, cars, signs), the dresser, the generated maps and the
// readability rules are here too, and loading `base` registers the generators. Each name is the core one, never a copy.

export { buildWorld } from '../features/world/build.ts'
export { type Dressed, dressLevel } from '../features/world/furnish/dress.ts'
export type { Kit, KitSlot, SlotRule } from '../features/world/furnish/kit.schema.ts'
export { generateMap, MAP_NAMES, type MapName } from '../features/world/maps/generate-map.ts'
export { blob, box, cone, cylinder, quad, rbox, rod } from '../features/world/mesh.ts'
export {
  type Built,
  type Generator,
  lightOf,
  type PropLight,
  type PropPiece,
  part,
} from '../features/world/props/piece.ts'
export { registerPropGenerator } from '../features/world/props/prop-generator-registry.ts'
export { isFault, resolveProp } from '../features/world/props/resolve.ts'
export { type FigureRead, type Frame, figureReads } from '../features/world/reads/figure-reads.ts'
export {
  DEFAULT_READS,
  HOT,
  isHot,
  MIN_READ,
  readsAgainst,
  waivedBy,
} from '../features/world/reads/reads-against.ts'
export {
  cornersOf,
  heightAt,
  inside,
  inward,
  ringsOf,
  type Segment,
  segments,
  signedArea,
  type V2,
} from '../features/world/sectors.ts'
export { stream } from '../features/world/stream.ts'
export { hasSwatch, type WorldLibrary } from '../features/world/swatches.ts'
export { oklab } from '../shared/math/colour.ts'
export { type MeshData, merge, placed, ringTube } from '../shared/math/geometry.ts'
export { limb } from '../shared/math/limb.ts'
export { at, axisAngle, type V3 } from '../shared/math/math.ts'
