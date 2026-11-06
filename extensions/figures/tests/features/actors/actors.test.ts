import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { BASE } from '../../../base/base';
import { ScriptedActor, Troupe, scriptOf, type ActorScript } from '../../../src/features/actors/actor';
import { ACTIONS, actionOf, lengthOf, specAt, weightAt } from '../../../src/features/actors/actions';
import { lowest } from '../../../src/features/actors/pose-spec';
import { fk } from '../../../src/features/body/rig';
import golden from '../../golden/sprites.json';
import { SPRITE_SETS, spriteSet } from '../../golden/sprites';

const view = { azimuth: 0, pitch: 18 * Math.PI / 180 };
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex');

describe('sprites stay pixel-identical with no new feature used', () => {
  // Every channel of every pixel (an md5 of each frame's RGBA): the hero, the 8 views standing and the walk's 8 poses,
  // as drawn before the actors came (tests/golden/sprites.json, recorded by `npm run golden -- sprites`).
  for (const [id, D] of SPRITE_SETS) it(`${id}-D${D}`, () => {
    expect(spriteSet(id, D)).toEqual((golden as Record<string, string[]>)[`${id}-D${D}`]);
  });
});

describe('an actor is a pure function of time', () => {
  const script: ActorScript = {
    name: 'a', who: 'base-f', at: [0, 0], facing: 0,
    path: [{ at: [2, 1] }, { at: [2, 3], run: true, wait: 0.5 }, { at: [1, 3], strafe: true, march: 0.6 }],
    face: [{ t: 4, to: 90 }], look: [{ t: 1, at: [5, 5] }, { t: 3.5, at: null }],
    actions: [{ t: 0.5, action: 'wave' }, { t: 2.6, action: 'point', at: [0, 0] }, { t: 4.5, action: 'sit', until: 6 }],
    expressions: [{ t: 1, is: 'talk' }], items: [{ t: 2, hold: 'torch' }],
  };
  const sample = (order: number[], at: number) => {
    const a = new ScriptedActor(script, { density: 1 });
    for (const t of order) a.draw(t, view);
    const f = a.draw(at, view);
    return { pose: JSON.stringify(a.poseAt(at, f, view)), px: md5(f.painted), state: JSON.stringify(a.state(at)) };
  };
  for (const at of [1.3, 3.1, 4.8]) it(`samples the same pose and pixels at t=${at} from any start`, () => {
    const fresh = sample([], at), forward = sample([0, 0.25, 0.5, 0.9, 1.2, 2, 2.7, 3.3, 4.1], at), back = sample([7, 5.5, 0.1], at);
    expect(forward).toEqual(fresh);
    expect(back).toEqual(fresh);
  });
});

describe('every action plays on any body', () => {
  const who = BASE.map(c => c.def.id);
  const ids = Object.keys(ACTIONS);
  for (const w of who) it(`${w}: each action runs, blends in and out, and stays on the floor`, () => {
    const troupe = new Troupe();
    troupe.add({ name: 'other', who: 'base-m', at: [0.9, 0.9] });
    for (const id of ids) {
      const { def } = actionOf(id, false, false), until = def.hold ? 0.2 + lengthOf(def) + 0.6 : undefined;
      const a = troupe.add({ who: w, at: [0, 0], facing: 30, actions: [{ t: 0.2, action: id, until, ...(id === 'handshake' || id === 'point' ? { at: 'other' } : {}) }] });
      const f = a.figure(), s = f.skeleton, end = 0.2 + (until ? until - 0.2 : lengthOf(def)) + def.recovery + 0.2;
      for (let t = 0; t <= end; t += 0.1) {
        const p = a.poseAt(t, f, view), low = lowest(s, fk(s, p));
        expect(Math.abs(low), `${w} ${id} at ${t.toFixed(1)}: lowest ${low.toFixed(3)} m`).toBeLessThan(0.02);
        for (const q of p.rot) for (const v of q) expect(Number.isFinite(v)).toBe(true);
      }
      // Its envelope: nothing before it starts or after it has recovered, all of it mid-action.
      expect(a.activeAt(0.1).length).toBe(0);
      expect(a.activeAt(end).length).toBe(0);
      expect(a.activeAt(0.2 + def.anticipation + 0.05).length).toBe(1);
    }
  });
  it('an action starts and ends at the gait\'s pose (its envelope is 0 at both ends)', () => {
    for (const id of ids) {
      const { def } = actionOf(id, false, false), len = lengthOf(def);
      expect(weightAt(def, 0, len)).toBe(0);
      expect(weightAt(def, len + def.recovery + 1e-6, len)).toBe(0);
      expect(specAt(def, len / 2, len)).toBeTruthy();
    }
  });
  it('attack swings with an item and punches without', () => {
    expect(actionOf('attack', true, false).id).toBe('swing');
    expect(actionOf('attack', false, false).id).toBe('punch');
    expect(actionOf('look', false, false).id).toBe('lookAround');
  });
});

describe('locomotion', () => {
  it('runs, strafes and steps in place with its feet on the floor', () => {
    for (const w of ['base-m', 'base-f']) {
      const a = new ScriptedActor({ who: w, at: [0, 0], path: [{ at: [0, 4], run: true }, { at: [2, 4], strafe: true }, { at: [2, 4.01], march: 1 }] }), f = a.figure(), s = f.skeleton;
      for (let t = 0; t < 4; t += 0.05) {
        const p = a.poseAt(t, f, view), low = lowest(s, fk(s, p));
        // A run has a flight: both feet up a little; never under the floor.
        expect(low).toBeGreaterThan(-0.03);
        expect(low).toBeLessThan(0.12);
      }
      // A run is faster than the walk, the strafe keeps its facing.
      const run = a.state(0.2), strafe = a.state(a.state(0.2).speed ? 4 / run.speed + 0.3 : 1);
      expect(run.speed).toBeGreaterThan(a.speedOf(a.gaitOf()) * 1.5);
      expect(Math.abs(strafe.facing)).toBeLessThan(0.05);
      expect(Math.abs(Math.abs(strafe.heading) - Math.PI / 2)).toBeLessThan(0.05);
    }
  });
  it('turns to a look past its neck, and faces where it walks', () => {
    const a = new ScriptedActor({ who: 'base-m', at: [0, 0], facing: 0, look: [{ t: 0, at: [0, -5] }], path: [] });
    expect(Math.abs(a.state(1).facing)).toBeGreaterThan(1);
    const b = new ScriptedActor({ who: 'base-m', at: [0, 0], path: [{ at: [3, 0] }] });
    expect(b.state(0.5).facing).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('placements are scripts', () => {
  it('a placement walks to `to` and holds its pose', () => {
    expect(scriptOf({ who: 'base-m', at: [0, 0], to: [1, 0], pose: 'handOnHip' })).toEqual({ who: 'base-m', at: [0, 0], path: [{ at: [1, 0] }], stands: [{ t: 0, pose: 'handOnHip' }] });
    expect(scriptOf({ who: 'base-m', at: [0, 0], pose: 'hero' }).stands?.[0].pose).toBe(BASE[0].pose);
    const s: ActorScript = { who: 'base-f', at: [1, 1], actions: [{ t: 0, action: 'wave' }] };
    expect(scriptOf(s)).toBe(s);
  });
});
