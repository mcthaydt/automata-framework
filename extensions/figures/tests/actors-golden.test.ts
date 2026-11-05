import { describe, expect, it } from 'vitest';
import { ACTOR_WHO, actorFrames } from './actors-golden';
import golden from './fixtures/actors.json';

/** The scriptable actors must draw pixel-identical to their golden (recorded by scripts/golden.ts before the cut, from
 * tests/actors-golden.ts): every frame's md5, for each base figure. A failure names each frame that differs. */
describe('the actors match their golden', () => {
  for (const who of ACTOR_WHO) it(who, () => {
    const got = actorFrames(who), want = Object.fromEntries(Object.entries(golden as Record<string, string>).filter(([name]) => name.startsWith(`${who}/`)));
    expect(Object.keys(got)).toEqual(Object.keys(want));
    const differ = Object.keys(want).filter(name => got[name] !== want[name]);
    expect(differ, `${differ.length} frames differ`).toEqual([]);
  }, 120_000);
});
