/**
 * The sprites golden's frames: an md5 per frame of each base member's hero, 8 standing views and walk, at the
 * densities the sprites are kept at, with the default pitch. Shared by the recorder (scripts/golden.ts) and the test
 * (tests/features/actors/actors.test.ts), so both draw exactly the same frames.
 */
import { createHash } from 'node:crypto';
import { BASE } from '../../base/base';
import { hero, member, standing, walking } from '../../src/features/figure/frames';

const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');

/** Every `[id, density]` set the golden keeps, in the order the test runs them. */
export const SPRITE_SETS: [string, number][] = [1, 2].flatMap(D => BASE.map((c): [string, number] => [c.def.id, D]));

/** The md5 of each of one member-density's 17 frames: the hero, the 8 views standing, the walk's 8 poses. */
export function spriteSet(id: string, D: number): string[] {
  const c = BASE.find(b => b.def.id === id)!, cast = member(c.def, D);
  return [hero(cast, c.pose), ...[0, 1, 2, 3, 4, 5, 6, 7].map(d => standing(cast, d)), ...walking(cast)].map(md5);
}

/** Every set, keyed `${id}-D${D}` with the keys sorted (the order tests/golden/sprites.json lists them in). */
export function spriteFrames(): Record<string, string[]> {
  return Object.fromEntries(
    SPRITE_SETS.map(([id, D]) => [`${id}-D${D}`, spriteSet(id, D)] as [string, string[]]).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}
