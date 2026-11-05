/**
 * The base pair's golden frames: what `npm run render` draws for each member (scripts/render.ts), flattened per sheet
 * into one RGBA buffer, named `<id>-<turn|walk|hero>-d<density>`. Shared by the recorder (scripts/golden.ts) and the
 * test (tests/golden/base.test.ts), so both draw exactly the same frames.
 */
import { hero, member, standing, walking, type Frame } from '../../src/features/figure/frames';
import { BASE } from '../../base/base';

/** The densities the goldens are kept at: the kit's own and the sprites' ×2. */
export const GOLDEN_DENSITIES = [1, 2] as const;
/** The sheets' pitch (scripts/render.ts's default). */
const PITCH = 18 * Math.PI / 180;

const join = (frames: Frame[]) => {
  const out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
  let at = 0;
  for (const f of frames) { out.set(f, at); at += f.length; }
  return out;
};

/** Every golden sheet at `density`, each its frames' RGBA laid end to end. */
export function goldenFrames(density: number): { name: string; bytes: Uint8Array }[] {
  return BASE.flatMap(c => {
    const cast = member(c.def, density), at = `d${density}`;
    return [
      { name: `${c.def.id}-turn-${at}`, bytes: join([0, 1, 2, 3, 4, 5, 6, 7].map(d => standing(cast, d, PITCH))) },
      { name: `${c.def.id}-walk-${at}`, bytes: join(walking(cast, PITCH)) },
      { name: `${c.def.id}-hero-${at}`, bytes: join([hero(cast, c.pose, Math.PI / 4, PITCH)]) },
    ];
  });
}
