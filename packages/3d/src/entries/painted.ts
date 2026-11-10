// @automata/3d/painted: figures generated from data and painted as pixel art, texel by texel, then drawn in the 3D scene.
// A character is data (a CharacterDef of sliders, a gait and outfits of library garments, starting from the base pair,
// BASE); `member` makes it a cast member at a density. The review frames draw its sheets (`standing`, `walking`, `hero`);
// a Figure poses and paints it frame by frame; `lightFigure` lights that cell; `paintedFigure` is its view for
// `createPixi3dRenderer`. A wardrobe adds itself through the registries (garment kinds, outfit hooks, hair pieces and
// finishes, fabrics).

// ─── Characters ───
export { BASE, type BaseFigure } from '../features/painted/base/base.ts'
export type { HeadShape, Measure, Sliders } from '../features/painted/body/genes.ts'
export { DEFAULT_HEAD, DEFAULT_SLIDERS } from '../features/painted/body/genes.ts'
export type { Decal, Material, Mesh, Part, Print, Superquadric } from '../features/painted/body/parts.ts'
export { J, JOINTS, type Joint, type Pose, type Side, type Skeleton } from '../features/painted/body/rig.ts'
export { type CastMember, type CharacterDef, fromDef } from '../features/painted/figure/cast.ts'
// ─── Drawing ───
export { Figure, type FigureInput, type FigureLight, type View } from '../features/painted/figure/figure.ts'
export { type Frame, hero, member, standing, view, walking } from '../features/painted/figure/frames.ts'
// ─── What a wardrobe registers: garment kinds, outfit hooks, hair pieces, hair finishes, fabrics ───
export {
  HAIR_STYLES,
  type HairCtx,
  type HairFinish,
  type HairInput,
  type HairPiece,
  type HairStyle,
  type Piece,
  registerFinish,
  registerHairPiece,
  type Skull,
  type Tie,
  type Tone,
} from '../features/painted/hair/hair.ts'
export type { V3 } from '../features/painted/lib/math.ts'
export { FIGURE_KEY, type Lamp, TIMES, type TimeOfDay } from '../features/painted/lighting/lamps.ts'
// ─── Lighting ───
export { type Bounce, type Lighting, lightFigure } from '../features/painted/lighting/light.ts'
// ─── Motion ───
export {
  type Anchor,
  applyHold,
  evaluate,
  type Gait,
  type Hold,
  type MotionState,
  type Seat,
  type SeatHand,
  type Stand,
  seated,
} from '../features/painted/motion/motion.ts'
export { GAITS, POSES, SEATS } from '../features/painted/motion/presets.ts'
export type { Body, Profiles, Region } from '../features/painted/outfit/fit.ts'
export {
  type BaseGarment,
  EXPRESSIONS,
  type Expression,
  type Fit,
  type Garment,
  type GarmentKind,
  type GarmentKinds,
  type Look as Dressed,
  type OutfitHooks,
  type Regions,
  registerGarment,
  registerOutfitHooks,
  SWATCHES,
  type Wearing,
} from '../features/painted/outfit/garments.ts'
export { ITEMS, type Item, type ItemDef, itemOf } from '../features/painted/outfit/items.ts'
// ─── In the 3D scene ───
export { RAMP_OUTLINE, RAMPS } from '../features/painted/paint/duel-ramps.ts'
export { type Fabric, registerFabric } from '../features/painted/paint/fabric.ts'
export { anchorOf, facing, texelOf, viewFrom } from '../features/painted/view/camera.ts'
export { FigureSprite, type FigureSpriteInput } from '../features/painted/view/figure-sprite.ts'
export {
  type PaintedFigureOptions,
  type PaintedState,
  paintedFigure,
} from '../features/painted/view/painted-view.ts'
