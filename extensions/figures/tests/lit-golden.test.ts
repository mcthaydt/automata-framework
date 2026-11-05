import { describe, expect, it } from 'vitest';
import { litFrames } from './lit-golden';
import golden from './fixtures/lit.json';

/** The base pair lit must stay pixel-identical to its golden (recorded through the scene's composite before the cut):
 * every frame's md5. A failure names each frame that differs. */
describe('the lit base pair matches its golden', () => {
  it('every setup, facing and density', () => {
    const got = litFrames(), want = golden as Record<string, string>;
    expect(Object.keys(got)).toEqual(Object.keys(want));
    const differ = Object.keys(want).filter(name => got[name] !== want[name]);
    expect(differ, `${differ.length} frames differ`).toEqual([]);
  }, 120_000);
});
