// @automata/3d/props-kit: what an extension author needs to make props, the things a room is furnished with. A
// generator turns a library preset's parameters into pieces (a mesh, the swatch it is painted with, a label);
// `registerPropGenerator` gives it a `kind` a preset can name. The room's plan (rings, walls, the way is inward) is
// here too, for an extension that places props (a dresser). Core ships a box, a cylinder and the five props the base
// scenes use; @automata/world-kit is built on this entry for the rest. Each name is the core one, never a copy.

export { buildWorld, type World, type WorldPiece } from '../features/world/build.ts'
export { blob, box, cone, cylinder, quad, rbox, rod } from '../features/world/mesh.ts'
export {
  type Built,
  type Generator,
  lightOf,
  type Params,
  type PropLight,
  type PropPiece,
  part,
} from '../features/world/props/piece.ts'
export { registerPropGenerator } from '../features/world/props/prop-generator-registry.ts'
export {
  isFault,
  type PropFault,
  type ResolvedProp,
  resolveProp,
} from '../features/world/props/resolve.ts'
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
export { type MeshData, merge, placed, type TubeOptions, tube } from '../shared/math/geometry.ts'
export { type Limb, limb, type Ring } from '../shared/math/limb.ts'
export { at, axisAngle, type Q, type V3 } from '../shared/math/math.ts'
export { noise3 } from '../shared/math/noise.ts'
export { RegistryClash } from '../shared/registry/registry-clash.ts'
