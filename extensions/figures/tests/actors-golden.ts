/**
 * The scriptable actors' golden frames: what the actors (src/render/figure/actor.ts) draw on the base pair, kept as an
 * md5 of each frame's RGBA and named `<who>/<case>/<moment>@D<density>`. The cases are: every action in the library at
 * five moments of its envelope (its start, its wind-up, its strike, its end and half its recovery), with the swing
 * holding a torch; the run, the strafe and stepping in place; each of the base pair's lookbook stands held, at D1 and D2;
 * and one long script (a path with a run, a wait, a strafe and a march, face keys, look-at targets, a talking
 * expression, a held torch, a wave, a point and a sit) sampled every half second, at D1 and D2.
 *
 * The recorder (scripts/golden.ts) and the test (tests/actors-golden.test.ts) both draw from here, so they draw exactly
 * the same frames. The set is frozen: it is not the demo's contact sheet (scripts/actors-demo.ts), which may change.
 */
import { createHash } from 'node:crypto';
import { Troupe, type ActionCue, type ActorScript } from '../src/render/figure/actor';
import { ACTIONS, actionOf, lengthOf } from '../src/render/figure/actions';
import { view } from '../scripts/frames';

/** The characters the actors are recorded on: the base pair, by id. */
export const ACTOR_WHO = ['base-m', 'base-f'] as const;
/** The base pair's lookbook stands (base/base.ts), each held as a stand. */
const STANDS = ['armsCrossed', 'handOnHip'];
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');

/** A case: a script for a character, the moments it is drawn at (s), and the density it is drawn at. */
interface Case { name: string; script: (who: string) => ActorScript; at: number[]; density: number }

/** Every case, in a fixed order. */
function cases(): Case[] {
  const out: Case[] = [];
  for (const id of Object.keys(ACTIONS).filter(id => !('alias' in ACTIONS[id]))) {
    const { def } = actionOf(id, false, false), hold = def.hold ? 0.8 : 0, len = lengthOf(def) + hold, t0 = 0.2;
    const cue: ActionCue = { t: t0, action: id, ...(hold ? { until: t0 + len } : {}), ...(def.targeted ? { at: 'other' } : {}) };
    const strike = def.keys.find(k => k[0] > def.anticipation + 0.01)?.[0] ?? def.anticipation + def.action / 2;
    out.push({
      name: id, density: 2,
      script: who => ({ who, at: [0, 0], facing: 35, actions: [cue], items: id === 'swing' ? [{ t: 0, hold: 'torch' }] : [] }),
      at: [t0 + 0.01, t0 + def.anticipation, t0 + Math.min(strike, len), t0 + len, t0 + len + def.recovery * 0.5],
    });
  }
  out.push(
    { name: 'run', density: 2, script: who => ({ who, at: [0, 0], path: [{ at: [6, 6], run: true }] }), at: [0.05, 0.12, 0.19, 0.26, 0.33] },
    { name: 'strafe', density: 2, script: who => ({ who, at: [0, 0], facing: 0, path: [{ at: [4, 0], strafe: true }] }), at: [0.1, 0.25, 0.4, 0.55, 0.7] },
    { name: 'march', density: 2, script: who => ({ who, at: [0, 0], facing: 35, path: [{ at: [0, 0.001], march: 3 }] }), at: [0.1, 0.25, 0.4, 0.55, 0.7] },
  );
  for (const pose of STANDS) for (const density of [1, 2])
    out.push({ name: `stand-${pose}`, density, script: who => ({ who, at: [0, 0], facing: 45, stands: [{ t: 0, pose }] }), at: [0, 0.2, 1] });
  for (const density of [1, 2]) out.push({
    name: 'script', density,
    script: who => ({
      name: 'a', who, at: [0, 0], facing: 0,
      path: [{ at: [2, 1] }, { at: [2, 3], run: true, wait: 0.5 }, { at: [1, 3], strafe: true, march: 0.6 }],
      face: [{ t: 4, to: 90 }], look: [{ t: 1, at: [5, 5] }, { t: 3.5, at: null }],
      actions: [{ t: 0.5, action: 'wave' }, { t: 2.6, action: 'point', at: 'other' }, { t: 4.5, action: 'sit', until: 6 }],
      expressions: [{ t: 1, is: 'talk' }], items: [{ t: 2, hold: 'torch' }],
    }),
    at: [...Array(15).keys()].map(i => i * 0.5),
  });
  return out;
}

/** One character's actor goldens: frame name → md5 of its RGBA. Each case plays in a fresh troupe, beside a base-m
 * named 'other' (what a point, a handshake or a look is aimed at), at the sheets' 18° pitch. */
export function actorFrames(who: string): Record<string, string> {
  const out: Record<string, string> = {}, v = view();
  for (const c of cases()) {
    const troupe = new Troupe();
    troupe.add({ name: 'other', who: 'base-m', at: [1.2, 1.4] });
    const a = troupe.add(c.script(who), { density: c.density });
    c.at.forEach((t, i) => { out[`${who}/${c.name}/${i}@D${c.density}`] = md5(a.draw(t, v).painted); });
  }
  return out;
}
