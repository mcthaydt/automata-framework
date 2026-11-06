import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { eyeWidth, Figure } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import type { CharacterDef } from '../../../src/features/figure/cast';

/**
 * The eye's size (figure.ts eyeWidth): the density sizes it (four texels at density 2), capped at a little over half the
 * head's half-width so that a small head does not carry an eye that covers a third of its face. The base pair never reach
 * the cap, which is why no golden moves.
 */
/** The eye width (texels) the painter was handed for a character at density 2, standing and facing the camera. */
function eyeOf(def: CharacterDef): number {
  const f = new Figure(member(def, 2));
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: 0, moving: false, view: view() });
  return (f as unknown as { faceStamp: { eye: number; size: number } }).faceStamp.eye;
}

describe('the eye\'s size', () => {
  for (const c of BASE) it(`${c.def.id} keeps its four-texel eye at density 2`, () => {
    expect(eyeOf(c.def)).toBe(4);
  });
  it('a small head (head 0.62 on the base woman, whose half-width is then 6.7 texels) gets a three-texel eye at density 2', () => {
    const def = BASE[1].def;
    expect(eyeOf({ ...def, sliders: { ...def.sliders, head: 0.62 } })).toBe(3);
  });
  it('the cap is the only thing that narrows it: without it the same head would draw four', () => {
    expect(eyeWidth(6.66, 73.8)).toBe(3);
    expect(eyeWidth(7.9, 73.8)).toBe(4);
    expect(eyeWidth(2, 73.8)).toBe(1);   // never under one texel
  });
});

/**
 * The eye sliders (c4 stage 2): eyeSize, eyeSpacing and eyeTilt, 0–1, 0.5 the eye drawn before. The face's detail level
 * stays on the eye's width before eyeSize (FaceStamp.detail), so a small head at eyeSize 0 keeps its whole face.
 */
type Stamp = { eye: number; detail: number; eyes: [[number, number], [number, number]]; centre: [number, number] };
function drawn(def: CharacterDef, face: Partial<CharacterDef['sliders']['face']>, density: number, d = 0) {
  const f = new Figure(member({ ...def, sliders: { ...def.sliders, face: { ...def.sliders.face, ...face } } }, density));
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
  return { px: f.painted.slice(), stamp: (f as unknown as { faceStamp: Stamp }).faceStamp };
}
const diffs = (a: Uint8ClampedArray, b: Uint8ClampedArray, w: number) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) out.push(Math.floor(i / 4 / w));
  return out;
};
describe('eyeSize', () => {
  const f = BASE[1].def;
  it('a texel narrower at 0 and wider at 1 at density 2, two at density 4, none at density 1', () => {
    for (const [D, step] of [[2, 1], [4, 2], [1, 0]] as const) {
      const w = drawn(f, {}, D).stamp.eye;
      expect(drawn(f, { eyeSize: 0 }, D).stamp.eye, `D${D} 0`).toBe(w - step);
      expect(drawn(f, { eyeSize: 0.5 }, D).stamp.eye, `D${D} 0.5`).toBe(w);
      expect(drawn(f, { eyeSize: 1 }, D).stamp.eye, `D${D} 1`).toBe(w + step);
    }
  });
  it('a small head at eyeSize 0 keeps its whole face: eye 2, detail 3, and only the eye\'s and brows\' rows differ from eyeSize 0.5 (nose, mouth and the rest keep the whole drawing)', () => {
    const small = { ...f, sliders: { ...f.sliders, head: 0.62 } } as CharacterDef;
    const a = drawn(small, { eyeSize: 0 }, 2), b = drawn(small, { eyeSize: 0.5 }, 2), I = Math.floor(b.stamp.centre[1]);
    expect(a.stamp.eye).toBe(2); expect(a.stamp.detail).toBe(3);
    const rows = diffs(a.px, b.px, member(small, 2).cell[0]);
    expect(rows.length).toBeGreaterThan(0);
    // The brows follow the eye's ends, so they move with it (rows I-5 … I-3); the nose, the mouth and the cheeks do not.
    for (const r of rows) expect(r >= I - 5 && r <= I + 1, `row ${r} (eye row ${I})`).toBe(true);
  });
});
describe('eyeSpacing', () => {
  it('moves the eyes\' centres apart by at least two texels in all, 0 against 1, at density 2', () => {
    for (const c of BASE) {
      const gap = (v: number) => { const e = drawn(c.def, { eyeSpacing: v }, 2).stamp.eyes; return e[1][0] - e[0][0]; };
      expect(gap(1) - gap(0), c.def.id).toBeGreaterThanOrEqual(2);
    }
  });
});
describe('eyeTilt', () => {
  it('differs 0 against 1 at density 2, front and three-quarter, and is the same at density 1', () => {
    const f = BASE[1].def;
    for (const d of [0, 1]) expect(diffs(drawn(f, { eyeTilt: 0 }, 2, d).px, drawn(f, { eyeTilt: 1 }, 2, d).px, 128).length, `D2 view ${d}`).toBeGreaterThan(0);
    for (const d of [0, 1]) expect(diffs(drawn(f, { eyeTilt: 0 }, 1, d).px, drawn(f, { eyeTilt: 1 }, 1, d).px, 64).length, `D1 view ${d}`).toBe(0);
  });
});
