/**
 * FigureBuilder's public surface. A character is data — a CharacterDef of sliders, a gait and outfits as lists of
 * library garments, starting from a base figure (BASE) — and `member` makes it a cast member at a density. The review
 * frames draw its sheets (`standing`, `walking`, `hero`); a Figure poses and paints it frame by frame, with a normal
 * map; `lightFigure` lights that cell with lamps and a time of day; an actor (ScriptedActor) plays it from a script that
 * is a pure function of time. Forks build on these; everything not exported here is internal.
 */
// ─── Characters ───
export { BASE, type BaseFigure } from '../base/base';
export { fromDef, type CharacterDef, type CastMember } from './features/figure/cast';
export { DEFAULT_SLIDERS, DEFAULT_HEAD, type Sliders, type HeadShape } from './features/body/genes';
// ─── What they wear and hold ───
export { SWATCHES, EXPRESSIONS, type Garment, type Expression } from './features/outfit/garments';
export { ITEMS, type Item } from './features/outfit/items';
export { HAIR_STYLES } from './features/hair/hair';
export type { Material } from './features/body/parts';
// ─── Motion ───
export { GAITS, POSES } from './features/motion/presets';
export type { Gait, Stand } from './features/motion/motion';
export { J, JOINTS, type Joint, type Side, type Pose } from './features/body/rig';
// ─── Drawing ───
export { Figure, type View, type FigureInput } from './features/figure/figure';
export { member, view, standing, walking, hero, type Frame } from './features/figure/frames';
export { RAMPS, RAMP_OUTLINE } from './features/paint/duel-ramps';
// ─── Lighting ───
export { lightFigure, type Lighting, type Bounce } from './features/lighting/light';
export { TIMES, FIGURE_KEY, type Lamp, type TimeOfDay } from './features/lighting/lamps';
// ─── Actors: the scripting layer (docs/actors.md) ───
export { ScriptedActor, Troupe, characterOf, scriptOf, type ActorScript, type ActorOptions, type ActionCue, type Waypoint, type Placement } from './features/actors/actor';
export { ACTIONS, actionOf, lengthOf } from './features/actors/actions';
