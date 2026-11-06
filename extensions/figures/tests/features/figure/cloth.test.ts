import { beforeAll, describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { GROUP } from '../../../src/features/body/parts';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { labelAt } from '../../../src/features/paint/fabric';
import { FIXTURES } from '../paint/fabric-fixtures';
import { arcOf, clothFrame, clothSlots, clothU, slotAt } from '../../../src/features/figure/cloth';
import { Figure } from '../../../src/features/figure/figure';
import { VERT } from '../../../src/features/paint/raster';
import { member } from '../../../src/features/figure/frames';
import { dress, type Garment } from '../../../src/features/outfit/garments';
import { profiles } from '../../../src/features/outfit/fit';
import type { Sliders } from '../../../src/features/body/genes';
import { BODY, endsOf } from '../body/ends';
import { dressed } from '../draw';
import { registerFixtures } from '../paint/fabric-fixtures';

beforeAll(registerFixtures);

const fxCloth = { ramp: 10, base: 3, fabric: 'fx-rib' };
const rig = (sliders: Partial<Sliders> = BASE[0].def.sliders) => {
  const m = measure(sliders), s = skeleton({ ...m.genes });
  return { m, s, p: profiles(m, s), f: clothFrame(profiles(m, s), s) };
};
const perimeter = (A: number, B: number) => Math.PI * (3 * (A + B) - Math.sqrt((3 * A + B) * (A + 3 * B)));

describe('cloth coordinates (the mapping)', () => {
  it('the wrap lies at centre back for the torso', () => {
    const { f } = rig(), c = f.get(GROUP.torso)!;
    const half = perimeter(c.A, c.B) / 2;
    const a = clothU(f, GROUP.torso, Math.cos(0.999 * Math.PI), Math.sin(0.999 * Math.PI))!;
    const b = clothU(f, GROUP.torso, Math.cos(-0.999 * Math.PI), Math.sin(-0.999 * Math.PI))!;
    expect(a).toBeCloseTo(half, 2); expect(b).toBeCloseTo(-half, 2);
    // Centre front is zero; the skirt and the cape share the trunk's cylinder.
    expect(clothU(f, GROUP.torso, 1, 0)).toBeCloseTo(0, 9);
    expect(f.get(GROUP.skirt)).toBe(c); expect(f.get(GROUP.cape)).toBe(c);
  });
  it('the wrap lies on the inside of each limb', () => {
    const { f, s } = rig();
    for (const [group, side] of [[GROUP.armL, 1], [GROUP.armR, -1], [GROUP.legL, 1], [GROUP.legR, -1]] as const) {
      const c = f.get(group)!, y = s.rest[J.pelvis][1] * 0.5, R = c.ring(y);
      const inside = slotAt(c, (R.dx ?? 0) - side * R.rx, y, R.dz ?? 0), outside = slotAt(c, (R.dx ?? 0) + side * R.rx, y, R.dz ?? 0);
      expect(Math.abs(Math.atan2(inside[1], inside[0]))).toBeCloseTo(Math.PI, 6);
      expect(Math.atan2(outside[1], outside[0])).toBeCloseTo(0, 6);
      expect(inside[2]).toBeCloseTo(-y, 9);
    }
    expect(f.get(GROUP.head)).toBeUndefined(); expect(f.get(GROUP.item)).toBeUndefined();
  });
  it('limbs mirror: front is the same side of the wrap on both', () => {
    const { f } = rig(), y = 1.2;
    const front = (g: number, side: number) => { const c = f.get(g)!, R = c.ring(y); return slotAt(c, R.dx ?? 0, y, (R.dz ?? 0) + R.rz)[1] * side; };
    expect(front(GROUP.armL, 1)).toBeGreaterThan(0.99); expect(front(GROUP.armR, -1)).toBeLessThan(-0.99);
    const l = f.get(GROUP.armL)!, r = f.get(GROUP.armR)!;
    expect(slotAt(l, (l.ring(y).dx ?? 0), y, (l.ring(y).dz ?? 0) + l.ring(y).rz)[1])
      .toBeCloseTo(slotAt(r, (r.ring(y).dx ?? 0), y, (r.ring(y).dz ?? 0) + r.ring(y).rz)[1], 9);
  });
  it('u is arc length on the ellipse', () => {
    for (const limb of [false, true]) {
      const arc = arcOf(0.2, 0.1, limb);
      expect(arc).toHaveLength(257);
      expect(arc[128]).toBeCloseTo(0, 9);
      const P = perimeter(0.2, 0.1);
      expect(Math.abs((arc[256] - arc[0]) - P) / P).toBeLessThan(0.005);
      expect(Math.abs((arc[192] - arc[128]) - P / 4) / (P / 4)).toBeLessThan(0.01);
    }
  });
  it('the side seam holds at bust and seat 1', () => {
    const { m, s, f } = rig({ ...BASE[1].def.sliders, bust: 1, seat: 1 });
    const look = dress(m, s, BASE[1].def.skin, []);
    const torso = look.parts.filter(p => p.group === GROUP.torso && p.skin);
    const lo = s.hipY + 0.09 * m.k, hi = s.shoulderY - 0.016 * m.k, widest = new Map<string, [number, number, number]>();
    for (const p of torso) for (let i = 0; i < p.mesh.positions.length; i += 3) {
      const [x, y, z] = [p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]];
      if (y < lo || y > hi) continue;
      const key = y.toFixed(6), prev = widest.get(key);
      if (!prev || x > prev[0]) widest.set(key, [x, y, z]);
    }
    expect(widest.size).toBeGreaterThan(8);
    const us = [...widest.values()].map(([x, y, z]) => { const [c, sn] = slotAt(f.get(GROUP.torso)!, x, y, z); return clothU(f, GROUP.torso, c, sn)!; });
    expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.5 / 73.8);
  });
  it('the slots are built once, and no pose rewrites them', () => {
    const fig = new Figure(member(dressed([{ top: 'fxCloth', sleeves: 'long' }], { fxCloth }), 2));
    const before = fig['built'].cloth!.slice();
    expect(before.length).toBe(fig['built'].vertexCount * 3);
    for (let i = 0; i < 8; i++) fig.update(1 / 12, { facing: Math.PI / 4, moving: true, view: { azimuth: 0, pitch: 0.3 } });
    expect(fig['built'].cloth).toEqual(before);
  });
  it('every slot is finite at every slider end', () => {
    const swatches = { fxCloth };
    for (const key of ['fat', ...BODY] as (keyof Sliders)[]) for (const v of key === 'fat' ? [0, 1.2] : endsOf(key)) {
      const def = dressed([{ top: 'fxCloth', sleeves: 'long' }, { shorts: 'fxCloth' }], swatches);
      def.sliders = { ...def.sliders, [key]: v };
      const built = new Figure(member(def, 1))['built'];
      for (const x of built.cloth!) expect(Number.isFinite(x), `${key} ${v}`).toBe(true);
      for (const c of built.frame!.values()) { expect(c.A, `${key} ${v}`).toBeGreaterThan(0); expect(c.B, `${key} ${v}`).toBeGreaterThan(0); }
    }
  });
  it('an unknown fabric throws', () => {
    const def = dressed([{ top: 'nopeCloth', sleeves: 'long' }], { nopeCloth: { ramp: 10, base: 3, fabric: 'nope' } });
    expect(() => new Figure(member(def, 1))).toThrow(/no fabric nope/);
  });
  it('no fabric, no slots', () => {
    const fig = new Figure(member(BASE[0].def, 1));
    expect(fig['built'].cloth).toBeNull(); expect(fig['built'].frame).toBeNull();
  });
  it('clothSlots keeps part order, with zeros for an untiled group', () => {
    const { m, s, f } = rig(), look = dress(m, s, BASE[0].def.skin, []);
    const slots = clothSlots(look.parts, s, f);
    let n = 0; for (const p of look.parts) n += p.mesh.positions.length / 3;
    expect(slots.length).toBe(n * 3);
    let at = 0;
    for (const p of look.parts) {
      const count = p.mesh.positions.length / 3;
      if (p.group === GROUP.head) for (let i = 0; i < count * 3; i++) expect(slots[at * 3 + i]).toBe(0);
      at += count;
    }
  });
});

