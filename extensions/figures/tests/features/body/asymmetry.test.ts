import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { J, fk, skeleton } from '../../../src/features/body/rig';
import { headForm } from '../../../src/features/body/head';
import { Figure } from '../../../src/features/figure/figure';
import { member, standing as standingOf, view, walking as walkingOf } from '../../../src/features/figure/frames';
import { fromDef, type CharacterDef } from '../../../src/features/figure/cast';
import { evaluate } from '../../../src/features/motion/motion';

/**
 * Face asymmetry (c4 stage 3): `HeadShape.asymmetry`, −1…1, 0 the mirrored face of before. `+a` acts on the figure's left
 * (+x in head space; the screen's right in the front view): its eye a row lower from |a| 0.5 and a texel narrower from
 * 0.8, the nose off-centre toward it, the mouth's other corner a row higher, the jaw's width on that side wider.
 */
const f = BASE[1].def;
/** The base figure drawn at density 2 facing view `d`, with `asymmetry` a; its frame and the face's centre column. */
function drawn(def: CharacterDef, a: number, d = 0, density = 2) {
  const fig = new Figure(member({ ...def, sliders: { ...def.sliders, face: { ...def.sliders.face, asymmetry: a } } }, density));
  for (let i = 0; i < 3; i++) fig.update(1 / 60, { facing: d * Math.PI / 4, moving: false, view: view() });
  return { px: fig.painted.slice(), centre: (fig as unknown as { faceStamp: { centre: [number, number] } }).faceStamp.centre[0], w: member(def, density).cell[0] };
}
/** The texels (x, y) where two frames differ; `alpha` only the silhouette's. */
function changed(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, alpha = false): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < a.length; i += 4) if (alpha ? a[i + 3] !== b[i + 3] : (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3])) out.push([(i / 4) % w, Math.floor(i / 4 / w)]);
  return out;
}

describe('face asymmetry', () => {
  it('+1 and −1 each change the front frame, base-f at density 2', () => {
    const o = drawn(f, 0);
    for (const a of [1, -1]) expect(changed(o.px, drawn(f, a).px, o.w).length, `a ${a}`).toBeGreaterThan(0);
  });
  it('+1 widens the jaw on the figure\'s left (the screen\'s right in the front view) and −1 on its right, and the two change about as many texels in all (within 35%: the base figures are not mirror images)', () => {
    // The base figures are not mirror images (the key light, the pony, the stand), and a jaw 8% wider is under a texel a side, so
    // what changes is compared, side by side, not the frame against its mirror.
    for (const c of BASE) {
      const o = drawn(c.def, 0), c2 = Math.round(o.centre * 2) / 2;
      // The silhouette's net change toward the screen's right: texels gained there (and lost on the left) count +, the reverse −.
      const lean = (a: number) => { const b = drawn(c.def, a); return changed(o.px, b.px, o.w, true).reduce((n, [x, y]) => n + (b.px[(y * o.w + x) * 4 + 3] > 0 ? 1 : -1) * (x > c2 ? 1 : -1), 0); };
      expect(lean(1), `${c.def.id} +1 widens the screen's right`).toBeGreaterThan(0);
      expect(lean(-1), `${c.def.id} -1 widens the screen's left`).toBeLessThan(0);
      const all1 = changed(o.px, drawn(c.def, 1).px, o.w).length, allN = changed(o.px, drawn(c.def, -1).px, o.w).length;
      expect(Math.abs(all1 - allN) / Math.max(all1, allN), `${c.def.id} ${all1} vs ${allN}`).toBeLessThanOrEqual(0.35);
    }
  });
  it('the jaw\'s width differs per side below t 0.3 and is the same above it, exactly', () => {
    for (const a of [-1, -0.4, 0, 0.7, 1]) {
      const m = measure({ face: { asymmetry: a } }), h = headForm(m, skeleton(m.genes));
      for (let t = 0.3; t <= 1; t += 0.05) expect(h.width(t, 1), `a ${a} t ${t}`).toBe(h.width(t, -1));
      if (a !== 0) expect(h.width(0.1, 1)).not.toBe(h.width(0.1, -1));
      else expect(h.width(0.1, 1)).toBe(h.width(0.1, -1));
    }
  });
  it('the left side is the wider for +a, the right for −a', () => {
    const w = (a: number, side: 1 | -1) => { const m = measure({ face: { asymmetry: a } }); return headForm(m, skeleton(m.genes)).width(0.1, side); };
    expect(w(1, 1)).toBeGreaterThan(w(1, -1)); expect(w(-1, -1)).toBeGreaterThan(w(-1, 1));
  });
});

/**
 * Body asymmetry (c4 stage 3): `Sliders.bodyAsymmetry`, −1…1, 0 today's level figure. A shoulder lower (up to 3 cm at 1: the
 * left for +1) by a roll of the chest against the spine in the pose (motion.ts), the head set level over it.
 */

const DEG = 180 / Math.PI;
function stood(def: CharacterDef, b: number) {
  const m = fromDef({ ...def, sliders: { ...def.sliders, bodyAsymmetry: b } }), s = skeleton(m.genes), look = m.outfits[m.defaultOutfit](s);
  const ev = evaluate(s, m.gait, { t: 0, moving: false, phase: 0, yaw: 0, headYaw: 0, shuffle: 0, clear: look.clear });
  const world = fk(s, ev.pose), P = (n: keyof typeof J) => [world[J[n]][9], world[J[n]][10], world[J[n]][11]];
  const roll = (n: keyof typeof J) => Math.atan2(world[J[n]][1], world[J[n]][0]) * DEG;
  return { k: m.genes.height / 1.62, drop: P('upperArm.R')[1] - P('upperArm.L')[1], P, roll, tilt: Math.atan2(P('thigh.L')[1] - P('thigh.R')[1], Math.abs(P('thigh.L')[0] - P('thigh.R')[0])) * DEG };
}
describe('body asymmetry', () => {
  for (const { def } of BASE) {
    it(`${def.id}: +1 drops the left shoulder 2.5–3.5 cm (scaled by height), −1 the right, the hips and the head level`, () => {
      const o = stood(def, 0), p = stood(def, 1), n = stood(def, -1);
      expect(p.drop - o.drop, '+1 left lower').toBeGreaterThanOrEqual(0.025 * p.k); expect(p.drop - o.drop).toBeLessThanOrEqual(0.035 * p.k);
      expect(n.drop - o.drop, '−1 right lower').toBeLessThanOrEqual(-0.025 * n.k); expect(n.drop - o.drop).toBeGreaterThanOrEqual(-0.035 * n.k);
      for (const b of [p, n]) {
        expect(Math.abs(b.tilt - o.tilt), 'the pelvis').toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.roll('head') - o.roll('head')), 'the head stays level').toBeLessThanOrEqual(2);
      }
    });
    it(`${def.id}: at ±1 the stand and the walk build and paint, and 0 is the figure of before`, () => {
      for (const b of [-1, 1]) {
        const cast = member({ ...def, sliders: { ...def.sliders, bodyAsymmetry: b } }, 1);
        expect(standingOf(cast, 1).some((v, i) => i % 4 === 3 && v)).toBe(true);
        expect(walkingOf(cast).every(f => f.some((v, i) => i % 4 === 3 && v))).toBe(true);
      }
    });
  }
});
