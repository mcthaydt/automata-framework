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
  it('girth is the box round the body over its span: every ring inside it, and each side touched', () => {
    const { p, s } = rig();
    const elbow = s.rest[J['foreArm.L']][1], hi = elbow + 0.05, lo = elbow - 0.05, gi = girth(p, 'arm', 'L', hi, lo);
    let xHi = -Infinity, xLo = Infinity, zHi = -Infinity, zLo = Infinity;
    for (let i = 0; i <= 25; i++) {
      const r = ringAt(p, 'arm', 'L', lo + (hi - lo) * i / 25), dx = r.dx ?? 0, dz = r.dz ?? 0;
      expect(dx + r.rx).toBeLessThanOrEqual(gi.dx! + gi.rx + 1e-9); expect(dx - r.rx).toBeGreaterThanOrEqual(gi.dx! - gi.rx - 1e-9);
      expect(dz + r.rz).toBeLessThanOrEqual(gi.dz! + gi.rz + 1e-9); expect(dz - r.rz).toBeGreaterThanOrEqual(gi.dz! - gi.rz - 1e-9);
      xHi = Math.max(xHi, dx + r.rx); xLo = Math.min(xLo, dx - r.rx); zHi = Math.max(zHi, dz + r.rz); zLo = Math.min(zLo, dz - r.rz);
    }
    expect(gi.dx! + gi.rx).toBeCloseTo(xHi, 3); expect(gi.dx! - gi.rx).toBeCloseTo(xLo, 3);
    expect(gi.dz! + gi.rz).toBeCloseTo(zHi, 3); expect(gi.dz! - gi.rz).toBeCloseTo(zLo, 3);
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
/** The body's own mesh (the bare figure's skinned parts of a group, rest figure space), the vertices within `[y - hh, y + hh]`. */
const bare = (m: ReturnType<typeof measure>, s: ReturnType<typeof skeleton>, ppm?: number) => dress(m, s, BASE[0].def.skin, [], SWATCHES_ALL, ppm).parts;
const meshAt = (parts: Part[], group: number, y: number, hh: number) =>
  parts.filter(p => p.group === group && p.skin).flatMap(verts).filter(q => Math.abs(q[1] - y) <= hh + 1e-9);
/** How far inside an ellipse (centre, half-widths a and b) the nearest of `pts` lies, along the radius from the centre (negative: outside). */
const gap = (pts: number[][], cx: number, cz: number, a: number, b: number) =>
  Math.min(...pts.map(q => { const dx = q[0] - cx, dz = q[2] - cz, th = Math.atan2(dz, dx); return 1 / Math.hypot(Math.cos(th) / a, Math.sin(th) / b) - Math.hypot(dx, dz); }));
const centre = (p: Part) => { const v = verts(p); return [0, 1, 2].map(a => v.reduce((n, q) => n + q[a], 0) / v.length); };

describe('garments sized from the body (cuffs, collar)', () => {
  /** Today's collar box() call, copied: the reference the base pair's and the default sliders must stay within 0.002 m of. The
   * cuffs are not pinned to today's: they hug the arm (gate B), so they are narrower than the old flare. */
  const today = (m: ReturnType<typeof measure>) => {
    const k = m.k, out: Part[] = [];
    for (const x of [1, -1]) out.push(box(J.chest, 'collarMat', GROUP.torso, { at: [x * 0.04 * k, 0.172 * k, 0.045 * k], r: [0.04 * k, 0.018 * k, 0.04 * k], turn: axisAngle([0, 1, 0], x * 0.5), e: [0.35, 0.5] }));
    return out;
  };
  for (const [name, sliders] of [['base-m', BASE[0].def.sliders], ['base-f', BASE[1].def.sliders], ['default', {}]] as const) for (const sleeves of ['long', 'short'] as const) {
    it(`${name} ${sleeves}: the collar is today's within 2 mm`, () => {
      const { m, s, look } = worn(sliders, sleeves), ref = today(m);
      const mine = named(look, 'collarMat');
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
    // Audit S4: checked against the body's mesh, not the profile the garment was sized from.
    for (const ppm of [36.9, 73.8, 147.6]) for (const [name, over] of bodies) for (const base of BASE) for (const sleeves of ['long', 'short'] as const) {
      const sliders = { ...base.def.sliders, ...over }, { m, s, look } = worn(sliders, sleeves, ppm), clear = clearance(m.k, ppm), k = m.k, body = bare(m, s, ppm);
      const tag = `${base.def.id} ${name} ${sleeves} ppm ${ppm}`;
      // The cuffs: every vertex of the arm's mesh within the cuff's span lies inside the cuff's ellipse by `clear`, along the radius.
      for (const side of ['L', 'R'] as const) {
        const bone = sleeves === 'long' ? J[`foreArm.${side}`] : J[`upperArm.${side}`], y = s.rest[bone][1] - (sleeves === 'long' ? 0.9 * s.foreArm : 0.86 * s.upperArm), hh = (sleeves === 'long' ? 0.022 : 0.02) * k;
        const G = girth(profiles(m, s), 'arm', side, y + hh, y - hh), arm = meshAt(body, side === 'L' ? GROUP.armL : GROUP.armR, y, hh);
        expect(arm.length, tag).toBeGreaterThan(10);
        expect(gap(arm, G.dx!, G.dz!, G.rx + clear, G.rz + clear), `${tag} ${side}`).toBeGreaterThanOrEqual(clear - 1e-6);
      }
      // The collar: its outermost vertex on each side, and at the front, stands `clear` past the neck's mesh over the collar's height.
      const collar = named(look, 'collarMat').flatMap(verts).map(q => [q[0] + s.rest[J.chest][0], q[1] + s.rest[J.chest][1], q[2] + s.rest[J.chest][2]]);
      const lo = Math.min(...collar.map(q => q[1])), hi = Math.max(...collar.map(q => q[1]));
      const neck = body.filter(p => p.bone === J.neck && p.tag === 'neck').flatMap(verts).map(q => [q[0] + s.rest[J.neck][0], q[1] + s.rest[J.neck][1], q[2] + s.rest[J.neck][2]]).filter(q => q[1] >= lo && q[1] <= hi);
      expect(neck.length, tag).toBeGreaterThan(4);
      const out = (pts: number[][], f: (q: number[]) => number) => Math.max(...pts.map(f));
      expect(out(collar, q => q[0]) - out(neck, q => q[0]), `${tag} +x`).toBeGreaterThanOrEqual(clear - 1e-6);
      expect(out(collar, q => -q[0]) - out(neck, q => -q[0]), `${tag} -x`).toBeGreaterThanOrEqual(clear - 1e-6);
      expect(out(collar, q => q[2]) - out(neck, q => q[2]), `${tag} front`).toBeGreaterThanOrEqual(clear - 1e-6);
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
      const bareParts = bare(m, s);
      for (const [i, [region, y, hh]] of ([['arm', s.rest[J['foreArm.L']][1] - 0.9 * s.foreArm, 0.022 * m.k], ['leg', s.genes.ankle + 0.05 * m.k, 0.02 * m.k]] as const).entries()) {
        const G = girth(p, region, 'L', y + hh, y - hh), mesh = meshAt(bareParts, region === 'arm' ? GROUP.armL : GROUP.legL, y, hh);
        expect(mesh.length, `${base.def.id} ${name} ${region}`).toBeGreaterThan(10);
        expect(gap(mesh, G.dx!, G.dz!, G.rx + clear, G.rz + clear), `${base.def.id} ${name} ${region}`).toBeGreaterThanOrEqual(clear - 1e-6);
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
  it('a cuff hugs the arm: its half-width is the girth over its span plus one texel, no more', () => {
    for (const base of BASE) for (const sleeves of ['long', 'short'] as const) for (const ppm of [36.9, 73.8, 147.6]) {
      const { m, s, look, p } = worn(base.def.sliders, sleeves, ppm), clear = clearance(m.k, ppm);
      (['L', 'R'] as const).forEach((side, i) => {
        const bone = sleeves === 'long' ? J[`foreArm.${side}`] : J[`upperArm.${side}`], y = s.rest[bone][1] - (sleeves === 'long' ? 0.9 * s.foreArm : 0.86 * s.upperArm), hh = (sleeves === 'long' ? 0.022 : 0.02) * m.k;
        const G = girth(p, 'arm', side, y + hh, y - hh), v = verts(named(look, 'cuffMat')[i]);
        expect((Math.max(...v.map(q => q[0])) - Math.min(...v.map(q => q[0]))) / 2, `${base.def.id} ${sleeves} ${side} ${ppm}`).toBeCloseTo(G.rx + clear, 9);
      });
    }
  });
  it('fat grows the cuff', () => {
    const width = (fat: number) => { const w = worn({ ...BASE[0].def.sliders, fat }, 'short'), v = verts(named(w.look, 'cuffMat')[0]); return Math.max(...v.map(q => q[0])) - Math.min(...v.map(q => q[0])); };
    expect(width(1.2)).toBeGreaterThan(width(0));
  });
});