/** A figure at pitch 0 (audit B1: at the sheets' 18° a ring projects as an ellipse), its cloth channel read as labels. */
const drawn = (swatch: string, view: number, garments: Garment[] = [{ top: swatch, sleeves: 'long' }], base = BASE[0].def) => {
  const sw = { fxrib: { ramp: 10, base: 3, fabric: 'fx-rib' }, fxacross: { ramp: 10, base: 3, fabric: 'fx-across' } };
  const f = new Figure(member(dressed(garments, sw, base), 2));
  f.cache = false;
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: view * Math.PI / 4, moving: false, view: { azimuth: 0, pitch: 0 } });
  return f;
};
const labelsOf = (f: Figure, fab: keyof typeof FIXTURES, group: number = GROUP.torso) => {
  const out = new Map<number, number>();
  for (let k = 0; k < f.g.w * f.g.h; k++) { const at = f.clothAt(k); if (at && f.g.group[k] === group) out.set(k, labelAt(FIXTURES[fab], at[0], at[1], 73.8)); }
  return out;
};
describe('cloth on the figure (the mapping drawn)', () => {
  it('has no shear: stripes across are level on the flanks', () => {
    for (const base of [BASE[0].def, BASE[1].def]) for (const view of [0, 1, 2, 4]) {
      const f = drawn('fxacross', view, [{ top: 'fxacross', sleeves: 'long' }], base), labels = labelsOf(f, 'across'), rows = new Map<number, Set<number>>(), count = new Map<number, number>();
      for (const [k, l] of labels) { const y = Math.floor(k / f.g.w); (rows.get(y) ?? rows.set(y, new Set()).get(y)!).add(l); count.set(y, (count.get(y) ?? 0) + 1); }
      const wide = [...rows].filter(([y]) => count.get(y)! >= 4);
      expect(wide.length, `${base.id} view ${view}`).toBeGreaterThan(20);
      expect(wide.filter(([, set]) => set.size === 1).length / wide.length, `${base.id} view ${view}`).toBeGreaterThanOrEqual(0.9);
    }
  });
  it('is continuous across the chest, waist and pelvis', () => {
    const f = drawn('fxrib', 0, [{ top: 'fxrib', sleeves: 'long' }, { shorts: 'fxrib' }]), s = f.skeleton, k = f.member.genes.height / 1.62;
    for (const yb of [s.chestY - 0.07 * k, s.hipY + 0.09 * k]) {
      let columns = 0, match = 0;
      for (let x = 0; x < f.g.w; x++) for (let y = 0; y < f.g.h - 1; y++) {
        const a = f.clothAt(y * f.g.w + x), b = f.clothAt((y + 1) * f.g.w + x);
        if (!a || !b || f.g.group[y * f.g.w + x] !== GROUP.torso || f.g.group[(y + 1) * f.g.w + x] !== GROUP.torso) continue;
        if (a[1] < -yb && b[1] >= -yb) { columns++; if (labelAt(FIXTURES.rib, a[0], a[1], 73.8) === labelAt(FIXTURES.rib, b[0], b[1], 73.8)) match++; break; }
      }
      expect(columns, `boundary ${yb}`).toBeGreaterThan(10);
      expect(match / columns, `boundary ${yb}`).toBeGreaterThanOrEqual(0.9);
    }
  });
  it('holds still on the body through the walk (each vertex tracks its own cloth coordinates)', () => {
    // Per vertex, not per share (audit S1): the texel a camera-facing torso vertex lands on reads the cloth coordinates that
    // vertex was given at build, in every pose of the walk. A pattern that swims (slots fed from the posed soup, or rotated
    // per frame) fails this; the share of rib texels at one label does not tell, it is about a half for any u field.
    const f = new Figure({ ...member(dressed([{ top: 'fxrib', sleeves: 'long' }], { fxrib: { ramp: 10, base: 3, fabric: 'fx-rib' } }), 2), blink: 0 });
    f.cache = false;
    const built = f['built'], cloth = built.cloth!, frame = built.frame!, S = f.style.supersample, texel = 1 / 73.8;
    const ranges: [number, number][] = []; let at = 0;
    for (const p of built.parts) { const n = p.mesh.positions.length / 3; if (p.group === GROUP.torso) ranges.push([at, at + n]); at += n; }
    let frames = 0;
    for (let i = 0; i < Math.round(f.member.gait.cycle * 4 * 60) && frames < 8; i++) {
      if (!f.update(1 / 60, { facing: Math.PI / 4, moving: true, view: { azimuth: 0, pitch: 0 } })) continue;
      frames++;
      const verts = f['soup']!.verts;
      let tested = 0, near = 0;
      for (const [lo, hi] of ranges) for (let v = lo; v < hi; v++) {
        if (verts[v * VERT + 5] <= 0.5) continue;
        const x = Math.floor(verts[v * VERT] / S), y = Math.floor(verts[v * VERT + 1] / S);
        if (x < 0 || y < 0 || x >= f.g.w || y >= f.g.h) continue;
        const k = y * f.g.w + x;
        if (f.g.group[k] !== GROUP.torso || Math.abs(f.g.depth[k] - verts[v * VERT + 2]) >= 0.01) continue;
        const at2 = f.clothAt(k), own = clothU(frame, GROUP.torso, cloth[v * 3], cloth[v * 3 + 1]);
        if (!at2 || own === null) continue;
        tested++;
        if (Math.abs(at2[0] - own) <= texel && Math.abs(at2[1] - cloth[v * 3 + 2]) <= texel) near++;
      }
      expect(tested, `frame ${frames}`).toBeGreaterThanOrEqual(50);
      expect(near / tested, `frame ${frames}`).toBeGreaterThanOrEqual(0.9);
    }
    expect(frames).toBe(8);
  });
});
