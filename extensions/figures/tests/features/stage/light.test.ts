import { describe, expect, it } from 'vitest';
import { lightFigure, ScriptedActor, SPRITE_PITCH, TIMES, type FigureLight, type V3 } from '../../../src';
import { lookAt, viewOf } from '../../../src/features/stage/pose';
import { stageFrame } from '../../../src/features/stage/stage';
import { registerFixtures } from '../paint/fabric-fixtures';
import { DENIM_DEF, md5, ortho } from './fixtures';

/** Light through the stage: world lamps, the light hook and a fabric (src/features/stage/stage.ts). */
const deg = Math.PI / 180;
const actor = (who: string, at: [number, number]) => new ScriptedActor({ who, at });
const NIGHT = { time: TIMES.night, lamps: [{ at: [-1.2, 1.5, 0.8] as V3, color: '#ffbc4e', steps: 3, radius: 3.2 }] };

describe('stageFrame lights', () => {
  it('a world lamp lights an actor where it stands, as lightFigure does with `at` there', () => {
    const a = actor('base-m', [1.5, -2]), s = stageFrame([a], 0, ortho(2, [512, 384]), { lighting: NIGHT }).sprites[0];
    const f = actor('base-m', [1.5, -2]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2);
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { ...NIGHT, at: [1.5, 0, -2] })));
    expect(md5(s.cell.painted)).toBe(md5(f.painted));
  });
  it('moving the eye a quarter turn round the figure turns the lamp with the world', () => {
    // a lamp on world +x; seen from +x (azimuth 90°) it stands toward the camera: the figure's lighting frame +z
    const lamp = { ...NIGHT.lamps[0], at: [2, 1.5, 0] as V3 }, side = lookAt([20, 6, 0], [0, 1, 0], { pixelsPerMetre: 2 * 96 / 2.6 }, [512, 384]);
    const s = stageFrame([actor('base-m', [0, 0])], 0, side, { lighting: { time: TIMES.night, lamps: [lamp] } }).sprites[0];
    const f = actor('base-m', [0, 0]).draw(0, { ...viewOf(side, [0, 0, 0]), pitch: SPRITE_PITCH }, 2);   // the renders' pitch, not the camera's
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { time: TIMES.night, lamps: [{ ...lamp, at: [0, 1.5, 2] }], at: [0, 0, 0] })));
  });
  it('a spot\'s aim turns with the world too', () => {
    const lamp = { ...NIGHT.lamps[0], at: [2, 1.5, 0] as V3, aim: [-1, -0.2, 0] as V3, cone: 40 }, side = lookAt([20, 6, 0], [0, 1, 0], { pixelsPerMetre: 2 * 96 / 2.6 }, [512, 384]);
    const s = stageFrame([actor('base-m', [0, 0])], 0, side, { lighting: { time: TIMES.night, lamps: [lamp] } }).sprites[0];
    const f = actor('base-m', [0, 0]).draw(0, { ...viewOf(side, [0, 0, 0]), pitch: SPRITE_PITCH }, 2);
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { time: TIMES.night, lamps: [{ ...lamp, at: [0, 1.5, 2], aim: [0, -0.2, -1] }], at: [0, 0, 0] })));
  });
  it('the light hook reaches the painter and no lightFigure runs', () => {
    const hook: FigureLight = () => [1.4, 0.6, 0.6];
    const s = stageFrame([actor('base-m', [0, 0])], 0, ortho(2, [128, 192]), { lights: () => hook }).sprites[0];
    const f = actor('base-m', [0, 0]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2, hook);
    expect(md5(s.cell.rgba)).toBe(md5(f.painted)); expect(s.cell.rgba).toBe(s.cell.painted);
    expect(md5(s.cell.rgba)).not.toBe(md5(actor('base-m', [0, 0]).draw(0, { azimuth: 0, pitch: 18 * deg }, 2).painted));
  });
  it('a tiled cloth is lit through its weave', () => {
    registerFixtures();
    const s = stageFrame([new ScriptedActor({ who: DENIM_DEF, at: [0.5, -1] })], 0, ortho(2, [512, 384]), { lighting: NIGHT }).sprites[0];
    const f = new ScriptedActor({ who: DENIM_DEF, at: [0.5, -1] }).draw(0, { azimuth: 0, pitch: 18 * deg }, 2);
    expect(s.cell.weave).not.toBeNull();
    expect(md5(s.cell.rgba)).toBe(md5(lightFigure(f, { ...NIGHT, at: [0.5, 0, -1] })));
  });
  it('refuses both light paths at once', () => {
    expect(() => stageFrame([], 0, ortho(1, [64, 96]), { lighting: NIGHT, lights: () => null })).toThrow(/two light paths/);
  });
});
