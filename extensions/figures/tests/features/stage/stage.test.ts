import { describe, expect, it } from 'vitest';
import { ScriptedActor } from '../../../src';
import { densityFor, gameplay, lookAt, project, zoomOf } from '../../../src/features/stage/pose';
import { compose, stageFrame } from '../../../src/features/stage/stage';
import { coloursOf, md5, ortho } from './fixtures';

/** The stage frame and its CPU reference (src/features/stage/stage.ts). */
const deg = Math.PI / 180;
const actor = (who: string, at: [number, number]) => new ScriptedActor({ who, at });

describe('stageFrame and compose', () => {
  it('a whole zoom is texel-exact at every scale', () => {
    for (const z of [1, 2, 3, 4, 8]) {
      const fr = stageFrame([actor('base-m', [0, 0])], 0, ortho(z, [160 * z, 240 * z])), s = fr.sprites[0], [w, h] = s.cell.size;   // a frame the whole cell fits in
      expect(s.cell.density).toBe(densityFor(z)); expect(s.scale).toBe(z / densityFor(z));
      expect(Number.isInteger(s.screen[0]) && Number.isInteger(s.screen[1])).toBe(true);
      const out = compose(fr), W = 160 * z;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++)   // every pixel of a texel's block is that texel
        expect(out[((s.screen[1] + y * s.scale) * W + s.screen[0] + x * s.scale) * 4 + k]).toBe(s.cell.rgba[(y * w + x) * 4 + k]);
    }
  });
  it('the nearer actor wins; equal distance falls to cast order', () => {
    const near = actor('base-f', [0, 0.5]), far = actor('base-m', [0, -0.5]);
    const fr = stageFrame([near, far], 0, ortho(1, [64, 96]));
    expect(fr.sprites.map(s => s.name)).toEqual(['base-m', 'base-f']);
    const tie = stageFrame([actor('base-m', [0, 0]), actor('base-f', [0, 0])], 0, ortho(1, [64, 96]));
    expect(tie.sprites.map(s => s.name)).toEqual(['base-m', 'base-f']);
    const both = compose(tie), her = compose(stageFrame([actor('base-f', [0, 0])], 0, ortho(1, [64, 96])));
    for (let i = 0; i < her.length; i += 4) if (her[i + 3]) for (let k = 0; k < 4; k++) expect(both[i + k]).toBe(her[i + k]);   // the later of a tie is on top
  });
  it('is deterministic: the same arguments, before and after other frames', () => {
    const cast = () => [actor('base-m', [-0.4, 0]), actor('base-f', [0.4, 0.3])], p = ortho(2, [256, 192]);
    const a = md5(compose(stageFrame(cast(), 1.3, p)));
    const again = cast(); compose(stageFrame(again, 0.2, p)); compose(stageFrame(again, 2.9, gameplay([0, 0.6, 0])));
    expect(md5(compose(stageFrame(again, 1.3, p)))).toBe(a);
  });
  it('the gameplay pose: density 1, pitch 30°, the orbit step\'s direction, true scale by default', () => {
    for (let k = 0; k < 8; k++) {
      const p = gameplay([0, 0.6, 0], k), s = stageFrame([actor('base-m', [0, 0])], 0, p, { maxDensity: 1 }).sprites[0];
      expect(s.cell.density).toBe(1); expect(s.cell.pitch).toBeCloseTo(30 * deg, 12); expect(s.cell.direction).toBe((8 - k) % 8);
      expect(s.scale).toBeCloseTo(zoomOf(p, [0, 0, 0]), 12);
      const [ax, ay] = project(p, [0, 0, 0]);                                   // the root lands where the pose projects it
      expect(s.screen[0] + s.scale * s.cell.anchor[0]).toBeCloseTo(ax, 9); expect(s.screen[1] + s.scale * s.cell.anchor[1]).toBeCloseTo(ay, 9);
    }
  });
  it('crisp: whole pixels per texel, on the pixel grid; 2 across the gameplay range', () => {
    for (const z of [-2, 0, 2]) {                                               // 18.0, 16.3 and 14.6 m along the view (the root is 0.6 m under the look point): zoom 1.50, 1.66, 1.86
      const s = stageFrame([actor('base-m', [0, z])], 0, gameplay([0, 0.6, 0]), { crisp: true, maxDensity: 1 }).sprites[0];
      expect(s.scale).toBe(2); expect(s.screen.every(Number.isInteger)).toBe(true);
    }
  });
  it('true scale adds no colour', () => {
    const fr = stageFrame([actor('base-m', [0, 0])], 0, gameplay([0, 0.6, 0]), { maxDensity: 1 }), held = coloursOf(fr.sprites[0].cell.rgba);
    for (const c of coloursOf(compose(fr))) expect(held.has(c)).toBe(true);
  });
  // Review Focus 1, 2, 3, 5
  it('leaves out an actor behind the camera', () => {
    expect(stageFrame([actor('base-m', [0, 40])], 0, gameplay([0, 0.6, 0])).sprites).toEqual([]);
  });
  it('clips a sprite at the frame\'s edge and off it', () => {
    const p = ortho(1, [40, 40]);
    expect(compose(stageFrame([actor('base-m', [0, 0])], 0, p)).length).toBe(40 * 40 * 4);
    expect(compose(stageFrame([actor('base-m', [30, 0])], 0, p)).every(v => v === 0)).toBe(true);
    // a sprite hanging off the left edge writes nothing onto the right edge of the row above
    const out = compose(stageFrame([actor('base-m', [-0.5, 0])], 0, p)), ref = compose(stageFrame([actor('base-m', [-0.5, 0])], 0, ortho(1, [140, 40], [0, 1, 0])));
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) for (let k = 0; k < 4; k++) expect(out[(y * 40 + x) * 4 + k]).toBe(ref[(y * 140 + x + 50) * 4 + k]);
  });
  it('a far figure: density 1, shrunk; crisp never under a pixel a texel', () => {
    const far = lookAt([0, 30, 52], [0, 0.6, 0], { f: 1000 }, [640, 480]);
    const s = stageFrame([actor('base-m', [0, 0])], 0, far).sprites[0];
    expect(s.cell.density).toBe(1); expect(s.scale).toBeLessThan(1); expect(s.scale).toBeGreaterThan(0);
    expect(stageFrame([actor('base-m', [0, 0])], 0, far, { crisp: true }).sprites[0].scale).toBe(1);
  });
  it('an empty cast composes to a transparent frame', () => {
    const out = compose(stageFrame([], 0, gameplay([0, 0.6, 0])));
    expect(out.length).toBe(640 * 480 * 4); expect(out.every(v => v === 0)).toBe(true);
  });
  it('refuses a malformed pose', () => { expect(() => stageFrame([], 0, { ...gameplay([0, 0, 0]), pixelsPerMetre: 4 })).toThrow(/pixelsPerMetre/); });
});
