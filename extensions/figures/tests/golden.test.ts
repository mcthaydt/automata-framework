import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { goldenFrames, GOLDEN_DENSITIES } from './golden';

/** The base pair must render pixel-identical to its goldens (recorded by scripts/golden.ts): every channel of every
 * pixel of every frame, standing, walking and hero, at each density. */
describe('the base pair matches its goldens', () => {
  for (const density of GOLDEN_DENSITIES) it(`at density ${density}`, () => {
    for (const { name, bytes } of goldenFrames(density)) {
      const want = gunzipSync(readFileSync(resolve(import.meta.dirname, 'golden', `${name}.rgba.gz`)));
      expect(bytes.length, name).toBe(want.length);
      let diff = 0, first = -1;
      for (let i = 0; i < bytes.length; i++) if (bytes[i] !== want[i]) { diff++; if (first < 0) first = i; }
      expect(diff, `${name}: ${diff} bytes differ, the first at ${first}`).toBe(0);
    }
  });
});
