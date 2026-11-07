// @automata/3d/figures: procedural characters (M3 spec §4.4), renderer-free. Part 1 (M3.5a): the math,
// the shared rig and its two-bone IK, the gene sliders, the figure and library content kinds, and the
// extension that registers them. Part 2 (M3.5b): `build()`, the part, garment and hair generators behind it.
// Part 3 (M3.5c): locomotion (`base()`, `moveDir`), stands, holds, hems, the pose clock and the hair spring.
// Part 5 (M3.6a): `solve()`, the rig's handles (effectors, poles, aim, pins) and its joint limits.
// Part 6 (M3.6b): poses (`figure-pose` content), their canonical spelling, mirror, blend and checks.
// Part 7 (M3.6c): clips (`figure-clip` content), eases, sampling, loop and stepped time, retime and markers.
// Part 8 (M3.6d): `evaluate()`, the layers in order (locomotion, stances, the action and its transition, aim, the
// solve, holds by mask, the hems), and FigureBuilder's reach, look and flinch as fixture clips.
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) at a1f7246.

export { figuresExtension } from '../app/figures.extension.ts'
export {
  DEFAULT_HEAD,
  DEFAULT_SLIDERS,
  type HeadShape,
  type Measure,
  measure,
  type Sliders,
} from '../features/figures/body/genes.ts'
export { type Decal, GROUP, type Mesh, type Part, type Weight } from '../features/figures/body/mesh.ts'
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
} from '../features/figures/body/rig.ts'
export { FIGURE_PPM } from '../features/figures/body/texels.ts'
export { twoBoneIK } from '../features/figures/body/two-bone-ik.ts'
export {
  type ClipKey,
  clipSchema,
  type FigureClipDef,
  MASK_GROUPS,
  type MaskGroup,
} from '../features/figures/clips/clip.schema.ts'
export { clipTime, markerTime, retime, smoothTime, stepTime } from '../features/figures/clips/clip-time.ts'
export { type ClipWarning, clipWarnings } from '../features/figures/clips/clip-warnings.ts'
export { evaluate, type FigureEvaluated } from '../features/figures/clips/evaluate.ts'
export { clipsWithActions, compileAction, NEUTRAL_POSE } from '../features/figures/clips/figure-action.ts'
export type {
  ActionState,
  ClipStart,
  EvaluateOptions,
  FigureState,
  MotionLibrary,
  StanceState,
} from '../features/figures/clips/figure-state.ts'
export { maskPose } from '../features/figures/clips/masks.ts'
export { chestFrame, type PoseLibrary, sample } from '../features/figures/clips/sample.ts'
export { type FigureAction, figureActionSchema } from '../features/figures/content/figure-action.schema.ts'
export {
  FIGURE_CONTENT,
  figureActionContent,
  figureClipContent,
  figureContent,
  figureGaitContent,
  figureHairContent,
  figureHeadwearContent,
  figureItemContent,
  figurePoseContent,
  figureRigContent,
  figureStandContent,
  figureSwatchContent,
} from '../features/figures/content/figures.content.ts'
export { type Gait, gaitOverridesSchema, gaitSchema } from '../features/figures/content/gait.schema.ts'
export {
  type HairStyle,
  hairStyleSchema,
  type Piece,
  type Rope,
} from '../features/figures/content/hair.schema.ts'
export {
  type Cap,
  type Headwear,
  headwearSchema,
  type Lock,
} from '../features/figures/content/headwear.schema.ts'
export {
  type Hold,
  type ItemDef,
  type ItemPart,
  itemSchema,
} from '../features/figures/content/item.schema.ts'
export {
  DEFAULT_RIG_LIMITS,
  type Range,
  type RigLimits,
  rigLimitsSchema,
} from '../features/figures/content/rig-limits.schema.ts'
export {
  type HandPlace,
  type Hang,
  type Stand,
  standSchema,
} from '../features/figures/content/stand.schema.ts'
export {
  SWATCH_KINDS,
  SWATCH_ROLES,
  type Swatch,
  swatchSchema,
} from '../features/figures/content/swatch.schema.ts'
export { type SwatchColourProblem, swatchColourProblems } from '../features/figures/content/swatch-colours.ts'
export { type Anchor, type AnchorKind, clearance } from '../features/figures/figure/anchors.ts'
export { type Built, build, type FigureLibrary } from '../features/figures/figure/build.ts'
export { type FigureDef, figureSchema, type HairDynamics } from '../features/figures/figure/figure.schema.ts'
export {
  type FigureBody,
  genesOf,
  type SkeletonProblem,
  skeleton,
  skeletonProblems,
} from '../features/figures/figure/figure-skeleton.ts'
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
} from '../features/figures/figure/garment.schema.ts'
export { type Garment, garmentSchema } from '../features/figures/figure/garment.schema.ts'
export type { BuiltMaterial } from '../features/figures/figure/materials.ts'
export type { HairBuild } from '../features/figures/hair/hair-parts.ts'
export { applyPose } from '../features/figures/motion/apply-pose.ts'
export { base, relaxed } from '../features/figures/motion/base.ts'
export { blend, blendAt } from '../features/figures/motion/blend.ts'
export {
  headLead,
  type PoseClock,
  poseClock,
  shufflePhase,
  turnStep,
  wrapAngle,
} from '../features/figures/motion/clock.ts'
export { DEFAULT_HAIR, gaitOf, hairOf } from '../features/figures/motion/gait-of.ts'
export { type FootTarget, walkFoot } from '../features/figures/motion/gait-path.ts'
export {
  HAIR_AT_REST,
  type HairInput,
  type HairSpring,
  hairStep,
  headNod,
} from '../features/figures/motion/hair-spring.ts'
export { placeHems } from '../features/figures/motion/hems.ts'
export { applyHold, evaluateMotion, holdOf } from '../features/figures/motion/hold.ts'
export {
  hingeFlexion,
  type JointLimit,
  jointLimits,
  limitExcess,
  swingAngle,
} from '../features/figures/motion/limits.ts'
export { mirror } from '../features/figures/motion/mirror.ts'
export type { ArmHold, Evaluated, HairSwing, MotionState } from '../features/figures/motion/motion-state.ts'
export { type PoseDef, poseSchema } from '../features/figures/motion/pose.schema.ts'
export {
  figureReach,
  type PoseProblem,
  poseProblems,
  REFERENCE_SKELETON,
} from '../features/figures/motion/pose-checks.ts'
export type { SpaceContext } from '../features/figures/motion/pose-space.ts'
export { canonicalPose, printPose, roundPoseNumber } from '../features/figures/motion/pose-spelling.ts'
export { eulerOf } from '../features/figures/motion/rotation.ts'
export { type Solved, solve } from '../features/figures/motion/solve.ts'
export {
  CHAIN,
  fits,
  openings,
  place,
  type Surface,
  standFor,
  standHolds,
} from '../features/figures/motion/stands.ts'
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
} from '../features/figures/motion/targets.ts'
export {
  type Fabric,
  fabricOf,
  labelAt,
  registerFabric,
} from '../features/figures/registry/fabric-registry.ts'
export {
  type GarmentKind,
  registeredGarments,
  registerGarment,
} from '../features/figures/registry/garment-registry.ts'
export { type HairFinish, registerFinish } from '../features/figures/registry/hair-finish-registry.ts'
export { type HairPiece, registerHairPiece } from '../features/figures/registry/hair-piece-registry.ts'
export { type OutfitHooks, registerOutfitHooks } from '../features/figures/registry/outfit-hooks-registry.ts'
export { RegistryClash } from '../features/figures/registry/registry-clash.ts'
export * from '../shared/math/math.ts'
export { type Ease, easeAt, easeSchema, parseEase } from '../shared/timeline/ease.ts'
