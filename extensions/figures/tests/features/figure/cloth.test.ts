import { beforeAll, describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { GROUP } from '../../../src/features/body/parts';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { arcOf, clothFrame, clothSlots, clothU, slotAt } from '../../../src/features/figure/cloth';
import { Figure } from '../../../src/features/figure/figure';
import { member } from '../../../src/features/figure/frames';
import { dress } from '../../../src/features/outfit/garments';
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
  it('the slots are the same in every pose', () => {
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
