import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { clearance, girth, profiles, ringAt, bodyOf } from '../../../src/features/outfit/fit';
import { profileAt, limb, weights, GROUP, type Part } from '../../../src/features/body/parts';
import { axisAngle } from '../../../src/lib/math';
import { box, dress, registerGarment, type Garment } from '../../../src/features/outfit/garments';
import type { Sliders } from '../../../src/features/body/genes';
import { BODY, endsOf } from '../body/ends';

const rig = (sliders: object = BASE[0].def.sliders) => {
  const m = measure(sliders), s = skeleton({ ...m.genes });
  return { m, s, p: profiles(m, s) };
};

describe('the body\'s profiles (outfit/fit.ts)', () => {
  it('have the body\'s keys', () => {
    const { p } = rig();
    expect(p.torso.rings).toHaveLength(10);
    expect(p.arm.L.rings).toHaveLength(9); expect(p.arm.R.rings).toHaveLength(9);
    expect(p.leg.L.rings).toHaveLength(9); expect(p.leg.R.rings).toHaveLength(9);
    expect(p.neck.rings).toHaveLength(4);
  });
  it('ringAt is the profile at its keys, and between its neighbours between them', () => {
    const { p } = rig();
    const rings = p.arm.L.rings;
    for (const r of rings) expect(ringAt(p, 'arm', 'L', r.y).rx).toBeCloseTo(r.rx, 9);
    const [a, b] = [rings[3], rings[4]], mid = ringAt(p, 'arm', 'L', (a.y + b.y) / 2).rx;
    expect(mid).toBeGreaterThanOrEqual(Math.min(a.rx, b.rx) - 1e-9);
    expect(mid).toBeLessThanOrEqual(Math.max(a.rx, b.rx) + 1e-9);
  });
  it('girth takes the widest over its span', () => {
    const { p, s } = rig();
    const elbow = s.rest[J['foreArm.L']][1], hi = elbow + 0.05, lo = elbow - 0.05;
    const gi = girth(p, 'arm', 'L', hi, lo);
    for (const y of [hi, lo, elbow]) {
      expect(gi.rx).toBeGreaterThanOrEqual(ringAt(p, 'arm', 'L', y).rx - 1e-12);
      expect(gi.rz).toBeGreaterThanOrEqual(ringAt(p, 'arm', 'L', y).rz - 1e-12);
    }
    expect(gi.dx).toBeCloseTo(ringAt(p, 'arm', 'L', elbow).dx!, 9);
  });
  it('fat widens the arm', () => {
    const lean = rig({ ...BASE[0].def.sliders, fat: 0 }), fat = rig({ ...BASE[0].def.sliders, fat: 1.2 });
    const y = lean.p.arm.L.rings[5].y;
    expect(ringAt(fat.p, 'arm', 'L', y).rx).toBeGreaterThan(ringAt(lean.p, 'arm', 'L', y).rx);
  });
});

// ─── Task 6: garments sized from the body ───
const SW = { cuffMat: { ramp: 10, base: 2 }, collarMat: { ramp: 10, base: 4 }, topMat: { ramp: 10, base: 3 } };
const worn = (sliders: Partial<Sliders>, sleeves: 'long' | 'short', ppm?: number, extra: Garment[] = []) => {
  const m = measure(sliders), s = skeleton({ ...m.genes });
  const look = dress(m, s, BASE[0].def.skin, [{ top: 'topMat', sleeves, cuffs: 'cuffMat', collar: 'collarMat' }, ...extra], { ...SWATCHES_ALL, ...SW }, ppm);
  return { m, s, look, p: profiles(m, s) };
};
import { SWATCHES } from '../../../src/features/outfit/garments';
const SWATCHES_ALL = SWATCHES;
const verts = (p: Part) => { const o: number[][] = []; for (let i = 0; i < p.mesh.positions.length; i += 3) o.push([p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]]); return o; };
const named = (look: { parts: Part[] }, material: string) => look.parts.filter(p => p.material === material);
const centre = (p: Part) => { const v = verts(p); return [0, 1, 2].map(a => v.reduce((n, q) => n + q[a], 0) / v.length); };

