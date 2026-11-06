import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { skeleton } from '../../../src/features/body/rig';
import { headForm } from '../../../src/features/body/head';
import { measure } from '../../../src/features/body/genes';
import { Figure } from '../../../src/features/figure/figure';
import { member, standing, walking } from '../../../src/features/figure/frames';
import type { CharacterDef } from '../../../src/features/figure/cast';

/**
 * Fat reaches the limbs, the neck and the jaw's underside (c4 stage 1): each limb fuller and smoother, not a scaled
 * muscle: the swells grow most, the joints more (the notch closes), the thigh's top less, wrists and ankles by a tenth.
 */
const fatOf = (def: CharacterDef, fat: number): CharacterDef => ({ ...def, sliders: { ...def.sliders, fat } });
const filled = (px: Uint8ClampedArray) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) n++; return n; };

describe('Measure.fat', () => {
  it('is exactly 1 in every class at fat 0', () => {
    expect(measure({ fat: 0 }).fat).toEqual({ swell: 1, joint: 1, hipTop: 1, end: 1, neck: 1, chin: 1 });
  });
  it('at fat 1: the swells ~35%, the joints more, the thigh\'s top less, the ends ≤ 10%, the neck ~20%, the chin fuller', () => {
    const f = measure({ fat: 1 }).fat;
    expect(f.swell).toBeCloseTo(1.35, 2);
    expect(f.joint).toBeGreaterThan(f.swell);
    expect(f.hipTop).toBeLessThan(f.swell);
    expect(f.end).toBeLessThanOrEqual(1.1);
    expect(f.neck).toBeCloseTo(1.2, 2);
    expect(f.chin).toBeGreaterThan(1);
  });
  it('past 1 keeps its proportion, not clamped', () => {
    const a = measure({ fat: 1 }).fat, b = measure({ fat: 1.2 }).fat;
    for (const key of Object.keys(a) as (keyof typeof a)[]) expect(b[key], key).toBeGreaterThan(a[key]);
  });
});

describe('a heavy figure', () => {
  it('base-m at fat 1, D2 three-quarter, fills more than main did (3551 + 150 texels)', () => {
    expect(filled(standing(member(fatOf(BASE[0].def, 1), 2), 1))).toBeGreaterThanOrEqual(3551 + 150);
  });
  it('walks at fat 1.2 on either base figure: every frame builds and paints', () => {
    for (const c of BASE) walking(member(fatOf(c.def, 1.2), 2)).forEach((f, i) => expect(filled(f), `${c.def.id} ${i}`).toBeGreaterThan(400 * 4));
  });
  it('the arms hang further out to clear the heavier body (main: base-m 0.08, base-f 0.18 at fat 1.2)', () => {
    const clearOf = (def: CharacterDef) => ((new Figure(member(fatOf(def, 1.2), 2)) as unknown as { built: { clear: [number, number] } }).built.clear[0]);
    expect(clearOf(BASE[0].def)).toBeGreaterThan(0.08);
    expect(clearOf(BASE[1].def)).toBeGreaterThan(0.18);
  });
});

describe('under the chin', () => {
  const form = (fat: number) => { const m = measure({ fat }); return headForm(m, skeleton(m.genes)); };
  it('a heavy figure\'s jaw is fuller underneath: wider at t 0.08 and 0.14, the chin pushed forward a little, the point where it was', () => {
    const lean = form(0), heavy = form(1);
    expect(heavy.width(0.08)).toBeGreaterThan(lean.width(0.08) * 1.15);
    expect(heavy.width(0.14)).toBeGreaterThan(lean.width(0.14) * 1.1);
    expect(heavy.front(0.07)).toBeGreaterThan(lean.front(0.07));
    expect(heavy.front(0)).toBeCloseTo(lean.front(0), 9);
  });
  it('leaves the cranium and the cheeks alone', () => {
    const lean = form(0), heavy = form(1);
    for (const t of [0.3, 0.45, 0.62, 0.8]) expect(heavy.width(t) / lean.width(t), `t ${t}`).toBeCloseTo(heavy.width(0.5) / lean.width(0.5), 9);
  });
});
