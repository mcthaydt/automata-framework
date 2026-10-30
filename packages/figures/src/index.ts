// @mcthaydt/automata-figures: procedural characters (M3 spec §4.4), renderer-free. Part 1 (M3.5a): the math,
// the shared rig and its two-bone IK, the gene sliders, the figure and library content kinds, and the
// extension that registers them. Part 2 (M3.5b): `build()`, the part, garment and hair generators behind it.
// Part 3 (M3.5c): locomotion (`base()`, `moveDir`), stands, holds, hems, the pose clock and the hair spring.
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) at a1f7246.

export { type Anchor, type AnchorKind, clearance } from './build/anchors'
export { type Built, build, type FigureLibrary } from './build/build'
export type { BuiltMaterial } from './build/materials'

export {
  FIGURE_CONTENT,
  figureContent,
  figureGaitContent,
  figureHairContent,
  figureHeadwearContent,
  figureItemContent,
  figureRigContent,
  figureStandContent,
  figureSwatchContent,
} from './content/figures.content'
export { type FigureDef, figureSchema, type HairDynamics } from './figure/figure.schema'
export {
  type FigureBody,
  genesOf,
  type SkeletonProblem,
  skeleton,
  skeletonProblems,
} from './figure/figure-skeleton'
export type {
  Apron,
  Belt,
  Bomber,
  Cape,
  CapGarment,
  Cargos,
  Chain,
  Classic,
  Coat,
  Eyes,
  Gloves,
  HairGarment,
  Hoodie,
  Hoops,
  Jacket,
  LegWear,
  Mark,
  Puffer,
  Shades,
  Shoes,
  Skirt,
  Sneakers,
  Streetwear,
  Tee,
  Top,
  Trousers,
  Waistcoat,
  WideLegs,
} from './figure/garment.schema'
export { type Garment, garmentSchema } from './figure/garment.schema'
export { figuresExtension } from './figures.extension'
export {
  DEFAULT_HEAD,
  DEFAULT_SLIDERS,
  type HeadShape,
  type Measure,
  measure,
  type Sliders,
} from './genes/genes'
export { type Gait, gaitOverridesSchema, gaitSchema } from './library/gait.schema'
export { type HairStyle, hairStyleSchema, type Piece, type Rope } from './library/hair.schema'
export { type Cap, type Headwear, headwearSchema, type Lock } from './library/headwear.schema'
export { type Hold, type ItemDef, type ItemPart, itemSchema } from './library/item.schema'
export { DEFAULT_RIG_LIMITS, type Range, type RigLimits, rigLimitsSchema } from './library/rig-limits.schema'
export { type HandPlace, type Hang, type Stand, standSchema } from './library/stand.schema'
export { SWATCH_KINDS, SWATCH_ROLES, type Swatch, swatchSchema } from './library/swatch.schema'
export { type SwatchColourProblem, swatchColourProblems } from './library/swatch-colours'
export * from './math/math'
export { base, relaxed } from './motion/base'
export {
  headLead,
  type PoseClock,
  poseClock,
  shufflePhase,
  turnStep,
  wrapAngle,
} from './motion/clock'
export { DEFAULT_HAIR, gaitOf, hairOf } from './motion/gait-of'
export { type FootTarget, walkFoot } from './motion/gait-path'
export {
  HAIR_AT_REST,
  type HairInput,
  type HairSpring,
  hairStep,
  headNod,
} from './motion/hair-spring'
export { placeHems } from './motion/hems'
export { applyHold, evaluateMotion, holdOf } from './motion/hold'
export type { ArmHold, Evaluated, HairSwing, MotionState } from './motion/motion-state'
export {
  CHAIN,
  fits,
  openings,
  place,
  type Surface,
  standFor,
  standHolds,
} from './motion/stands'
export { type Decal, GROUP, type Mesh, type Part, type Weight } from './parts/mesh'
export { FIGURE_PPM } from './parts/texels'
export {
  armChain,
  clonePose,
  fk,
  type Genes,
  J,
  JOINTS,
  type Joint,
  PARENTS,
  type Pose,
  restPose,
  type Side,
  type Skeleton,
  skeletonFromGenes,
} from './rig/rig'
export { twoBoneIK } from './rig/two-bone-ik'
