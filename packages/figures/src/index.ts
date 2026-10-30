// @mcthaydt/automata-figures: procedural characters (M3 spec §4.4), renderer-free. Part 1 (M3.5a): the math,
// the shared rig and its two-bone IK, the gene sliders, the figure and library content kinds, and the
// extension that registers them. Extracted from FigureBuilder (mcthaydt/FigureBuilder) at a1f7246.
// Part 5 (M3.6a): `solve()`, the rig's handles (effectors, poles, aim, pins) and its joint limits.
// Part 6 (M3.6b): poses (`figure-pose` content), their canonical spelling, mirror, blend and checks.

export {
  FIGURE_CONTENT,
  figureContent,
  figureGaitContent,
  figureHairContent,
  figureHeadwearContent,
  figureItemContent,
  figurePoseContent,
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
export { applyPose } from './pose/apply-pose'
export { blend } from './pose/blend'
export { mirror } from './pose/mirror'
export { type PoseDef, poseSchema } from './pose/pose.schema'
export { figureReach, type PoseProblem, poseProblems, REFERENCE_SKELETON } from './pose/pose-checks'
export { canonicalPose, printPose, roundPoseNumber } from './pose/pose-spelling'
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
export { hingeFlexion, type JointLimit, jointLimits, limitExcess, swingAngle } from './solve/limits'
export { eulerOf } from './solve/rotation'
export { type Solved, solve } from './solve/solve'
export type {
  AimTarget,
  EffectorId,
  EffectorTarget,
  LimbId,
  PoleId,
  PoleTarget,
  Reach,
  SolveReport,
  Space,
  Targets,
  Vec3,
} from './solve/targets'
