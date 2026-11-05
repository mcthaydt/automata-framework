/**
 * FigureBuilder's public surface. A character is data — a CharacterDef of sliders, a gait and outfits as lists of
 * library garments, starting from a base figure (BASE) — and `member` makes it a cast member at a density. The review
 * frames draw its sheets (`standing`, `walking`, `hero`); a Figure poses and paints it frame by frame, with a normal
 * map; `lightFigure` lights that cell with lamps and a time of day; an actor (ScriptedActor) plays it from a script that
 * is a pure function of time. Forks build on these, and add their wardrobe through the registries (garment kinds, outfit
 * hooks, hair pieces and finishes); everything not exported here is internal.
 */
// ─── Characters ───
export { BASE, type BaseFigure } from '../base/base';
export { fromDef, type CharacterDef, type CastMember } from './features/figure/cast';
export { DEFAULT_SLIDERS, DEFAULT_HEAD, type Sliders, type HeadShape } from './features/body/genes';
// ─── What they wear and hold ───
export { SWATCHES, EXPRESSIONS, type Garment, type Expression } from './features/outfit/garments';
export { ITEMS, itemOf, type Item } from './features/outfit/items';
export { HAIR_STYLES } from './features/hair/hair';
export type { Material, Part, Decal, Print, Mesh, Superquadric } from './features/body/parts';
export type { Measure } from './features/body/genes';
export type { Skeleton } from './features/body/rig';
// ─── What a fork registers: garment kinds (H1), outfit hooks (H2), hair pieces (H3), hair finishes (H4) ───
export { registerGarment, registerOutfitHooks, type GarmentKind, type Wearing, type Fit, type OutfitHooks,
  type Regions, type BaseGarment, type GarmentKinds, type Look as Dressed } from './features/outfit/garments';
export type { ItemDef } from './features/outfit/items';
export { registerHairPiece, registerFinish, type HairPiece, type HairCtx,
  type HairInput, type HairStyle, type HairFinish, type Piece, type Skull, type Tone, type Tie } from './features/hair/hair';
// ─── Motion ───
export { GAITS, POSES, SEATS } from './features/motion/presets';
export { seated, applyHold, evaluate, type Gait, type Stand, type Seat, type SeatHand, type MotionState, type Anchor, type Hold } from './features/motion/motion';
export type { V3 } from './lib/math';
export { J, JOINTS, type Joint, type Side, type Pose } from './features/body/rig';
// ─── Drawing ───
export { Figure, type View, type FigureInput, type FigureLight } from './features/figure/figure';
export { member, view, standing, walking, hero, type Frame } from './features/figure/frames';
export { RAMPS, RAMP_OUTLINE } from './features/paint/duel-ramps';
// ─── Lighting ───
export { lightFigure, type Lighting, type Bounce } from './features/lighting/light';
export { TIMES, FIGURE_KEY, type Lamp, type TimeOfDay } from './features/lighting/lamps';
// ─── Actors: the scripting layer (docs/actors.md) ───
export { ScriptedActor, Troupe, characterOf, scriptOf, type ActorScript, type ActorOptions, type ActionCue, type Waypoint, type Placement } from './features/actors/actor';
export { ACTIONS, actionOf, lengthOf, envelopeOf } from './features/actors/actions';
