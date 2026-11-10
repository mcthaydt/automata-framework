import { describe, expect, it } from 'vitest';
import { ScriptedActor } from '../../../src';
import { SPRITE_PITCH } from '../../../src';
import { densityFor, gameplay, lookAt, project, zoomOf } from '../../../src/features/stage/pose';
import { compose, stageFrame, texelDepths, type Backdrop, type StageFrame, type StageSprite } from '../../../src/features/stage/stage';
import { coloursOf, md5, ortho } from './fixtures';

/** The stage frame and its CPU reference (src/features/stage/stage.ts). */
const deg = Math.PI / 180;
const actor = (who: string, at: [number, number]) => new ScriptedActor({ who, at });

describe('stageFrame and compose', () => {
  it('a whole zoom is texel-exact at every scale', () => {
    for (const z of [1, 2, 3, 4, 8]) {
      const fr = stageFrame([actor('base-m', [0, 0])], 0, ortho(z, [160 * z, 240 * z]), { density: 'auto' }), s = fr.sprites[0], [w, h] = s.cell.size;   // a frame the whole cell fits in
      expect(s.cell.density).toBe(densityFor(z)); expect(s.scale).toBe(z / densityFor(z));
      expect(Number.isInteger(s.screen[0]) && Number.isInteger(s.screen[1])).toBe(true);
      const out = compose(fr), W = 160 * z;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++)   // every pixel of a texel's block is that texel
        expect(out[((s.screen[1] + y * s.scale) * W + s.screen[0] + x * s.scale) * 4 + k]).toBe(s.cell.rgba[(y * w + x) * 4 + k]);
    }
  });
  it('the nearer actor wins; equal distance falls to cast order', () => {
    const near = actor('base-f', [0, 0.5]), far = actor('base-m', [0, -0.5]);
    const fr = stageFrame([near, far], 0, ortho(1, [64, 96]), { density: 1 });
    expect(fr.sprites.map(s => s.name)).toEqual(['base-m', 'base-f']);
    const tie = stageFrame([actor('base-m', [0, 0]), actor('base-f', [0, 0])], 0, ortho(1, [64, 96]), { density: 1 });
    expect(tie.sprites.map(s => s.name)).toEqual(['base-m', 'base-f']);
    // her, a metre nearer, hides him wherever they overlap (every texel of hers is nearer than his: per-texel depth agrees with the order)
    const out = compose(fr), her = compose(stageFrame([actor('base-f', [0, 0.5])], 0, ortho(1, [64, 96]), { density: 1 }));
    for (let i = 0; i < her.length; i += 4) if (her[i + 3]) for (let k = 0; k < 4; k++) expect(out[i + k]).toBe(her[i + k]);
    // two identical figures at one place tie at every texel: the later of the two is on top
    const twin = stageFrame([actor('base-f', [0, 0]), actor('base-f', [0, 0])], 0, ortho(1, [64, 96]), { density: 1 });
    expect(md5(compose(twin))).toBe(md5(compose(stageFrame([actor('base-f', [0, 0])], 0, ortho(1, [64, 96]), { density: 1 }))));
  });
  it('is deterministic: the same arguments, before and after other frames', () => {
    const cast = () => [actor('base-m', [-0.4, 0]), actor('base-f', [0.4, 0.3])], p = ortho(2, [256, 192]);
    const a = md5(compose(stageFrame(cast(), 1.3, p)));
    const again = cast(); compose(stageFrame(again, 0.2, p)); compose(stageFrame(again, 2.9, gameplay([0, 0.6, 0])));
    expect(md5(compose(stageFrame(again, 1.3, p)))).toBe(a);
  });
  it('the gameplay pose: D2 by default, the renders\' pitch (18°, not the camera\'s 30°), the orbit step\'s direction, true scale with `crisp: false`', () => {
    for (let k = 0; k < 8; k++) {
      const p = gameplay([0, 0.6, 0], k), s = stageFrame([actor('base-m', [0, 0])], 0, p, { crisp: false }).sprites[0];
      expect(s.cell.density).toBe(2); expect(s.cell.pitch).toBeCloseTo(SPRITE_PITCH, 12); expect(s.cell.pitch).toBeCloseTo(18 * deg, 12); expect(s.cell.direction).toBe((8 - k) % 8);
      expect(s.scale).toBeCloseTo(zoomOf(p, [0, 0, 0]) / 2, 12);
      const [ax, ay] = project(p, [0, 0, 0]);                                   // the root lands where the pose projects it
      expect(s.screen[0] + s.scale * s.cell.anchor[0]).toBeCloseTo(ax, 9); expect(s.screen[1] + s.scale * s.cell.anchor[1]).toBeCloseTo(ay, 9);
    }
  });
  it('crisp is the default: no option is `crisp: true`, and `crisp: false` is true scale', () => {
    const p = gameplay([0, 0.6, 0], 1), cast = () => [actor('base-m', [-0.8, 2]), actor('base-f', [0, 0])];
    const none = stageFrame(cast(), 0, p), on = stageFrame(cast(), 0, p, { crisp: true }), off = stageFrame(cast(), 0, p, { crisp: false });
    expect(md5(compose(none))).toBe(md5(compose(on)));
    expect(none.sprites.map(s => s.scale)).toEqual([1, 1]); expect(off.sprites.every(s => s.scale !== 1 && Number.isFinite(s.scale))).toBe(true);
    expect(md5(compose(off))).not.toBe(md5(compose(on)));
  });
  it('crisp: whole pixels per texel, on the pixel grid; one D2 texel a pixel across the gameplay range, two at twice the frame', () => {
    for (const z of [-2, 0, 2]) {                                               // 18.0, 16.3 and 14.6 m along the view (the root is 0.6 m under the look point): zoom 1.50, 1.66, 1.86 per D1 texel
      const s = stageFrame([actor('base-m', [0, z])], 0, gameplay([0, 0.6, 0]), { }).sprites[0], big = stageFrame([actor('base-m', [0, z])], 0, gameplay([0, 0.6, 0], 0, [1280, 960])).sprites[0];
      expect(s.cell.density).toBe(2); expect(s.scale).toBe(1); expect(s.screen.every(Number.isInteger)).toBe(true);
      expect(big.scale).toBe(2); expect(big.screen.every(Number.isInteger)).toBe(true);
    }
  });
  it('a density: 1 option paints D1, and the crisp scale follows (two pixels a D1 texel at the gameplay camera)', () => {
    const s = stageFrame([actor('base-m', [0, 0])], 0, gameplay([0, 0.6, 0]), { density: 1 }).sprites[0];
    expect(s.cell.density).toBe(1); expect(s.scale).toBe(2);
  });
  it('paints at the renders\' pitch whatever the camera tilts, and a host can set it', () => {
    for (const p of [gameplay([0, 0.6, 0]), ortho(2, [128, 192]), lookAt([0, 12, 14], [0, 0.6, 0], { f: 1000 }, [640, 480])]) {
      expect(stageFrame([actor('base-m', [0, 0])], 0, p).sprites[0].cell.pitch).toBeCloseTo(SPRITE_PITCH, 12);
    }
    expect(stageFrame([actor('base-m', [0, 0])], 0, gameplay([0, 0.6, 0]), { pitch: 30 * deg }).sprites[0].cell.pitch).toBeCloseTo(30 * deg, 12);
  });
  it('true scale adds no colour', () => {
    const fr = stageFrame([actor('base-m', [0, 0])], 0, gameplay([0, 0.6, 0]), { crisp: false }), held = coloursOf(fr.sprites[0].cell.rgba);
    for (const c of coloursOf(compose(fr))) expect(held.has(c)).toBe(true);
  });
  // Review Focus 1, 2, 3, 5
  it('leaves out an actor behind the camera', () => {
    expect(stageFrame([actor('base-m', [0, 40])], 0, gameplay([0, 0.6, 0])).sprites).toEqual([]);
  });
  it('clips a sprite at the frame\'s edge and off it', () => {
    const p = ortho(1, [40, 40]);
    expect(compose(stageFrame([actor('base-m', [0, 0])], 0, p, { density: 1 })).length).toBe(40 * 40 * 4);
    expect(compose(stageFrame([actor('base-m', [30, 0])], 0, p, { density: 1 })).every(v => v === 0)).toBe(true);
    // a sprite hanging off the left edge writes nothing onto the right edge of the row above
    const out = compose(stageFrame([actor('base-m', [-0.5, 0])], 0, p, { density: 1 })), ref = compose(stageFrame([actor('base-m', [-0.5, 0])], 0, ortho(1, [140, 40], [0, 1, 0]), { density: 1 }));
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) for (let k = 0; k < 4; k++) expect(out[(y * 40 + x) * 4 + k]).toBe(ref[(y * 140 + x + 50) * 4 + k]);
  });
  it('a far figure: shrunk at true scale; crisp (the default) never under a pixel a texel', () => {
    const far = lookAt([0, 30, 52], [0, 0.6, 0], { f: 1000 }, [640, 480]);
    const s = stageFrame([actor('base-m', [0, 0])], 0, far, { crisp: false }).sprites[0];
    expect(s.cell.density).toBe(2); expect(s.scale).toBeLessThan(1); expect(s.scale).toBeGreaterThan(0);
    expect(stageFrame([actor('base-m', [0, 0])], 0, far, { density: 'auto', crisp: false }).sprites[0].cell.density).toBe(1);
    expect(stageFrame([actor('base-m', [0, 0])], 0, far).sprites[0].scale).toBe(1);   // crisp by default
  });
  it('an empty cast composes to a transparent frame', () => {
    const out = compose(stageFrame([], 0, gameplay([0, 0.6, 0])));
    expect(out.length).toBe(640 * 480 * 4); expect(out.every(v => v === 0)).toBe(true);
  });
  it('refuses a malformed pose', () => { expect(() => stageFrame([], 0, { ...gameplay([0, 0, 0]), pixelsPerMetre: 4 })).toThrow(/pixelsPerMetre/); });
});

