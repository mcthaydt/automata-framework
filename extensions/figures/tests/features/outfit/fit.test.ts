import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { measure } from '../../../src/features/body/genes';
import { J, skeleton } from '../../../src/features/body/rig';
import { girth, profiles, ringAt } from '../../../src/features/outfit/fit';

const bodyOf = (sliders: object = BASE[0].def.sliders) => {
  const m = measure(sliders), s = skeleton({ ...m.genes });
  return { m, s, p: profiles(m, s) };
};

describe('the body\'s profiles (outfit/fit.ts)', () => {
  it('have the body\'s keys', () => {
    const { p } = bodyOf();
    expect(p.torso.rings).toHaveLength(10);
    expect(p.arm.L.rings).toHaveLength(9); expect(p.arm.R.rings).toHaveLength(9);
    expect(p.leg.L.rings).toHaveLength(9); expect(p.leg.R.rings).toHaveLength(9);
    expect(p.neck.rings).toHaveLength(4);
  });
  it('ringAt is the profile at its keys, and between its neighbours between them', () => {
    const { p } = bodyOf();
    const rings = p.arm.L.rings;
    for (const r of rings) expect(ringAt(p, 'arm', 'L', r.y).rx).toBeCloseTo(r.rx, 9);
    const [a, b] = [rings[3], rings[4]], mid = ringAt(p, 'arm', 'L', (a.y + b.y) / 2).rx;
    expect(mid).toBeGreaterThanOrEqual(Math.min(a.rx, b.rx) - 1e-9);
    expect(mid).toBeLessThanOrEqual(Math.max(a.rx, b.rx) + 1e-9);
  });
  it('girth takes the widest over its span', () => {
    const { p, s } = bodyOf();
    const elbow = s.rest[J['foreArm.L']][1], hi = elbow + 0.05, lo = elbow - 0.05;
    const gi = girth(p, 'arm', 'L', hi, lo);
    for (const y of [hi, lo, elbow]) {
      expect(gi.rx).toBeGreaterThanOrEqual(ringAt(p, 'arm', 'L', y).rx - 1e-12);
      expect(gi.rz).toBeGreaterThanOrEqual(ringAt(p, 'arm', 'L', y).rz - 1e-12);
    }
    expect(gi.dx).toBeCloseTo(ringAt(p, 'arm', 'L', elbow).dx!, 9);
  });
  it('fat widens the arm', () => {
    const lean = bodyOf({ ...BASE[0].def.sliders, fat: 0 }), fat = bodyOf({ ...BASE[0].def.sliders, fat: 1.2 });
    const y = lean.p.arm.L.rings[5].y;
    expect(ringAt(fat.p, 'arm', 'L', y).rx).toBeGreaterThan(ringAt(lean.p, 'arm', 'L', y).rx);
  });
});
