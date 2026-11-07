// @automata/3d/figures-kit: what an extension author needs to write a wardrobe, a set of garments the figure
// builder dresses a body in. The classic garments are core; a wardrobe (examples/3d/wardrobe is the worked one)
// registers its own kinds with `registerGarment`, builds each into the dressed body from a `Wearing` into a
// `Fit`, and may tune the outfit with `registerOutfitHooks`.
//
// This is the whole surface a garment or a hair piece builder reaches into: the registries and their contract types, the
// body and rig a garment is sized from, the mesh parts and skinning it builds, the head and hair it must clear, the
// skull a hair piece is laid on, and the maths. Nothing here is a second copy of a core contract; each name is the core
// one. @automata/character-kit (the clothes and hairstyles core left out) is built on it.

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
export { hemSkin, hemWeights, weights } from '../features/figures/body/skin-weights.ts'
export { FIGURE_PPM, texels } from '../features/figures/body/texels.ts'
export { type Rope, ropeSchema, tieSchema, toneSchema } from '../features/figures/content/hair.schema.ts'
export {
  type Line,
  line,
  type Vec2,
  type Vec3,
  vec2,
  vec3,
} from '../features/figures/content/shapes.schema.ts'
export type { Anchor } from '../features/figures/figure/anchors.ts'
export {
  type CustomGarment,
  type Garment,
  garmentSchema,
  withSwatchDefaults,
} from '../features/figures/figure/garment.schema.ts'
export { type Made, variant } from '../features/figures/figure/materials.ts'
export { type HairBuild, type HairInput, hairParts } from '../features/figures/hair/hair-parts.ts'
export { type Scalp, shell } from '../features/figures/hair/shell.ts'
export {
  alignY,
  along,
  CROWN,
  HAIR_SEAM,
  onHead,
  onSkull,
  skull,
  toHead,
  unitAt,
} from '../features/figures/hair/skull.ts'
export { grid, spline, sweep } from '../features/figures/hair/sweep.ts'
export { armGroup, TRAPEZIUS, trapezius } from '../features/figures/outfit/garments/body.ts'
export { type Dressing, hemAt } from '../features/figures/outfit/garments/classic.ts'
export {
  ear,
  FACE_SEAM,
  headAt,
  headForm,
  headNormal,
  SIDES,
} from '../features/figures/outfit/garments/head.ts'
export { box } from '../features/figures/outfit/garments/locks.ts'
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
export {
  add,
  axisAngle,
  clamp,
  cross,
  dot,
  hash,
  lerp,
  normalize,
  scale,
  smooth,
  sub,
  type V3,
} from '../shared/math/math.ts'
export { type Superquadric, superquadric, tube } from '../shared/math/superquadric.ts'
export { RegistryClash } from '../shared/registry/registry-clash.ts'