/** The scene's depth test, per texel (stage.ts `texelDepths`, `compose`): the CPU rule the GPU is checked against. */
describe('per-texel depth', () => {
  /** A hand-made cell of `texels` opaque RGBA pixels in a row, depths in metres toward the camera, the root at its top-left. */
  const tiny = (rgb: number[][], depth: number[]): StageSprite['cell'] => {
    const rgba = new Uint8ClampedArray(rgb.length * 4);
    rgb.forEach((c, i) => rgba.set([...c, 255], i * 4));
    return { key: String(rgb), size: [rgb.length, 1], rgba, painted: rgba, normals: new Uint8ClampedArray(rgba.length), depth: Float32Array.from(depth), weave: null,
      anchor: [0, 0], metresPerTexel: 1 / 36.923076923076927, density: 1, direction: 0, pitch: 18 * deg };
  };
  const cam = ortho(1, [4, 1], [0, 0, 0]);
  const sprite = (cell: StageSprite['cell'], depth: number, at: [number, number, number] = [0, 0, 0]): StageSprite => ({ name: 'x', cell, at, screen: [0, 0], scale: 1, depth });
  const frame = (...sprites: StageSprite[]): StageFrame => ({ version: 1, camera: cam, sprites });
  const px = (out: Uint8ClampedArray, x: number) => Array.from(out.slice(x * 4, x * 4 + 4));

  it('under a camera at the renders\' pitch a texel\'s depth along the view is the root\'s less the cell\'s', () => {
    const cam = ortho(2, [256, 192]), s = stageFrame([actor('base-m', [0.3, -0.2])], 0, cam).sprites[0], d = texelDepths(cam, s);
    let n = 0;
    for (let i = 0; i < d.length; i++) if (s.cell.rgba[i * 4 + 3]) { expect(d[i]).toBeCloseTo(s.depth - s.cell.depth[i], 4); n++; } else expect(d[i]).toBe(Infinity);
    expect(n).toBeGreaterThan(1000);
  });
  it('the nearer texel wins whichever sprite it belongs to: a nearer root does not beat a nearer arm', () => {
    const front = sprite(tiny([[255, 0, 0], [255, 0, 0]], [0, 0]), 10), back = sprite(tiny([[0, 0, 255], [0, 0, 255]], [0, 0.5]), 10.2);
    // `back` is the farther figure (root 10.2), drawn first; its second texel reaches 0.5 m toward the camera: 9.7 m, nearer than front's 10.
    const out = compose(frame(back, front));
    expect(px(out, 0)).toEqual([255, 0, 0, 255]);   // front's texel is nearer than back's (10 against 10.2)
    expect(px(out, 1)).toEqual([0, 0, 255, 255]);   // back's arm (9.7) is in front of front's body (10)
  });
  it('equal depths fall to the later sprite, as the cast order has it', () => {
    const a = sprite(tiny([[255, 0, 0]], [0]), 10), b = sprite(tiny([[0, 255, 0]], [0]), 10);
    expect(px(compose(frame(a, b)), 0)).toEqual([0, 255, 0, 255]);
    expect(px(compose(frame(b, a)), 0)).toEqual([255, 0, 0, 255]);
  });
  it('a backdrop surface hides the texels behind it and shows through to the ones in front', () => {
    const s = sprite(tiny([[255, 0, 0], [255, 0, 0], [255, 0, 0]], [0, 0.4, -0.4]), 10);   // depths 10, 9.6, 10.4
    const wall: Backdrop = () => ({ depth: 10.2, rgba: [0, 200, 0, 255] });
    const out = compose(frame(s), wall);
    expect(px(out, 0)).toEqual([255, 0, 0, 255]); expect(px(out, 1)).toEqual([255, 0, 0, 255]); expect(px(out, 2)).toEqual([0, 200, 0, 255]);
    expect(px(out, 3)).toEqual([0, 200, 0, 255]);   // where no sprite is, the backdrop alone
  });
  it('is the same with the cached or fresh figure\'s depth', () => {
    const cached = stageFrame([actor('base-m', [0, 0])], 0, ortho(2, [256, 192])).sprites[0], fresh = new ScriptedActor({ who: 'base-m', at: [0, 0] }, { cache: false });
    const f = stageFrame([fresh], 0, ortho(2, [256, 192])).sprites[0];
    expect(md5(new Uint8ClampedArray(texelDepths(ortho(2, [256, 192]), cached).buffer))).toBe(md5(new Uint8ClampedArray(texelDepths(ortho(2, [256, 192]), f).buffer)));
  });
});
