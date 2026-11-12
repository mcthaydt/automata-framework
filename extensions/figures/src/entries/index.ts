// biome-ignore-all assist/source/organizeImports: the exports are grouped by subject under their own comments; a sort would detach the comments
/**
 * The painter's public surface. A character is data — a CharacterDef of sliders, a gait and outfits as lists of
 * library garments, starting from a base figure (BASE) — and `member` makes it a cast member at a density. The review
 * frames draw its sheets (`standing`, `walking`, `hero`); a Figure poses and paints it frame by frame, with a normal
 * map; `lightFigure` lights that cell with lamps and a time of day; an actor (ScriptedActor) plays it from a script that
 * is a pure function of time. Forks build on these, and add their wardrobe through the registries (garment kinds, outfit
 * hooks, hair pieces and finishes); everything not exported here is internal.
 */
// ─── Characters ───
export { BASE, type BaseFigure } from '../shared/base/base-pair'
export { fromDef, type CharacterDef, type CastMember } from '../shared/figure/cast'
export { DEFAULT_SLIDERS, DEFAULT_HEAD, type Sliders, type HeadShape } from '../shared/body/genes'
// ─── What they wear and hold ───
export { SWATCHES, EXPRESSIONS, type Garment, type Expression } from '../shared/outfit/garments'
export { ITEMS, itemOf, type Item } from '../shared/outfit/items'
export { HAIR_STYLES } from '../shared/hair/hair'
export type { Material, Part, Decal, Print, Mesh, Superquadric } from '../shared/body/parts'
export type { Measure } from '../shared/body/genes'
export type { Skeleton } from '../shared/body/rig'
// ─── What a fork registers: garment kinds (H1), outfit hooks (H2), hair pieces (H3), hair finishes (H4), fabrics (H5) ───
export { registerFabric, type Fabric } from '../shared/paint/fabric'
export {
  registerGarment,
  registerOutfitHooks,
  type GarmentKind,
  type Wearing,
  type Fit,
  type OutfitHooks,
  type Regions,
  type BaseGarment,
  type GarmentKinds,
  type Look as Dressed,
} from '../shared/outfit/garments'
export type { Body, Profiles, Region } from '../shared/outfit/fit'
export type { ShoeForm, Foot } from '../shared/outfit/shoe'
export type { ItemDef } from '../shared/outfit/items'
export {
  registerHairPiece,
  registerFinish,
  type HairPiece,
  type HairCtx,
  type HairInput,
  type HairStyle,
  type HairFinish,
  type Piece,
  type Skull,
  type Tone,
  type Tie,
} from '../shared/hair/hair'
// ─── Motion ───
export { GAITS, POSES, SEATS } from '../shared/motion/presets'
export {
  seated,
  applyHold,
  evaluate,
  type Gait,
  type Stand,
  type Seat,
  type SeatHand,
  type MotionState,
  type Anchor,
  type Hold,
} from '../shared/motion/motion'
export type { V3 } from '../shared/math/math'
export { J, JOINTS, type Joint, type Side, type Pose } from '../shared/body/rig'
// ─── Drawing ───
export { Figure, type View, type FigureInput, type FigureLight } from '../shared/figure/figure'
export { member, view, standing, walking, hero, SPRITE_PITCH, type Frame } from '../shared/figure/frames'
export { RAMPS, RAMP_OUTLINE } from '../shared/paint/duel-ramps'
// ─── Lighting ───
export { lightFigure, type Lighting, type Bounce } from '../shared/lighting/light'
export {
  lightSprite,
  flatSteps,
  SPRITE_STYLE,
  type SpriteLighting,
  type SpriteLamp,
  type SpriteStyle,
} from '../shared/lighting/sprite'
export { TIMES, FIGURE_KEY, type Lamp, type TimeOfDay } from '../shared/lighting/lamps'
// ─── Actors: the scripting layer (docs/actors.md) ───
export {
  ScriptedActor,
  Troupe,
  characterOf,
  scriptOf,
  type ActorScript,
  type ActorOptions,
  type ActionCue,
  type Waypoint,
  type Placement,
} from '../shared/actors/actor'
export { ACTIONS, actionOf, lengthOf, envelopeOf } from '../shared/actors/actions'
// ─── The stage: figures in a scene (docs/contract.md) ───
export {
  STAGE_VERSION,
  TIE_BIAS,
  stageFrame,
  compose,
  texelDepths,
  type StageSprite,
  type StageFrame,
  type StageOptions,
  type Backdrop,
} from '../shared/stage/stage'
export { cellOf, type Cell } from '../shared/stage/cell'
export {
  lookAt,
  viewOf,
  project,
  zoomOf,
  densityFor,
  GAMEPLAY,
  gameplay,
  type CameraPose,
} from '../shared/stage/pose'
export type { Casting } from '../shared/actors/actor'
