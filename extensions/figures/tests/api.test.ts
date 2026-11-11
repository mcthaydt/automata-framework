import { describe, expect, it } from 'vitest';
import {
  ACTIONS, actionOf, applyHold, BASE, envelopeOf, evaluate, Figure, GAITS, itemOf, lengthOf, hero, lightFigure, member, registerFinish, registerFabric,
  registerGarment, registerHairPiece, registerOutfitHooks, ScriptedActor, SEATS, seated, standing, TIMES, view, walking, J,
  compose, gameplay, stageFrame, STAGE_VERSION,
  type Regions, type BaseGarment, type GarmentKinds, type Dressed, type Part, type Decal, type Print, type Mesh, type Superquadric,
  type Measure, type Skeleton, type Anchor, type Hold, type ItemDef, type HairInput, type HairStyle, type HairFinish, type Piece,
  type Skull, type Tone, type Tie, type Fabric, type Casting, type Cell, type CameraPose, type StageFrame, type StageSprite, type StageOptions, type Backdrop,
} from '../src';
import type { GBuffer, Mesh as KitMesh, Material, V3 } from '../src/kit';

/** Every runtime name src/index.ts exports. A removal or rename is a breaking change (docs/contract.md): it raises
 * STAGE_VERSION and the package version, and is written in the changelog; so it is made on purpose, here too. */
const INDEX_NAMES = ["ACTIONS", "BASE", "DEFAULT_HEAD", "DEFAULT_SLIDERS", "EXPRESSIONS", "FIGURE_KEY", "Figure", "GAITS", "GAMEPLAY", "HAIR_STYLES", "ITEMS", "J", "JOINTS", "POSES", "RAMPS",
  "RAMP_OUTLINE", "SEATS", "SPRITE_PITCH", "SPRITE_STYLE", "STAGE_VERSION", "SWATCHES", "ScriptedActor", "TIE_BIAS", "TIMES", "Troupe", "actionOf", "applyHold", "cellOf", "characterOf", "compose", "densityFor", "envelopeOf", "evaluate", "flatSteps",
  "fromDef", "gameplay", "hero", "itemOf", "lengthOf", "lightFigure", "lightSprite", "lookAt", "member", "project", "registerFabric", "registerFinish", "registerGarment", "registerHairPiece",
  "registerOutfitHooks", "scriptOf", "seated", "stageFrame", "standing", "texelDepths", "view", "viewOf", "walking", "zoomOf"];

/** The public surface (src/index.ts) on its own: the base pair drawn as sheets, lit, and played by an actor, imported
 * from the entry point only, as a fork's code would. */
describe('the public surface', () => {
  const def = BASE[0].def;
  it('the painter\'s toolkit exports exactly these names (a change is a breaking change: docs/contract.md)', async () => {
    expect(Object.keys(await import('../src/kit')).sort()).toEqual(['GROUP', 'J', 'RAMPS', 'RAMP_OUTLINE', 'STYLE', 'TRI', 'VERT', 'apply', 'axisAngle',
      'cleanup', 'cross', 'dot', 'duel', 'fk', 'gbuffer', 'lerp', 'limb', 'noise3', 'normalize', 'oklab', 'placed', 'qmul', 'rasterize', 'resolve', 'smooth', 'sub', 'superquadric', 'weights'].sort());
  });
  it('the public surface exports exactly these names', async () => {
    expect(Object.keys(await import('../src')).sort()).toEqual(INDEX_NAMES);
  });
  it('draws a stage from the entry point only', () => {
    const frame = stageFrame([new ScriptedActor({ who: 'base-m', at: [0, 0] })], 0, gameplay([0, 0.6, 0]), {});
    expect(frame.version).toBe(STAGE_VERSION); expect(compose(frame).some(v => v > 0)).toBe(true);
  });
  it('draws the base pair', () => {
    const cast = member(def, 2), cell = 128 * 192 * 4;
    expect(standing(cast, 1).length).toBe(cell);
    expect(walking(cast)).toHaveLength(cast.gait.walkPoses);
    expect(hero(cast, BASE[0].pose).length).toBe(cell);
  });
  it('lights it', () => {
    const f = new Figure(member(def, 2));
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: Math.PI / 4, moving: false, view: view() });
    const lit = lightFigure(f, { time: TIMES.night, lamps: [{ at: [-1, 1.5, 1], color: '#ffbc4e', steps: 3, radius: 3 }] });
    expect(lit.length).toBe(f.painted.length);
    expect(lit.some((v, i) => v !== f.painted[i])).toBe(true);
  });
  it('plays it as an actor', () => {
    const actor = new ScriptedActor({ who: def, at: [0, 0], actions: [{ t: 0.2, action: 'wave' }] }, { density: 2 });
    expect(actor.draw(0.6, view()).painted.some(v => v > 0)).toBe(true);
  });
  it('reads an action\'s envelope', () => {
    const { def } = actionOf('wave', false, false);
    const env = envelopeOf(def);
    expect(ACTIONS.wave).toBeDefined();
    expect(env.action[1]).toBe(lengthOf(def));
    expect(env.recovery[1]).toBe(lengthOf(def) + def.recovery);
  });
  it('names the types the hook signatures use (tsc guards the imports)', () => {
    const finish: HairFinish = { tones: [0, 1, 2], matte: false };
    const _types: unknown[] = [finish];
    type Named = [Regions, BaseGarment, GarmentKinds, Dressed, Part, Decal, Print, Mesh, Superquadric, Measure, Skeleton, Anchor, Hold,
      ItemDef, HairInput, HairStyle, Piece, Skull, Tone, Tie, Fabric, Casting, Cell, CameraPose, StageFrame, StageSprite, StageOptions, Backdrop, GBuffer, KitMesh, Material, V3];
    const n: Named | undefined = undefined;
    expect([_types.length, n]).toEqual([1, undefined]);
  });
  it('offers a fork its seats, hooks and builders', () => {
    expect(Object.keys(SEATS)).toContain('typing');
    for (const f of [registerGarment, registerOutfitHooks, registerHairPiece, registerFinish, registerFabric, itemOf, applyHold, evaluate, seated]) expect(f).toBeTypeOf('function');
    expect(GAITS[def.gait]).toBeDefined();
    expect(J.hemL).toBeGreaterThan(J.root);
  });
});