describe('garments sized from the body (cuffs, collar)', () => {
  /** Today's two box() calls, copied: the reference the base pair's and the default sliders must stay within 0.002 m of. */
  const today = (m: ReturnType<typeof measure>, s: ReturnType<typeof skeleton>, sleeves: 'long' | 'short') => {
    const k = m.k, t = m.thick, out: Part[] = [];
    for (const [side] of [['L'], ['R']] as const) out.push(sleeves === 'long'
      ? box(J[`foreArm.${side}`], 'cuffMat', side === 'L' ? GROUP.armL : GROUP.armR, { at: [0, -s.foreArm * 0.9, 0], r: [0.048 * k * t * m.arm, 0.022 * k, 0.05 * k * t * m.arm], e: [0.45, 0.6] })
      : box(J[`upperArm.${side}`], 'cuffMat', side === 'L' ? GROUP.armL : GROUP.armR, { at: [0, -s.upperArm * 0.86, 0], r: [0.056 * k * t * m.arm, 0.02 * k, 0.058 * k * t * m.arm], e: [0.45, 0.6] }));
    for (const x of [1, -1]) out.push(box(J.chest, 'collarMat', GROUP.torso, { at: [x * 0.04 * k, 0.172 * k, 0.045 * k], r: [0.04 * k, 0.018 * k, 0.04 * k], turn: axisAngle([0, 1, 0], x * 0.5), e: [0.35, 0.5] }));
    return out;
  };
  for (const [name, sliders] of [['base-m', BASE[0].def.sliders], ['base-f', BASE[1].def.sliders], ['default', {}]] as const) for (const sleeves of ['long', 'short'] as const) {
    it(`${name} ${sleeves}: the cuffs and collar are today's within 2 mm`, () => {
      const { m, s, look } = worn(sliders, sleeves), ref = today(m, s, sleeves);
      const mine = [...named(look, 'cuffMat'), ...named(look, 'collarMat')];
      expect(mine).toHaveLength(ref.length);
      mine.forEach((p, i) => {
        const a = verts(p), b = verts(ref[i]);
        expect(a).toHaveLength(b.length);
        a.forEach((q, j) => { for (let c = 0; c < 3; c++) expect(Math.abs(q[c] - b[j][c]), `${name} ${sleeves} part ${i} vertex ${j}`).toBeLessThan(0.002); });
      });
    });
  }
  const bodies: [string, Partial<Sliders>][] = [['fat 0', { fat: 0 }], ['fat 1.2', { fat: 1.2 }], ['bust 0', { bust: 0 }], ['bust 1', { bust: 1 }], ['seat 0', { seat: 0 }], ['seat 1', { seat: 1 }], ['neck 1 fat 1.2', { neck: 1, fat: 1.2 }],
    ...BODY.flatMap(key => endsOf(key).map(v => [`${key} ${v}`, { [key]: v }] as [string, Partial<Sliders>]))];
  it('clear every body at every density', () => {
    for (const ppm of [36.9, 73.8, 147.6]) for (const [name, over] of bodies) for (const base of BASE) for (const sleeves of ['long', 'short'] as const) {
      const sliders = { ...base.def.sliders, ...over }, { m, s, look, p } = worn(sliders, sleeves, ppm), clear = clearance(m.k, ppm), k = m.k;
      const tag = `${base.def.id} ${name} ${sleeves} ppm ${ppm}`;
      // The cuffs: the middle ring's vertices lie outside the ellipse of the arm's girth over the cuff's span plus the clearance.
      for (const side of ['L', 'R'] as const) {
        const bone = sleeves === 'long' ? J[`foreArm.${side}`] : J[`upperArm.${side}`], y = s.rest[bone][1] - (sleeves === 'long' ? 0.9 * s.foreArm : 0.86 * s.upperArm), hh = (sleeves === 'long' ? 0.022 : 0.02) * k;
        const G = girth(p, 'arm', side, y + hh, y - hh), cuff = named(look, 'cuffMat')[side === 'L' ? 0 : 1], mid = verts(cuff).filter(q => Math.abs(q[1] - (y - s.rest[bone][1])) < 1e-9);
        expect(mid.length, tag).toBeGreaterThan(4);
        for (const q of mid) {
          const dx = q[0] + s.rest[bone][0] - (G.dx ?? 0), dz = q[2] + s.rest[bone][2] - (G.dz ?? 0);
          expect(Math.hypot(dx / (G.rx + clear), dz / (G.rz + clear)), `${tag} ${side}`).toBeGreaterThanOrEqual(1 - 1e-6);
        }
      }
      // The collar: its pieces' outer faces stand `clear` past the neck's side and front at their height.
      const yc = s.rest[J.chest][1] + 0.172 * k, N = profileAt(p.neck, yc - s.rest[J.neck][1]), nz = s.rest[J.neck][2] - s.rest[J.chest][2] + (N.dz ?? 0);
      for (const piece of named(look, 'collarMat')) {
        const [cx, , cz] = centre(piece);
        expect(Math.abs(cx) + 0.04 * k - N.rx, tag).toBeGreaterThanOrEqual(clear - 1e-6);
        expect(cz + 0.04 * k - (nz + N.rz), tag).toBeGreaterThanOrEqual(clear - 1e-6);
      }
    }
  });
  it('a fork kind built from Wearing.body clears every body: a sleeve end and a trouser-leg hem', () => {
    registerGarment('fitProbe', { build: c => {
      const k = c.m.k, parts: Part[] = [];
      const ring = (region: 'arm' | 'leg', side: 'L' | 'R', bone: number, y: number, hh: number): Part => {
        const G = c.body.girth(region, side, y + hh, y - hh), r = { rx: G.rx + c.body.clear, rz: G.rz + c.body.clear };
        const mesh = limb({ seg: 16, rings: [{ y: y + hh, ...r, dx: G.dx, dz: G.dz }, { y: y - hh, ...r, dx: G.dx, dz: G.dz }] });
        return { mesh, material: 'topMat', group: region === 'arm' ? GROUP.armL : GROUP.legL, skin: weights(mesh, () => [[bone, 1]]) };
      };
      parts.push(ring('arm', 'L', J['foreArm.L'], c.s.rest[J['foreArm.L']][1] - 0.9 * c.s.foreArm, 0.022 * k));
      parts.push(ring('leg', 'L', J['shin.L'], c.s.genes.ankle + 0.05 * k, 0.02 * k));
      return { parts };
    } });
    for (const [name, over] of bodies) for (const base of BASE) {
      const sliders = { ...base.def.sliders, ...over }, m = measure(sliders), s = skeleton({ ...m.genes }), p = profiles(m, s), clear = clearance(m.k);
      const look = dress(m, s, base.def.skin, [{ fitProbe: true } as unknown as Garment], { ...SWATCHES, ...SW });
      const probes = look.parts.filter(q => q.skin && q.material === 'topMat' && q.skin[0][0][0] !== J.pelvis).slice(-2);
      expect(probes).toHaveLength(2);
      for (const [i, [region, y]] of ([['arm', s.rest[J['foreArm.L']][1] - 0.9 * s.foreArm], ['leg', s.genes.ankle + 0.05 * m.k]] as const).entries()) {
        const R = ringAt(p, region, 'L', y);
        for (const q of verts(probes[i]).filter(v => Math.abs(v[1] - y) < 0.011 * m.k)) {
          expect(Math.hypot((q[0] - (R.dx ?? 0)) / (R.rx + clear), (q[2] - (R.dz ?? 0)) / (R.rz + clear)), `${base.def.id} ${name} ${region}`).toBeGreaterThanOrEqual(1 - 1e-6);
        }
      }
    }
  });
  it('the collar rides the neck, not the bust', () => {
    const at = (over: Partial<Sliders>) => verts(named(worn({ ...BASE[1].def.sliders, ...over }, 'long').look, 'collarMat')[0]);
    expect(at({ bust: 1 })).toEqual(at({ bust: 0 }));
    const lean = worn({ ...BASE[0].def.sliders }, 'long'), thick = worn({ ...BASE[0].def.sliders, neck: 1, fat: 1.2 }, 'long');
    const cz = (w: ReturnType<typeof worn>) => centre(named(w.look, 'collarMat')[0])[2] / w.m.k;
    expect(cz(thick)).toBeGreaterThan(cz(lean));
  });
  it('fat grows the cuff', () => {
    const width = (fat: number) => { const w = worn({ ...BASE[0].def.sliders, fat }, 'short'), v = verts(named(w.look, 'cuffMat')[0]); return Math.max(...v.map(q => q[0])) - Math.min(...v.map(q => q[0])); };
    expect(width(1.2)).toBeGreaterThan(width(0));
  });
});
