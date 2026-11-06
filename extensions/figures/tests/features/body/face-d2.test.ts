import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import type { HeadShape } from '../../../src/features/body/genes';
import type { CharacterDef } from '../../../src/features/figure/cast';
import { measure } from '../../../src/features/body/genes';
import { skeleton } from '../../../src/features/body/rig';
import { headForm } from '../../../src/features/body/head';
import { member, standing } from '../../../src/features/figure/frames';

/**
 * The face's sliders at the sprite's size (c4 stage 1): moving any one from 0 to 1 on either base figure changes the head
 * at density 2, in the front or the three-quarter view. A slider shows by one way only (spec decision 5): the outline
 * (width, jaw, chin) or a drawn mark (the rest), never both.
 */
/** How many texels change when `key` goes from 0 to 1 on `def`, density 2: any RGBA difference, or with `outline` only
 * those whose alpha differs (the silhouette); the larger of the front (view 0) and the three-quarter (view 1). */
export function faceReads(def: CharacterDef, key: keyof HeadShape, outline = false): number {
  const draw = (v: number, d: number) => standing(member({ ...def, sliders: { ...def.sliders, face: { ...def.sliders.face, [key]: v } } }, 2), d);
  let best = 0;
  for (const d of [0, 1]) {
    const a = draw(0, d), b = draw(1, d);
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (outline ? a[i + 3] !== b[i + 3] : (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3])) n++;
    }
    best = Math.max(best, n);
  }
  return best;
}
/** The silhouette texels each outline slider moved on the tree before stage 1's outline change (after the fat commit):
 * recorded with faceReads(def, key, true). The new range must beat them. */
const BEFORE: Record<string, Record<string, number>> = { 'base-m': { width: 2, jaw: 14, chin: 4 }, 'base-f': { width: 1, jaw: 9, chin: 2 } };

describe('the outline sliders read at density 2', () => {
  for (const c of BASE) for (const key of ['width', 'jaw', 'chin'] as const) {
    it(`${c.def.id} ${key}: at least a texel more silhouette than before, and two at the least`, () => {
      expect(faceReads(c.def, key, true)).toBeGreaterThanOrEqual(Math.max(2, BEFORE[c.def.id][key] + 1));
    });
  }
});

/** headForm at the default sliders (every face key 0.5), as the tree drew it before the widening: a slider at 0.5 draws
 * today's face. */
const SNAP = {"ts": [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1], "width": [0, 0.027599374113647625, 0.03913388573254893, 0.061610697028307564, 0.06917108998522993, 0.07993312838622721, 0.088674708128832, 0.091526354099712, 0.09275330742875199, 0.09322521109512222, 0.09349274793600001, 0.0944515260104348, 0.0953508756918261, 0.09534587261351041, 0.0943272937281024, 0.09192994284418562, 0.0880305844916736, 0.08084966241712502, 0.068889393216, 0.04956144034800001, 0], "front": [0.10810673999999999, 0.13988652299999998, 0.135490118203125, 0.14169330000000002, 0.14210818013538462, 0.13851112986778846, 0.1402551735576923, 0.1404795919275, 0.13935063743999998, 0.13551998906249998, 0.13432562325000003, 0.13925138653125002, 0.13939199866666668, 0.13743922106250003, 0.13373089280303033, 0.1284379902935606, 0.1207017, 0.10973232613636366, 0.09446220000000001, 0.07329037500000003, 0.015481304999999997], "back": [0.10810673999999999, 0.08289217708333335, 0.0472311, 0.007716272607421873, -0.023748114140625012, -0.04340524651367187, -0.058763885040000005, -0.07020955494000002, -0.07701302076923078, -0.08112504288461539, -0.08449119000000001, -0.08788372934294872, -0.09028107397435897, -0.09113157255681818, -0.09057663363636363, -0.08797426893818182, -0.08274163555636363, -0.07400835556490387, -0.06022806259615387, -0.03962394600230773, 0.015481304999999997]};
describe('a face at 0.5 is today\'s face', () => {
  it('headForm at the default sliders keeps its width, front and back at t = 0, 0.05 … 1', () => {
    const m = measure({}), f = headForm(m, skeleton(m.genes));
    SNAP.ts.forEach((t, i) => {
      expect(f.width(t), `width ${t}`).toBe(SNAP.width[i]);
      expect(f.front(t), `front ${t}`).toBe(SNAP.front[i]);
      expect(f.back(t), `back ${t}`).toBe(SNAP.back[i]);
    });
  });
});

/** The texels each mark slider moved (any texel), on the tree after the outline change and before the marks, recorded
 * with faceReads(def, key). The marks must beat them by two. cheekHeight's is recorded with its outline held and no stroke
 * yet (head.ts holds the cheekbone's height): what main moved by the outline (17 / 5 texels) is the drawing the stroke
 * replaces, so it is no bar for it. cheekWidth is not here: it shows by the outline (below). */
const BEFORE_MARKS: Record<string, Record<string, number>> = {
  'base-m': { cheekHeight: 2, bridge: 2, nose: 6, crease: 6, hood: 6, lips: 2 },
  'base-f': { cheekHeight: 0, bridge: 0, nose: 4, crease: 6, hood: 6, lips: 0 },
};
const MARKS = ['cheekHeight', 'bridge', 'nose', 'crease', 'hood', 'lips'] as const;
describe('the mark sliders read at density 2, by the mark alone', () => {
  for (const c of BASE) {
    for (const key of MARKS) {
      // The hood's line, and the crease's where the hood's is the longer, are a step lighter on the skin's ramp (the owner, gate B:
      // at the crease's strength it read as a second brow), so a texel of them is often the skin's own colour: their bar is
      // the recorded count less two, not more.
      const soft = key === 'hood' || key === 'crease';
      it(`${c.def.id} ${key}: ${soft ? 'still reads (a lighter line)' : 'at least two texels more than before'}`, () => {
        expect(faceReads(c.def, key)).toBeGreaterThanOrEqual(Math.max(2, BEFORE_MARKS[c.def.id][key] + (soft ? -2 : 2)));
      });
      it(`${c.def.id} ${key}: moves no silhouette texel (one way to show, spec decision 5)`, () => {
        expect(faceReads(c.def, key, true)).toBe(0);
      });
    }
    // cheekWidth shows by the outline (head.ts), as main already does: a texel more of silhouette than nothing, about as many as main moved (11 and 12 on main; the cheekbone's height is held now).
    it(`${c.def.id} cheekWidth: reads by the outline`, () => { expect(faceReads(c.def, 'cheekWidth', true)).toBeGreaterThanOrEqual(8); });
    for (const key of ['browArch', 'browWeight', 'browHeight'] as const) {
      it(`${c.def.id} ${key} still reads`, () => { expect(faceReads(c.def, key)).toBeGreaterThanOrEqual(2); });
    }
  }
});
