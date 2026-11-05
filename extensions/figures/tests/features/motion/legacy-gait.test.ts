import { describe, expect, it } from 'vitest';
import { BASE } from '../../../base/base';
import { Figure, type FigureInput } from '../../../src/features/figure/figure';
import { member, view } from '../../../src/features/figure/frames';
import type { Gait } from '../../../src/features/motion/motion';
import { differs } from '../draw';

/**
 * The legacy gait fields (motion.ts Gait.twitch, twitchEvery, idleLoop, idlePoses, shuffle and plumb): a gait may twitch
 * its head now and then, hold its idle to a few poses, pivot instead of shuffling, and hang its arms plumb. No base
 * gait sets them, so a gait of the base man with each is drawn standing and must differ from the same man without it
 * (the idle at 3 s, the turn on the spot at its second beat, the arms at once), and draw the same twice.
 */
const def = BASE[0].def;
/** The man standing at three-quarter, after `seconds` of idle at 60 Hz, in a gait with `over` changed. */
function idle(over: Partial<Gait>, seconds = 3, facing = Math.PI / 4): Uint8ClampedArray {
  const f = new Figure(member({ ...def, gaitOverrides: over }, 1)), input: FigureInput = { facing, moving: false, view: view() };
  for (let i = 0; i < seconds * 60; i++) f.update(1 / 60, input);
  return f.painted.slice();
}
/** The man turning on the spot: facing swings from one direction to its opposite, sampled mid-turn. */
function turning(over: Partial<Gait>): Uint8ClampedArray {
  const f = new Figure(member({ ...def, gaitOverrides: over }, 1));
  f.update(1 / 60, { facing: 0, moving: false, view: view() });
  for (let i = 0; i < 20; i++) f.update(1 / 60, { facing: Math.PI, moving: false, view: view() });
  return f.painted.slice();
}

describe('the legacy gait fields', () => {
  it('a twitch rolls the head at its slot, so the idle differs there', () => {
    // 3 s is the start of the third 1.5 s slot, where the twitch lasts one pose step.
    expect(differs(idle({ twitch: 0.3, twitchEvery: 1.5 }), idle({}))).toBe(true);
    expect(differs(idle({ twitch: 0.3, twitchEvery: 1.5 }), idle({ twitch: 0.3, twitchEvery: 1.5 }))).toBe(false);
    // A twitch of 0 (or none) is no twitch: the control that the difference above is the twitch's.
    expect(differs(idle({ twitch: 0, twitchEvery: 1.5 }), idle({}))).toBe(false);
  });
  it('a held idle (idleLoop, idlePoses) differs from the free one', () => {
    expect(differs(idle({ idleLoop: 4, idlePoses: 2 }, 1.3), idle({}, 1.3))).toBe(true);
  });
  it('plumb takes the torso\'s bend back at the shoulder, so the arms hang differently', () => {
    expect(differs(idle({ plumb: 0.75 }, 1), idle({}, 1))).toBe(true);
  });
  it('shuffle: false pivots a turn on the spot instead of shuffling', () => {
    expect(differs(turning({ shuffle: false }), turning({}))).toBe(true);
  });
});
