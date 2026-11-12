import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { BASE } from '../../../base/base';
import { member, standing } from '../../../src/features/figure/frames';
import { grid } from '../../../src/features/hair/hair';
import type { V3 } from '../../../src/lib/math';
import { nudged } from '../../support/ulp';

/**
 * The hair's poles. A grid row pinched to a point (the crown of a scalp) has an outward offset `p − inner(i)` of exactly
 * 0, or of rounding (1e-10 m), so which way its normal faced was the maths library's last bit, not the shape's. On
 * arm64 that turned `nia` on the thin body into a different picture. The rule: a pole faces the way its row does.
 */
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');
const COLS = 8, TAU = Math.PI * 2;
const ring = (r: number, y: number, j: number): V3 => [r * Math.cos(TAU * j / COLS), y, r * Math.sin(TAU * j / COLS)];

/** Three rows of a cone: row 0 a pole at (offset from) the origin, rows 1 and 2 rings above it. */
function cone(offset: V3) {
  const at = (i: number, j: number): V3 => (i === 0 ? offset : ring(0.1 * i, 0.1 * i, j));
  return grid(2, COLS, at, true, i => [0, 0.1 * i, 0]);
}
/** Row 0's normals against row 1's outward direction (its ring point less its own inner point), column by column. */
function dotsWithRow(offset: V3) {
  const mesh = cone(offset);
  return Array.from({ length: COLS }, (_, j) => {
    const n = mesh.normals.slice(3 * j, 3 * j + 3), out = ring(0.1, 0.1, j);
    return n[0] * out[0] + n[1] * (out[1] - 0.1) + n[2] * out[2];
  });
}

describe('a hair-grid pole', () => {
  it('a pole a rounding off its inner point faces the way its row does', () => {
    for (const o of [[1e-10, 0, 0], [-1e-10, 0, 0], [0, 1e-10, 0], [0, -1e-10, 0], [0, 0, 1e-10], [0, 0, -1e-10]] as V3[])
      for (const d of dotsWithRow(o)) expect(d, `offset ${o}`).toBeGreaterThan(0);
  });
  it('a pole exactly on its inner point faces the way its row does', () => {
    for (const d of dotsWithRow([0, 0, 0])) expect(d).toBeGreaterThan(0);
  });
});

describe('the painter under the last bit of the maths', () => {
  it('the base pair paint the same cell whatever the last bit of the maths', () => {
    for (const c of BASE) for (let d = 0; d < 8; d++) {
      const paint = () => standing(member(c.def, 2), d);
      const plain = md5(paint());
      for (let seed = 1; seed <= 8; seed++) expect(md5(nudged(seed, paint)), `${c.def.id} direction ${d} seed ${seed}`).toBe(plain);
    }
  }, 300_000);
});
