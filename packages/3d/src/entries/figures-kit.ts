// @automata/3d/figures-kit: what an extension author needs to write a wardrobe, a set of garments the figure
// builder dresses a body in. The classic garments are core; a wardrobe (examples/3d/wardrobe is the worked one)
// registers its own kinds with `registerGarment`, builds each into the dressed body from a `Wearing` into a
// `Fit`, and may tune the outfit with `registerOutfitHooks`.
//
// This is the whole surface a garment builder reaches into: the registry and its contract types, the body and
// rig a garment is sized from, the mesh parts and skinning it builds, the head and hair it must clear, and the
// maths. Nothing here is a second copy of a core contract; each name is the core one.

// The classic set registers first, because garments are told apart in registration order: loading the kit loads it, so a
// wardrobe's kinds always come after.
import '../features/figures/outfit/garments/classic-kinds.ts'

export type { Measure } from '../features/figures/body/genes.ts'
export {
  type Decal,
  GROUP,
  type Mesh,
  type Part,
  placed,
  sgnPow,
  type Weight,
} from '../features/figures/body/mesh.ts'
export type { Body } from '../features/figures/body/profiles.ts'
export { reach } from '../features/figures/body/reach.ts'
export { at, J, type Side, type Skeleton } from '../features/figures/body/rig.ts'
export { hemSkin, weights } from '../features/figures/body/skin-weights.ts'
export { type Superquadric, superquadric } from '../features/figures/body/superquadric.ts'
export { FIGURE_PPM } from '../features/figures/body/texels.ts'
export type { Anchor } from '../features/figures/figure/anchors.ts'
export {
  type CustomGarment,
  type Garment,
  garmentSchema,
  withSwatchDefaults,
} from '../features/figures/figure/garment.schema.ts'
export { type Made, variant } from '../features/figures/figure/materials.ts'
export { CROWN, onSkull, skull, toHead } from '../features/figures/hair/skull.ts'
export { sweep } from '../features/figures/hair/sweep.ts'
export { ear, headForm, SIDES } from '../features/figures/outfit/garments/head.ts'
export type {
  Fit,
  Legs,
  Paint,
  Section,
  Shell,
  Wearing,
  Worn,
} from '../features/figures/registry/garment-fit.ts'
export {
  fieldRole,
  GARMENTS,
  type GarmentKind,
  garmentKind,
  garmentOf,
  type Kind,
  type Layer,
  type Role,
  registeredGarments,
  registerGarment,
  roleOf,
  TAKES,
} from '../features/figures/registry/garment-registry.ts'
export {
  type OutfitBody,
  type OutfitHooks,
  registerOutfitHooks,
} from '../features/figures/registry/outfit-hooks-registry.ts'
export { RegistryClash } from '../features/figures/registry/registry-clash.ts'
export {
  add,
  axisAngle,
  clamp,
  cross,
  dot,
  lerp,
  normalize,
  scale,
  smooth,
  sub,
  type V3,
} from '../shared/math/math.ts'
